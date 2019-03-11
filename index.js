const Main = require('apr-main');
const Got = require('got');
const { format } = require('date-fns');

const GetLatestTransaction = async () => {
  const { body } = await Got('https://api.izettle.com/purchases', {
    query: {
      startDate,
    },
  });
};

const Go = async () => {
  // [productId, productUuid][]
  //   const Products = await GetLatestTransaction();
  // const GetTransactionProducts =
};

Main(async () => Go());
