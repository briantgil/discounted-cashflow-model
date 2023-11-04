import { dcfModelConfig } from './config.js';
import TickerService from './ticker_service.js';

export default class DiscountedCashFlowModel {

    #source;
    #ticker;
    #curDate;
    #closingPrice = 0.0;
    #marketCap = 0;
    #outstandingShares = 0;  
    #beta = 0.0;
    #pretaxIncome = 0;  //if income<0, income=0
    #incomeTax = 0;  //if tax<0, tax=0
    #totalDebt = 0;  //use total debt for WACC; use total debt and assets for debt ratio
    #interestExpense = 0;  //if nii>0, interest=0
    #freeCashflows = [];  //if fcf<0, fcf=0

    constructor(ticker, source="AV"){
        this.riskFreeRate = dcfModelConfig.riskFreeRate;
        this.marketRate = dcfModelConfig.marketRate;
        this.terminalGrowthRate = dcfModelConfig.terminalGrowthRate;
        this.marginOfSafety = dcfModelConfig.marginOfSafety;
        this.durationYears = dcfModelConfig.durationYears;

        this.#source = source;
        this.#ticker = ticker;
        this.#curDate = new Date().toISOString().split("T")[0];

        //call source
        this.tickerData_AlphaVantage();

        //build model
        //...

        //this.toString();
    }

    get source(){
        return this.#source;
    }
    get ticker(){
        return this.#ticker;
    }
    get curDate(){
        return this.#curDate;
    }
    get closingPrice(){
        return this.#closingPrice;
    }
    get marketCap(){
        return this.#marketCap;
    }
    get outstandingShares(){
        return this.#outstandingShares;
    }    
    get beta(){
        return this.#beta;
    }
    get pretaxIncome(){
        return this.#pretaxIncome;
    }
    get incomeTax(){
        return this.#incomeTax;
    }
    get totalDebt(){
        return this.#totalDebt;
    }
    get interestExpense(){
        return this.#interestExpense;
    }
    get freeCashflows(){
        return this.#freeCashflows;
    }

    toString(){
        return `
${this.ticker} (source: ${this.source}, ${this.curDate})
-----------------------------------------
last close:       ${this.closingPrice}
market cap:       ${this.marketCap}
shares out:       ${this.outstandingShares}
beta:             ${this.beta}
pretax income:    ${this.pretaxIncome}
income tax:       ${this.incomeTax}
total debt:       ${this.totalDebt}
interest expense: ${this.interestExpense}
free cash flows:  ${this.freeCashflows.toString()}
`;
    }

    async tickerData_AlphaVantage(){
        const ticker = new TickerService(this.#ticker);

        let data = await ticker.lastClosePrice();
        this.#closingPrice = data.close;

        data = await ticker.shareAttributes();
        this.#marketCap = parseInt(data["market cap"]);
        this.#outstandingShares = parseInt(data.shares);
        this.#beta = parseFloat(data.beta);        

        data = await ticker.fromIncomeStmt();
        this.#pretaxIncome = parseInt(data["pretax income"]);
        this.#incomeTax = parseInt(data["income tax"]);
        this.#interestExpense = parseInt(data["interest expense"]);

        data = await ticker.fromBalSheet();
        this.#totalDebt = parseInt(data["total debt"]);

        data = await ticker.fromCashflowStmt();
        this.#freeCashflows = data;

        this.toString();
    }

}

