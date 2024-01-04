// @ts-check

//https://medium.com/@trukrs/type-safe-javascript-with-jsdoc-7a2a63209b76
//https://typescript-v2-140.ortam.vercel.app/docs/handbook/type-checking-javascript-files.html
//https://jsdoc.app/tags-type


import { dcfModelConfig, apiKeys } from './config.js';
import TickerService from './ticker_service.js';

export default class DiscountedCashFlowModel {
    /*
    Discounted Cash Flow (DCF) model
    Calculate Fair Value of a Company Security using Discounted Free Cash Flow
    references:
    https://www.investopedia.com/terms/d/dcf.asp#:~:text=Discounted%20cash%20flow%20(DCF)%20refers,will%20generate%20in%20the%20future.
    https://www.investopedia.com/terms/w/wacc.asp
    https://www.investopedia.com/terms/c/costofequity.asp
    https://www.investopedia.com/terms/c/capm.asp
    https://www.investopedia.com/terms/t/terminalvalue.asp
    */

    /**
     * global configs
     */
     #riskFreeRate;
     #marketRate;
     #terminalGrowthRate;
     #marginOfSafety;
     #durationYears;

    /**
     * passed params
     */
    #ticker;
    #source;
    #curDate;

    /**
     * fetched data
     */
    #closingPrice = 0.0;
    #marketCap = 0;
    #sharesOutstanding = 0;  
    #beta = 0.0;
    #pretaxIncome = 0;  //if income<0, income=0
    #incomeTax = 0;  //if tax<0, tax=0
    #totalDebt = 0;  //use total debt for WACC; use total debt and assets for debt ratio
    #interestExpense = 0;  //if nii>0, interest=0
    #freeCashflows = [];  //if fcf<0, fcf=0; order: newest -> oldest; fcf=operating cash flow-capex (premises, equipment, and leased equipment)

    /**
     * calculated data
     */
    #fcfGrowthRates = [];
    #avgFcfGrowthRate = 0.0;

    #taxRate = 0.0;
    #costOfDebt = 0.0;
    #costOfEquity = 0.0;  //capital asset pricing model (capm)
    #discountRate = 0.0  //weighted average cost of capital (wacc)
    #terminalValue = 0.0  //perpetual growth model (pgm), perpetuity method

    #discountFactors = [];  //for net present value (npv)
    #futureFcf = [];
    #discountedFcf = [];
    
    #fairValue = 0.0;
    #fvAfterMarginOfSafety = 0.0;

    /**
     * 
     * @param {string} ticker 
     * @param {string} source 
     * @param {string} date 
     */
    constructor(ticker, source="AlphaVantage", date=''){
        this.#riskFreeRate = dcfModelConfig.riskFreeRate;
        this.#marketRate = dcfModelConfig.marketRate;
        this.#terminalGrowthRate = dcfModelConfig.terminalGrowthRate;
        this.#marginOfSafety = dcfModelConfig.marginOfSafety;
        this.#durationYears = dcfModelConfig.durationYears;
        this.#ticker = ticker;
        this.#source = source;

        //FIXME: does not work on holiday: 2023-12-25
        //https://www.npmjs.com/package/date-holidays#holiday-object
        if (date == ''){
            this.#curDate = this.#latestDate(new Date());  //default date      
        }
        else{  //XXX: date must be yyyy-mm-dd 
            this.#curDate = this.#latestDate(new Date(date + 'T09:31'));
        }

        //TODO: validate params

    }

