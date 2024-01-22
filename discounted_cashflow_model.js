// @ts-check

import { dcfModelConfig, apiKeys } from './config.js';
import AlphaVantageService from './ticker_service.js';
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

    //constructor params
    /**@type {string}*/ #ticker;
    /**@type {string}*/ #source;
    /**@type {string}*/ #datePart;
    /**@type {string}*/ #filePath

    //fetched data
    /**@type {number}*/ #closingPrice = 0.0;
    /**@type {number}*/ #marketCap = 0;
    /**@type {number}*/ #sharesOutstanding = 0;  
    /**@type {number}*/ #beta = 0.0;
    /**@type {number}*/ #pretaxIncome = 0;  //if income<0, income=0
    /**@type {number}*/ #incomeTax = 0;  //if tax<0, tax=0
    /**@type {number}*/ #totalDebt = 0;  //use total debt for WACC; use total debt and assets for debt ratio
    /**@type {number}*/ #interestExpense = 0;  //if nii>0, interest=0
    /**@type {number[]}*/ #freeCashflows = [];  //if fcf<0, fcf=0; order: newest -> oldest; fcf=operating cash flow-capex (premises, equipment, and leased equipment)

    //calculated data
    /**@type {number[]}*/ #fcfGrowthRates = [];
    /**@type {number}*/ #avgFcfGrowthRate = 0.0;

    /**@type {number}*/ #taxRate = 0.0;
    /**@type {number}*/ #costOfDebt = 0.0;
    /**@type {number}*/ #costOfEquity = 0.0;  //capital asset pricing model (capm)
    /**@type {number}*/ #discountRate = 0.0  //weighted average cost of capital (wacc)
    /**@type {number}*/ #terminalValue = 0.0  //perpetual growth model (pgm), perpetuity method

    /**@type {number[]}*/#discountFactors = [];  //for net present value (npv)
    /**@type {number[]}*/#futureFcf = [];
    /**@type {number[]}*/#discountedFcf = [];
    
    /**@type {number}*/ #fairValue = 0.0;
    /**@type {number}*/ #fvAfterMarginOfSafety = 0.0;

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

        //validate ticker - see TickerService fetch
        //validate source - see fetchData switch

        //validate date
        /**@type {Date}*/let nowDT = new Date(Date.now());
        /**@type {Date}*/let curDT;
        if (datepart.trim() == ''){
            curDT = nowDT;
        }
        else {
            curDT = new Date(`${datepart} ${nowDT.getHours()}:${nowDT.getMinutes()}:${nowDT.getSeconds()}`);  //GMT-5:00
        }

        //TODO: disregard if source=file
        if (curDT.toString() == 'Invalid Date') {throw Error(`Date '${datepart}' must be of format: yyyy-mm-dd`);}
        if (!this.#isBusinessDay(curDT, hd)){throw Error(`Date '${curDT}' must be a business day`);}
        if (!this.#isDateInPast(curDT)){throw Error(`Date '${curDT}' must have a market close`);}

        //convert date back to yyyy-mm-dd string
        /**@type {number}*/ let year = curDT.getFullYear();
        /**@type {string}*/ let month = curDT.getMonth() + 1 < 10 ? "0" + (curDT.getMonth() + 1).toString() : curDT.getMonth().toString();
        /**@type {string}*/ let day = curDT.getDate() < 10 ? "0" + curDT.getDate().toString() : curDT.getDate().toString();
        this.#datePart = `${year}-${month}-${day}`;

        //validate file
        //test file exist - see FileService readFile
        /**@type {RegExp}*/ let pattern = /^file$/i
        if (pattern.test(source) && filepath.trim() == ''){  //TODO?: set source="file"
            throw Error('Must enter filepath');  
        }

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
    get datePart(){
        return this.#datePart;
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

${this.ticker} (source: ${this.source}, ${this.datePart})
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
                //await this.#tickerData_File(this.#filePath);
                await this.#tickerData(new FileService(this.#filePath));
                break;
            case 'YahooFinance':
            case 'Polygon':
                throw Error(`Source '${this.source}' Not implemented`);
                break;
            case 'AlphaVantage':
                await this.#tickerData(new AlphaVantageService(this.ticker, apiKeys.av, this.#datePart));                
                break;
            default:
                await this.#tickerData_AlphaVantage(this.ticker, apiKeys.av, this.#datePart);
        }
        console.log(this.toString());
    }    

    async #tickerData_File(ticker){
    //async #tickerData_File(path){
        //const tickerSymbol = new FileService(path);
        //const data = await tickerSymbol.parseFile();
        const data = await ticker.fetchAllData();        
        //console.log(data);

        this.#closingPrice = parseFloat(data.close);
        this.#marketCap = parseInt(data.market_cap);
        this.#sharesOutstanding = parseInt(data.shares);
        this.#beta = parseFloat(data.beta);   
        this.#pretaxIncome = parseInt(data.pretax_income) > 0 ? parseInt(data.pretax_income) : 0;
        this.#incomeTax = parseInt(data.income_tax) > 0 ? parseInt(data.income_tax) : 0;
        this.#interestExpense = parseInt(data.interest_expense) > 0 ? parseInt(data.interest_expense) : 0;
        this.#totalDebt = parseInt(data.total_debt);
        this.#freeCashflows = data.free_cash_flows.map(val => parseInt(val) > 0 ? parseInt(val) : 0);  //XXX: remove negatives; may cause div/0
    }

    async #tickerData(ticker){
        const data = await ticker.fetchAllData();
        //console.log(data);

        this.#closingPrice = parseFloat(data.close);
        this.#marketCap = parseInt(data.market_cap);
        this.#sharesOutstanding = parseInt(data.shares);
        this.#beta = parseFloat(data.beta);   
        this.#pretaxIncome = parseInt(data.pretax_income) > 0 ? parseInt(data.pretax_income) : 0;
        this.#incomeTax = parseInt(data.income_tax) > 0 ? parseInt(data.income_tax) : 0;
        this.#interestExpense = parseInt(data.interest_expense) > 0 ? parseInt(data.interest_expense) : 0;
        this.#totalDebt = parseInt(data.total_debt);
        this.#freeCashflows = data.free_cash_flows.map(val => parseInt(val) > 0 ? parseInt(val) : 0);  //XXX: remove negatives; may cause div/0
    }

    async #tickerData_AlphaVantage(ticker, apikey, date){
        const tickerSymbol = new AlphaVantageService(ticker, apikey, date);

        const data = await Promise.all([
            tickerSymbol.lastClosePrice(date),
            tickerSymbol.shareAttributes(),
            tickerSymbol.fromIncomeStmt(),
            tickerSymbol.fromBalSheet(),
            tickerSymbol.fromCashflowStmt()
        ]);

        //func 1
        this.#closingPrice = parseFloat(data[0].close);
        //func 2
        this.#marketCap = parseInt(data[1].market_cap);
        this.#sharesOutstanding = parseInt(data[1].shares);
        this.#beta = parseFloat(data[1].beta);   
        //func 3
        this.#pretaxIncome = parseInt(data[2].pretax_income) > 0 ? parseInt(data[2].pretax_income) : 0;
        this.#incomeTax = parseInt(data[2].income_tax) > 0 ? parseInt(data[2].income_tax) : 0;
        this.#interestExpense = parseInt(data[2].interest_expense) > 0 ? parseInt(data[2].interest_expense) : 0;
        //func 4
        this.#totalDebt = parseInt(data[3].total_debt);
        //func 5
        this.#freeCashflows = data[4].map(val => parseInt(val) > 0 ? parseInt(val) : 0);  //XXX: remove negatives; may cause div/0
        
    }

}

