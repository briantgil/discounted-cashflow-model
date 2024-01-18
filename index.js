import DiscountedCashFlowModel from './discounted_cashflow_model.js';

//const dcfm = new DiscountedCashFlowModel("MTB");
//const dcfm = new DiscountedCashFlowModel("MTB", undefined, '2023-12-24');  

//const dcfm = new DiscountedCashFlowModel("NVDA");
//const dcfm = new DiscountedCashFlowModel("NVDA", undefined, '2024-01-10');
//const dcfm = new DiscountedCashFlowModel("NVDA", undefined, new Date('2023-11-03T09:30'));


//const dcfm = new DiscountedCashFlowModel("ba", '', '');//, undefined, '2023-12-26');

//const dcfm = new DiscountedCashFlowModel("MSFT", undefined, '2024-01-11');
const dcfm = new DiscountedCashFlowModel("MSFT");

//const dcfm = new DiscountedCashFlowModel("MTB", 'file', '2024-01-11', './company_data.txt');  //FIXME: issue with await
await dcfm.fetchData();

