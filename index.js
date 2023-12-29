import DiscountedCashFlowModel from './discounted_cashflow_model.js';

//const dcfm = new DiscountedCashFlowModel("MTB");
//const dcfm = new DiscountedCashFlowModel("MTB", undefined, '2023-12-24');  

//const dcfm = new DiscountedCashFlowModel("NVDA");
//const dcfm = new DiscountedCashFlowModel("NVDA", undefined, '2023-12-24');
//const dcfm = new DiscountedCashFlowModel("NVDA", undefined, new Date('2023-11-03T09:30'));


const dcfm = new DiscountedCashFlowModel("ba", '', '');//, undefined, '2023-12-26');

await dcfm.fetchData();

