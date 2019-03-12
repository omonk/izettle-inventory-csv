const Main = require('apr-main');
const Got = require('got');
const { format, subDays } = require('date-fns');
const Json2csvParser = require('json2csv').Parser;
const AWS = require('aws-sdk');

console.log(process.env);
const {
  IZETTLE_CLIENT_ID,
  IZETTLE_CLIENT_SECRET,
  IZETTLE_EMAIL,
  IZETTLE_PASSWORD,
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
      startDate: format(subDays(new Date(), 1), 'YYYY-MM-DD'),
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const { purchases } = body;

  return purchases
    .reduce((acc, { products }) => acc.concat(products), [])
    .reduce(
      (acc, { variantUuid, quantity, variantName, unitName, productUuid }) => ({
        ...acc,
        [variantUuid]: {
          quantity: acc[variantUuid]
            ? acc[variantUuid].quantity + Number(quantity)
            : Number(quantity),
          variant: variantName || '',
          productUuid,
          unitName: unitName || '',
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

const UploadToS3 = async csv => {
  const S3 = new AWS.S3();

  await S3.upload({
    Bucket: 'lftransactions',
    Key: `transctions_${format(new Date(), 'YYYY-MM-DD')}`,
    Body: csv,
  }).promise();
};

module.exports.handle = async ev => {
  const { access_token: token } = await Auth();
  const { organizationUuid } = await GetOrganisationMeta(token);

  const products = await GetAllProducts(token, organizationUuid);
  const transactions = await GetLatestTransactions(token);

  const data = Object.keys(transactions).map(uuid => {
    const matchingProduct = products.find(product => {
      return product.uuid === transactions[uuid].productUuid;
    });

    return {
      brand: matchingProduct ? matchingProduct.name : undefined,
      ...transactions[uuid],
    };
  });

  const parser = new Json2csvParser({
    header: false,
    fields: ['brand', 'variantName', 'quantity', 'unitName'],
  });

  const csv = parser.parse(data);
  await UploadToS3(csv);

  return csv;
};
