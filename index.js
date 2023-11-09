import DiscountedCashFlowModel from './discounted_cashflow_model.js';

//const dcfm = new DiscountedCashFlowModel("NVDA");
const dcfm = new DiscountedCashFlowModel("NVDA", undefined, '2023-11-03');
//const dcfm = new DiscountedCashFlowModel("NVDA", undefined, new Date('2023-11-03T09:30'));


await dcfm.tickerData_AlphaVantage();
//console.log(dcfm.toString());


