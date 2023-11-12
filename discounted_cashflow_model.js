import { dcfModelConfig } from './config.js';
import TickerService from './ticker_service.js';

export default class DiscountedCashFlowModel {

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
    #freeCashflows = [];  //if fcf<0, fcf=0

    //TODO: 
    //cast and check types
    //validate parameters

    constructor(ticker, source="AlphaVantage", date=''){
        this.#riskFreeRate = dcfModelConfig.riskFreeRate;
        this.#marketRate = dcfModelConfig.marketRate;
        this.#terminalGrowthRate = dcfModelConfig.terminalGrowthRate;
        this.#marginOfSafety = dcfModelConfig.marginOfSafety;
        this.#durationYears = dcfModelConfig.durationYears;

        this.#source = source;
        this.#ticker = ticker;

        if (date == ''){
            this.#curDate = this.#latestDate(new Date());  //default date      
        }
        else{  //XXX: date must be yyyy-mm-dd 
            this.#curDate = this.#latestDate(new Date(date + 'T09:31'));
        }

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
last close:       ${this.closingPrice}
market cap:       ${this.marketCap}
shares:           ${this.sharesOutstanding}
beta:             ${this.beta}
pretax income:    ${this.pretaxIncome}
income tax:       ${this.incomeTax}
total debt:       ${this.totalDebt}
interest expense: ${this.interestExpense}
free cash flows:  ${this.freeCashflows.toString()}
`;
    }

    testDates(){
        const dates = [new Date('2023-01-01T09:30'),new Date('2023-04-01T09:30'),new Date('2023-09-02T09:30'),new Date('2023-09-03T09:30'),new Date()];
        for (let d in dates){
            console.log(dates[d]);
            let date = this.#latestDate(dates[d]);
            console.log(date);
        }
    }

    #latestDate(d){
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
                await this.#tickerData_AlphaVantage(this.ticker);
                break;
            default:
                await this.#tickerData_AlphaVantage(this.ticker);
        }
        console.log(this.toString());
    }    

    async #tickerData_AlphaVantage(){
        const ticker = new TickerService(this.ticker);

        /*sequential fetch data calls
        let data = await ticker.lastClosePrice(this.curDate);
        this.#closingPrice = data.close;
        data = await ticker.shareAttributes();
        this.#marketCap = parseInt(data["market cap"]);
        this.#sharesOutstanding = parseInt(data.shares);
        this.#beta = parseFloat(data.beta);        
        data = await ticker.fromIncomeStmt();
        this.#pretaxIncome = parseInt(data["pretax income"]);
        this.#incomeTax = parseInt(data["income tax"]);
        this.#interestExpense = parseInt(data["interest expense"]);
        data = await ticker.fromBalSheet();
        this.#totalDebt = parseInt(data["total debt"]);
        data = await ticker.fromCashflowStmt();
        this.#freeCashflows = data;
        */

        const data = await Promise.all([
            ticker.lastClosePrice(this.curDate),
            ticker.shareAttributes(),
            ticker.fromIncomeStmt(),
            ticker.fromBalSheet(),
            ticker.fromCashflowStmt()
        ]);

        //func 1
        this.#closingPrice = data[0].close;
        //func 2
        this.#marketCap = parseInt(data[1]["market cap"]);
        this.#sharesOutstanding = parseInt(data[1].shares);
        this.#beta = parseFloat(data[1].beta);   
        //func 3
        this.#pretaxIncome = parseInt(data[2]["pretax income"]);
        this.#incomeTax = parseInt(data[2]["income tax"]);
        this.#interestExpense = parseInt(data[2]["interest expense"]);
        //func 4
        this.#totalDebt = parseInt(data[3]["total debt"]);
        //func 5
        this.#freeCashflows = data[4];
    }

}

