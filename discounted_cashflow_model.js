// @ts-check

import { dcfModelConfig, apiKeys } from './config.js';
import TickerService from './ticker_service.js';
import FileService from './file_service.js';
import Holidays from 'date-holidays';  //https://www.npmjs.com/package/date-holidays#holiday-object

/**
 * @typedef {import('./config').ApiKeys} ApiKeys
 */

/**
 * @typedef {import('./config.js').DcfModelConfig} DcfModelConfig
 */

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
      * */

    /**
     * passed params
     */
    #ticker;
    #source;
    #curDatePart;
    #filePath

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
     * @param {string} [source] 
     * @param {string} [datepart] 
     * @param {string} [filepath]
     */
    constructor(ticker, source="AlphaVantage", datepart='', filepath=''){
        this.#ticker = ticker;
        this.#source = source;
        this.#filePath = filepath;
        
        const hd = new Holidays('US');

        //TODO: validate params

        let nowDT = new Date(Date.now());
        let curDT;
        if (datepart == ''){
            curDT = nowDT;
        }
        else {
            curDT = new Date(`${datepart} ${nowDT.getHours()}:${nowDT.getMinutes()}:${nowDT.getSeconds()}`);  //GMT-5:00
        }

        console.log("DEBUGGING DATE 1=" + curDT);

        if (curDT.toString() == 'Invalid Date') {
            throw Error(`Date '${datepart}' must be of format: yyyy-mm-dd`);
        }

        if (!this.#isBusinessDay(curDT, hd)){throw Error(`Date '${curDT}' must be a business day`);}

        if (!this.#isDateInPast(curDT)){throw Error(`Date '${curDT}' must have a market close`);}

        //convert date back to yyyy-mm-dd string
        let year = curDT.getFullYear();
        let month = curDT.getMonth() + 1 < 10 ? "0" + (curDT.getMonth() + 1).toString() : curDT.getMonth().toString();
        let day = curDT.getDate() < 10 ? "0" + curDT.getDate().toString() : curDT.getDate().toString();
        this.#curDatePart = `${year}-${month}-${day}`;

        if (source == 'file' && filepath == ''){  //TODO: use regex for upper/lower case
            throw Error('Must enter filepath');  //TODO: test file exist
        }

        console.log("DEBUGGING DATE 2=" + curDT);
        
    }


    get riskFreeRate(){
        return dcfModelConfig.riskFreeRate;
    }
    get marketRate(){
        return dcfModelConfig.marketRate;
    }
    get terminalGrowthRate(){
        return dcfModelConfig.terminalGrowthRate;
    }
    get marginOfSafety(){
        return dcfModelConfig.marginOfSafety;
    }
    get durationYears(){
        return dcfModelConfig.durationYears;
    }    


    get ticker(){
        return this.#ticker;
    }    
    get source(){
        return this.#source;
    }
    get curDatePart(){
        return this.#curDatePart;
    }
    get filePath(){
        return this.#filePath;
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

${this.ticker} (source: ${this.source}, ${this.curDatePart})
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


    /**
     * 
     * @param {Date} date 
     * @param {Holidays} hd
     * @returns {boolean}
     */
    #isBusinessDay(date, hd){
    //function isBusinessDay(date){
        //const hd = new Holidays('US');
        let day = date.getDay();

        //weekends
        if (day == 0 || day == 6){
            return false;
        }
        //holidays
        if (typeof hd.isHoliday(date) == 'object'){
            return false;
        }
        return true;
    }


    /**
     * 
     * @param {Date} date 
     * @returns {boolean}
     */
    #isDateInPast(date){
    //function isDateInPast(date){
        /**
         * compare dates
         */
        let dy = date.getFullYear();
        let dm = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1).toString() : date.getMonth().toString();
        let dd = date.getDate() < 10 ? '0' + date.getDate().toString() : date.getDate().toString();
        let today = new Date();
        today.setHours(16);  //market close
        today.setMinutes(0);
        today.setSeconds(0);
        let ty = today.getFullYear();
        let tm = today.getMonth() + 1 < 10 ? "0" + (today.getMonth() + 1).toString() : today.getMonth().toString();
        let td = today.getDate() < 10 ? '0' + today.getDate().toString() : today.getDate().toString();

        //if date part > today date part
        if (`${dy}-${dm}-${dd}` > `${ty}-${tm}-${td}`){
            return false;
        }
        //if date part == today date part and time part < 4PM (market close)
        if (dy==ty && dm==tm && dd==td){
            if (date.getTime() < today.getTime()){
                return false;
            }
        }
        return true;
    }


    async fetchData(){
        switch (this.source){
            case 'file':
                await this.#tickerData_File(this.#filePath);
                break;
            case 'Polygon':
            case 'AlphaVantage':
                await this.#tickerData_AlphaVantage(this.ticker, apiKeys.av, this.#curDatePart);
                break;
            default:
                await this.#tickerData_AlphaVantage(this.ticker, apiKeys.av, this.#curDatePart);
        }
        console.log(this.toString());
    }    


    async #tickerData_File(path){
        const tickerSymbol = new FileService(path);
        const data = await tickerSymbol.parseFile();
        //TODO: set data
    }


    async #tickerData_AlphaVantage(ticker, apikey, date){
        const tickerSymbol = new TickerService(ticker, apikey);

        const data = await Promise.all([
            //tickerSymbol.lastClosePrice(this.#curDate),
            tickerSymbol.lastClosePrice(date),
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