    get riskFreeRate(){
        return this.#riskFreeRate;
    }
    get marketRate(){
        return this.#marketRate;
    }
    get terminalGrowthRate(){
        return this.#terminalGrowthRate;
    }
    get marginOfSafety(){
        return this.#marginOfSafety;
    }
    get durationYears(){
        return this.#durationYears;
    }    
    get ticker(){
        return this.#ticker;
    }    
    get source(){
        return this.#source;
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
    get sharesOutstanding(){
        return this.#sharesOutstanding;
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

    get fcfGrowthRates(){
        //([i]-[i+1])/[i+1], if [i+1] == 0, then [i]
        const growthRates = [];

        if (this.freeCashflows.length <= 0){  //no cashflow history
            return [0.0];
        }
        else if (this.freeCashflows.length == 1 && this.freeCashflows[0] <= 0) {  //only 1 yr cashflow history and it's neg
            return [0.0];
        }
        else if (this.freeCashflows.length == 1 && this.freeCashflows[0] > 0){  //only 1 yr cashflow history and it's pos
            return [1.0];
        }

        for (let i=0; i<this.freeCashflows.length-1; i++){  //XXX: rethink algo; see ticker BA
            if (this.freeCashflows[i] <= 0 && this.freeCashflows[i+1] <= 0){  
                growthRates.push(0.0);  //cashflow yr/yr is neg=>neg
                continue;
            }
            else if (this.freeCashflows[i] > 0 && this.freeCashflows[i+1] <= 0) {
                growthRates.push(1.0);  //cashflow yr/yr is neg=>pos
                continue;                
            }
            else if (this.freeCashflows[i] <= 0 && this.freeCashflows[i+1] > 0) {
                growthRates.push(-1.0);  //cashflow yr/yr is pos=>neg
                continue;                
            }
            //cash flow yr/yr is pos=>pos
            growthRates.push((this.freeCashflows[i] - this.freeCashflows[i+1]) / this.freeCashflows[i+1]);
        }

        return growthRates;
    }

    get avgFcfGrowthRate(){
        if (this.fcfGrowthRates.length > 0){
            return this.fcfGrowthRates.reduce((curTotal, curVal)=>curTotal+curVal) / this.fcfGrowthRates.length * 100; 
        }
        return 0.0;
    }

    toString(){
        return `
Global settings
-----------------------------------------
risk free rate:       ${this.riskFreeRate} (${(this.riskFreeRate * 100).toFixed(2)}%)
market rate:          ${this.marketRate} (${(this.marketRate * 100).toFixed(2)}%)
terminal growth rate: ${this.terminalGrowthRate} (${(this.terminalGrowthRate * 100).toFixed(2)}%)
margin of safety:     ${this.marginOfSafety} (${(this.marginOfSafety * 100).toFixed(0)}%)
duration years:       ${this.durationYears}

${this.ticker} (source: ${this.source}, ${this.curDate})
-----------------------------------------
last close:         ${this.closingPrice}
market cap:         ${this.marketCap}
shares:             ${this.sharesOutstanding}
beta:               ${this.beta}
pretax income:      ${this.pretaxIncome}
income tax:         ${this.incomeTax}
total debt:         ${this.totalDebt}
interest expense:   ${this.interestExpense}
free cash flows:    ${this.freeCashflows.toString()}
FCF growth rates:   ${this.fcfGrowthRates.toString()}
average fcf growth: ${this.avgFcfGrowthRate}%
`;
    }

    testDates(){
        const dates = [new Date('2023-01-01T09:30'),new Date('2023-04-01T09:30'),new Date('2023-09-02T09:30'),new Date('2023-09-03T09:30'),new Date()];
        //FIXME: does not work on holiday: 2023-12-25
        //https://www.npmjs.com/package/date-holidays#holiday-object
        for (let d in dates){
            console.log(dates[d]);
            let date = this.#latestDate(dates[d]);
            console.log(date);
        }
    }

    #latestDate(d){
        //FIXME: does not work on holiday: 2023-12-25
        //https://www.npmjs.com/package/date-holidays#holiday-object

        //consider previous day if before today's close
        if (`${d.getHours()<10?0:""}${d.getHours()}:${d.getMinutes()<10?0:""}${d.getMinutes()}` < '09:30'){
            d.setDate(d.getDate() - 1);
        }  

        let day = d.getDay();
        let date = d.getDate();  //gets local date
        let month = d.getMonth() + 1;
        let year = d.getFullYear();

        //remove weekends
        if (day == 6){
            date--;
        }
        else if (day == 0){
            date = date - 2;
        }

        //adjust date 
        if (date < 1){
            month--;
            if (month < 1){
                month = 12;
                year--
            }

            if ([1,3,5,7,8,10,12].indexOf(month) >= 0){
                date = 31;
            }
            else if ([4,6,9,11].indexOf(month) >= 0){
                date = 30;
            }
            else if (month == 2) {
                //years 1700, 1800, and 1900 were not leap years 
                //but the years 1600 and 2000 were
                if (year % 4 == 0) {
                    if (year % 100 == 0){
                        if (year % 400 == 0){
                            date = 29;  //leap year                   
                        } else {
                            date = 28;
                        }
                    } else {
                        date = 29;  //leap year
                    }
                } else {
                    date = 28;
                }
            }
        }

        //pad date
        date = date.toString();
        if (date.length == 1){
            date = "0" + date;
        }

        //pad month
        month = month.toString();
        if (month.length == 1){
            month = "0" + month;
        }

        //console.log(`***debugging: ${year}-${month}-${date}`);
        return `${year}-${month}-${date}`;
    }

    async fetchData(){
        switch (this.source){
            case 'file':
            case 'Polygon':
            case 'AlphaVantage':
                await this.#tickerData_AlphaVantage(this.ticker, apiKeys.av);
                break;
            default:
                await this.#tickerData_AlphaVantage(this.ticker, apiKeys.av);
        }
        console.log(this.toString());
    }    

    async #tickerData_AlphaVantage(ticker, apikey){
        const tickerSymbol = new TickerService(ticker, apikey);

        const data = await Promise.all([
            tickerSymbol.lastClosePrice(this.curDate),
            tickerSymbol.shareAttributes(),
            tickerSymbol.fromIncomeStmt(),
            tickerSymbol.fromBalSheet(),
            tickerSymbol.fromCashflowStmt()
        ]);

        //func 1
        this.#closingPrice = data[0].close;
        //func 2
        this.#marketCap = parseInt(data[1]["market cap"]);
        this.#sharesOutstanding = parseInt(data[1].shares);
        this.#beta = parseFloat(data[1].beta);   
        //func 3
        this.#pretaxIncome = parseInt(data[2]["pretax income"]) > 0 ? parseInt(data[2]["pretax income"]) : 0;
        this.#incomeTax = parseInt(data[2]["income tax"]) > 0 ? parseInt(data[2]["income tax"]) : 0;
        this.#interestExpense = parseInt(data[2]["interest expense"]) > 0 ? parseInt(data[2]["interest expense"]) : 0;
        //func 4
        this.#totalDebt = parseInt(data[3]["total debt"]);
        //func 5
        this.#freeCashflows = data[4].map(val => parseInt(val) > 0 ? parseInt(val) : 0);  //XXX: remove negatives; may cause div/0
    }

}

