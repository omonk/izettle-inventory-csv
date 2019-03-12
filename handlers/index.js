const Main = require('apr-main');
const Got = require('got');
const { format } = require('date-fns');
const Json2csvParser = require('json2csv').Parser;

const arr = {
  purchases: [
    {
      products: [
        {
          quantity: 2,
          variantName: 'Jose Antonio Casals Catalá',
          variantUuid: '980160d3-cafe-4e03-b428-753d6c59d09f',
          unitName: 'g',
        },
        {
          quantity: 2,
          variantName: 'Alba Rosa Nogueira Miguel',
          variantUuid: 'd6a46f66-2da4-4d70-bed6-937ad506ad98',
        },
        {
          quantity: 2,
          variantName: 'Liane Köster',
          variantUuid: 13,
        },
        {
          quantity: 2,
          variantName: 'Dr. Evangelia Bolander B.Sc.',
          variantUuid: 4912,
          unitName: 'g',
        },
      ],
    },
    {
      products: [
        {
          quantity: 2,
          variantName: 'Jose Antonio Casals Catalá',
          variantUuid: '980160d3-cafe-4e03-b428-753d6c59d09f',
          unitName: 'g',
        },
        {
          quantity: 2,
          variantName: 'Alba Rosa Nogueira Miguel',
          variantUuid: 'd6a46f66-2da4-4d70-bed6-937ad506ad98',
          unitName: 'g',
        },
      ],
    },
  ],
};

const GetLatestTransactions = async () => {
  // const { body } = await Got('https://api.izettle.com/purchases', {
  //   json: true,
  //   query: {
  //     startDate: format(new Date(), 'YYYY-MM-DD'),
  //   },
  // });

  return arr.purchases
    .reduce((acc, { products }) => acc.concat(products), [])
    .reduce(
      (acc, { variantUuid, quantity, variantName, unitName }) => ({
        ...acc,
        [variantUuid]: {
          quantity: acc[variantUuid]
            ? acc[variantUuid].quantity + quantity
            : quantity,
          variantName,
          unitName: unitName || '',
        },
      }),
      {},
    );
};

module.exports.handle = async ev => {
  const products = await GetLatestTransactions();

  const parser = new Json2csvParser({
    header: false,
    fields: ['uuid', 'quantity', 'variantName', 'unitName'],
  });

  const csv = parser.parse(
    Object.keys(products).map(uuid => ({
      uuid,
      ...products[uuid],
    })),
  );

  return csv;
};
