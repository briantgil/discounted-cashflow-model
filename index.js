import DiscountedCashFlowModel from './discounted_cashflow_model.js';

const dcfm = new DiscountedCashFlowModel("NVDA");

await dcfm.tickerData_AlphaVantage();
console.log(dcfm.toString());


