const Main = require('apr-main');
const Got = require('got');
const Flatten = require('lodash.flatten');
const { format, subDays, startOfToday, isSameDay } = require('date-fns');
const Json2csvParser = require('json2csv').Parser;
const AWS = require('aws-sdk');

const {
  IZETTLE_CLIENT_ID,
  IZETTLE_CLIENT_SECRET,
  IZETTLE_EMAIL,
  IZETTLE_PASSWORD,
  TRANSACTIONS_BUCKET,
} = process.env;

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

const GetLatestTransactions = async token => {
  const { body } = await Got('https://purchase.izettle.com/purchases/v2', {
    json: true,
    query: {
      startDate: format(subDays(new Date(), 7), 'YYYY-MM-DD'),
      endDate: format(new Date(), 'YYYY-MM-DD'),
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const { purchases } = body;

  const purchasesGroupedByDay = purchases.reduce((acc, curr) => {
    const { timestamp } = curr;
    const date = format(timestamp, 'DD-MM-YYYY');

    return {
      ...acc,
      [date]: acc[date] ? acc[date].concat(curr) : [curr],
    };
  }, {});

  return Object.keys(purchasesGroupedByDay).map((key, _, arr) => {
    return {
      timestamp: key,
      products: purchasesGroupedByDay[key]
        .reduce((acc, { products }) => acc.concat(products), [])
        .reduce(
          (
            acc,
            {
              variantUuid,
              quantity,
              variantName,
              unitName,
              productUuid,
              unitPrice,
            },
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
        ),
    };
  });
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

const UploadToS3 = async csv => {
  const S3 = new AWS.S3();

  await S3.putObject({
    Bucket: TRANSACTIONS_BUCKET,
    Key: `transctions_${format(new Date(), 'YYYY-MM-DD')}`,
    Body: csv,
  }).promise();
};

module.exports.handle = async ev => {
  const { access_token: token } = await Auth();
  const { organizationUuid } = await GetOrganisationMeta(token);

  const products = await GetAllProducts(token, organizationUuid);
  const transactions = await GetLatestTransactions(token);

  const data = transactions.map(
    ({ products: transactionProducts, timestamp }) => {
      return Object.keys(transactionProducts).map(key => {
        const matchingProduct = products.find(product => {
          return product.uuid === transactionProducts[key].productUuid;
        });

        return {
          brand: matchingProduct ? matchingProduct.name : undefined,
          timestamp,
          ...transactionProducts[key],
        };
      });
    },
  );

  const parser = new Json2csvParser({
    fields: [
      'brand',
      'timestamp',
      'quantity',
      'variant',
      'unitName',
      'unitPrice',
    ],
  });

  const csv = parser.parse(Flatten(data));
  await UploadToS3(csv);

  return csv;
};
