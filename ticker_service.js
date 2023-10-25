import fetch from 'node-fetch';
import { alpha_vantage } from './apikey.js';


export default class TickerService {

    constructor(ticker){
        this.ticker = ticker;
        this.baseUrl = `https://www.alphavantage.co/query?apikey=${alpha_vantage}&symbol=${ticker}&function=`;
    }

    testDates(){
        const dates = [new Date('2023-01-01'),new Date('2023-04-01'),new Date('2023-09-02'),new Date('2023-09-03'),new Date()];
        for (let d in dates){
            console.log(dates[d]);
            let date = this.latestDate(dates[d]);
            console.log(date);
        }
    }

    testMain(){

        // (async() => {
        //     console.log(JSON.stringify(await lastClosePrice()));
        //     console.log(JSON.stringify(await shareAttributes()));
        //     console.log(JSON.stringify(await fromIncomeStmt()));
        //     console.log(JSON.stringify(await fromBalSheet()));
        //     console.log(JSON.stringify(await fromCashflowStmt()));
        // })()

        this.lastClosePrice()
        .then((data) => { console.log(JSON.stringify(data))});

        this.shareAttributes()
        .then((data) => { console.log(JSON.stringify(data))});

        this.fromIncomeStmt()
        .then((data) => { console.log(JSON.stringify(data))});

        this.fromBalSheet()
        .then((data) => { console.log(JSON.stringify(data))});

        this.fromCashflowStmt()
        .then((data) => { console.log(JSON.stringify(data))});
    }

    async lastClosePrice() {
        //FIXME: need to consider previous day if before today's close
        let date = latestDate(new Date());
        const func = "TIME_SERIES_DAILY"
        let url = this.baseUrl + func
        try {
            const response = await fetch(url);
            //console.log(`response status: ${response.status} /${response.ok}`)
            if (!response.ok){
                throw new HTTPResponseError(response);
            }
            const data = await response.json();
            //console.log(`close: ${data["Time Series (Daily)"][date]["4. close"]}`);
            return {close: data["Time Series (Daily)"][date]["4. close"]};
        }
        catch (err){
            console.error(err);
        }
    }

    async shareAttributes(){
        const func = "OVERVIEW";
        let url = this.baseUrl + func
        try {
            const response = await fetch(url);
            if (!response.ok){
                throw new HTTPResponseError(response);
            }
            const data = await response.json();
            // console.log(`market cap: ${data["MarketCapitalization"]}`);
            // console.log(`shares: ${data["SharesOutstanding"]}`);
            // console.log(`beta: ${data["Beta"]}`);
            return {
                "market cap": data["MarketCapitalization"],
                shares: data["SharesOutstanding"],
                beta: data["Beta"]
            };
        }
        catch (err){
            console.error(err);
        }
    }

    async fromIncomeStmt(){
        const func = "INCOME_STATEMENT";
        let url = this.baseUrl + func
        try {
            const response = await fetch(url);
            if (!response.ok){
                throw new HTTPResponseError(response);
            }
            const data = await response.json();
            // console.log(`fiscal year end: ${data["annualReports"][0].fiscalDateEnding}`);  //0: most recent year
            // console.log(`pretax income: ${data["annualReports"][0].incomeBeforeTax}`);  
            // console.log(`income tax: ${data["annualReports"][0].incomeTaxExpense}`);  
            // console.log(`interest expense: ${data["annualReports"][0].interestExpense}`);  
            return {
                "fiscal year end": data["annualReports"][0].fiscalDateEnding,
                "pretax income": data["annualReports"][0].incomeBeforeTax,
                "income tax": data["annualReports"][0].incomeTaxExpense,
                "interest expense": data["annualReports"][0].interestExpense
            }
        }
        catch (err){
            console.error(err);
        }
    }

    async fromBalSheet(){
        const func = "BALANCE_SHEET";
        let url = this.baseUrl + func
        try {
            const response = await fetch(url);
            if (!response.ok){
                throw new HTTPResponseError(response);
            }
            const data = await response.json();
            // console.log(`fiscal year end: ${data["annualReports"][0].fiscalDateEnding}`);  //0: most recent year
            // console.log(`total debt: ${data["annualReports"][0].longTermDebt}`);  
            return {
                "fiscal year end": data["annualReports"][0].fiscalDateEnding,
                "total debt": data["annualReports"][0].longTermDebt
            }
        }
        catch (err){
            console.error(err);
        }
    }

    async fromCashflowStmt(){
        const func = "CASH_FLOW";
        let url = this.baseUrl + func
        const fcf = [];
        try {
            const response = await fetch(url);
            if (!response.ok){
                throw new HTTPResponseError(response);
            }
            const data = await response.json();
            const reports = data["annualReports"];  //"should" be 5 years of reports
            for (let i=0;i<reports.length;i++){  
                // console.log(`fiscal year end: ${data["annualReports"][i].fiscalDateEnding}`);  //0: most recent year
                // console.log(`op cash flow: ${data["annualReports"][i].operatingCashflow}`);  
                // console.log(`capex: ${data["annualReports"][i].capitalExpenditures}`);  
                // console.log(`fcf: ${data["annualReports"][i].operatingCashflow - data["annualReports"][i].capitalExpenditures}`);  
                fcf.push(data["annualReports"][i].operatingCashflow - data["annualReports"][i].capitalExpenditures);
            }
            return fcf;
        }
        catch (err){
            console.error(err);
        }
    }

    latestDate(d){
        let day = d.getDay();
        let date = d.getDate();
        let month = d.getMonth() + 1;
        let year = d.getFullYear();

        if (day == 6){
            date--;
        }
        else if (day == 0){
            date = date - 2;
        }

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

        date = date.toString();
        if (date.length == 1){
            date = "0" + date;
        }

        month = month.toString();
        if (month.length == 1){
            month = "0" + month;
        }

        return `${year}-${month}-${date}`;
    }

}

