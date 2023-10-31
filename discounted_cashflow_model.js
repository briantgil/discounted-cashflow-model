import { dcfModelConfig } from './config.js';


export default class DiscountedCashFlowModel {

    constructor(source, ticker){
        this.riskFreeRate = dcfModelConfig.riskFreeRate;
        this.marketRate = dcfModelConfig.marketRate;
        this.terminalGrowthRate = dcfModelConfig.terminalGrowthRate;
        this.marginOfSafety = dcfModelConfig.marginOfSafety;
        this.durationYears = dcfModelConfig.durationYears;

        this.source = source;
        this.ticker = ticker;
        this.marketCap = 0;
        this.outstandingShares = 0;  
        this.beta = 0.0;
        this.pretaxIncome = 0;  //if income<0, income=0
        this.incomeTax = 0;  //if tax<0, tax=0
        this.totalDebt = 0;  //use total debt for WACC; use total debt and assets for debt ratio
        this.interestExpense = 0;  //if nii>0, interest=0
        this.freeCashflows = [];  //if fcf<0, fcf=0
    }




}