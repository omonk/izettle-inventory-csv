const Got = require('got');
const SortBy = require('lodash.sortby');
const { format, subDays, startOfWeek, startOfDay } = require('date-fns');
const Json2csvParser = require('json2csv').Parser;
const AWS = require('aws-sdk');

const {
  IZETTLE_CLIENT_ID,
  IZETTLE_CLIENT_SECRET,
  IZETTLE_EMAIL,
  IZETTLE_PASSWORD,
  TRANSACTIONS_BUCKET,
  STAGE = 'development',
} = process.env;

const dateFormat = 'YYYY-MM-DD';

const Auth = async () => {
  const { body } = await Got('https://oauth.izettle.net/token', {
    body: {
      grant_type: 'password',
      client_id: IZETTLE_CLIENT_ID,
      client_secret: IZETTLE_CLIENT_SECRET,
      username: IZETTLE_EMAIL,
      password: IZETTLE_PASSWORD,
    },
    form: true,
    json: true,
  });

  return body;
};

const generateRange = type => {
  const date = new Date();
  const start =
    type === 'weekly'
      ? startOfWeek(subDays(date, 1), { weekStartsOn: 1 })
      : startOfDay(date);

  const startDate = format(start, dateFormat);
  return {
    startDate,
  };
};

const GetLatestTransactions = async (token, type) => {
  const { body } = await Got('https://purchase.izettle.com/purchases/v2', {
    json: true,
    query: {
      ...generateRange(type),
      limit: 10000,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const { purchases } = body;

  const allProducts = purchases.reduce((acc, curr) => {
    const { products = [] } = curr;
    return acc.concat(products);
  }, []);

  return allProducts.reduce(
    (
      acc,
      { variantUuid, quantity, variantName, unitName, productUuid, unitPrice },
    ) => ({
      ...acc,
      [variantUuid]: {
        quantity: acc[variantUuid]
          ? acc[variantUuid].quantity + Number(quantity)
          : Number(quantity),
        variant: variantName || '',
        productUuid,
        unitName: unitName || '',
        unitPrice: acc[variantUuid]
          ? acc[variantUuid].unitPrice +
            Number(unitPrice / 100) * Number(quantity)
          : Number(unitPrice / 100) * Number(quantity),
      },
    }),
    {},
  );
};

const GetAllProducts = async (token, organizationUuid) => {
  const { body } = await Got(
    `https://products.izettle.com/organizations/${organizationUuid}/products`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      json: true,
    },
  );
  return body;
};

const GetOrganisationMeta = async token => {
  const { body } = await Got('https://oauth.izettle.net/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    json: true,
  });

  return body;
};

const UploadToS3 = async (csv, type) => {
  const S3 = new AWS.S3();

  await S3.putObject({
    Bucket: TRANSACTIONS_BUCKET,
    Key: `transctions_${type}_${format(new Date(), dateFormat)}`,
    Body: csv,
  }).promise();
};

module.exports.handle = async ev => {
  const { type = 'weekly' } = ev;

  const { access_token: token } = await Auth();
  const { organizationUuid } = await GetOrganisationMeta(token);

  const products = await GetAllProducts(token, organizationUuid);
  const transactions = await GetLatestTransactions(token, type);

  const data = Object.keys(transactions).map(key => {
    const matchingProduct = products.find(product => {
      return product.uuid === transactions[key].productUuid;
    });

    return {
      brand: matchingProduct ? matchingProduct.name.trim() : undefined,
      ...transactions[key],
    };
  });

  const parser = new Json2csvParser({
    fields: ['brand', 'quantity', 'variant', 'unitName', 'unitPrice'],
  });

  const csv = parser.parse(SortBy(data, ({ brand }) => brand));

  if (STAGE === 'prod') {
    await UploadToS3(csv, type);
  }

  return csv;
};
