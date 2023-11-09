import fetch from 'node-fetch';
import { apiKeys } from './config.js';

export default class TickerService {

    constructor(ticker){
        this.ticker = ticker;
        this.baseUrl = `https://www.alphavantage.co/query?apikey=${apiKeys.av}&symbol=${ticker}&function=`;
    }

    testMain(){

        // (async() => {
        //     console.log(JSON.stringify(await lastClosePrice()));
        //     console.log(JSON.stringify(await shareAttributes()));
        //     console.log(JSON.stringify(await fromIncomeStmt()));
        //     console.log(JSON.stringify(await fromBalSheet()));
        //     console.log(JSON.stringify(await fromCashflowStmt()));
        // })()

        this.lastClosePrice(new Date())
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

    async lastClosePrice(date) {
        const func = "TIME_SERIES_DAILY"
        let url = this.baseUrl + func
        try {
            const response = await fetch(url);
            //console.log(`response status: ${response.status} /${response.ok}`)
            if (!response.ok){
                throw new HTTPResponseError(response);
                //throw new Error(`Request failed with status ${response.status}`)
            }
            const data = await response.json();
            //console.log(`close: ${data["Time Series (Daily)"][date]["4. close"]}`);
            if (data["Time Series (Daily)"][date] == undefined){
                throw new RangeError
            }
            return {close: data["Time Series (Daily)"][date]["4. close"]};  
        }
        catch (err){
            if (err instanceof RangeError){
                console.log(`DATE ${date} does not exist.`);
            }
            else {
                console.error(err);
            }
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

}

