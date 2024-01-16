// @ts-check

import fetch from 'node-fetch';

export default class AlphaVantageService {
  /**
   *
   * @param {string} ticker
   * @param {string} apiKey
   * @param {string} isoDatePart
   */
  constructor(ticker, apiKey, isoDatePart) {
    this.ticker = ticker;
    this.baseUrl = `https://www.alphavantage.co/query?apikey=${apiKey}&symbol=${ticker}&function=`;
    this.isoDatePart = isoDatePart;
  }

  /**
   * 
   * @param {string} [datePart] 
   * @typedef {Object} TickerData
   * @property {string | undefined} close
   * @property {string | undefined} market_cap
   * @property {string | undefined} shares
   * @property {string | undefined} beta
   * @property {string | undefined} pretax_income
   * @property {string | undefined} income_tax
   * @property {string | undefined} interest_expense
   * @property {string | undefined} total_debt
   * @property {string[] | undefined} free_cash_flows //order is newest to oldest
   * @returns {Promise<TickerData>}
   */
  async fetchAllData(datePart=this.isoDatePart){

    const data = await Promise.all([
        this.lastClosePrice(datePart),
        this.shareAttributes(),
        this.fromIncomeStmt(),
        this.fromBalSheet(),
        this.fromCashflowStmt()
    ]);

    return {
      close: data[0]?.close,
      market_cap: data[1]?.market_cap,
      shares: data[1]?.shares,
      beta: data[1]?.beta,
      pretax_income: data[2]?.pretax_income,
      income_tax: data[2]?.income_tax,
      interest_expense: data[2]?.interest_expense,
      total_debt: data[3]?.total_debt,
      free_cash_flows: data[4]
    }    
}

  /**
   *
   * @param {string} datePart
   * @returns {Promise<{close: string} | undefined>}
   */
  async lastClosePrice(datePart=this.isoDatePart) {
    /**@type {string}*/ const func = "TIME_SERIES_DAILY";
    /**@type {string}*/ let url = this.baseUrl + func;
    try {
      /**@type {any}*/ const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any}*/ const data = await response.json();

      if(data['Error Message'] != undefined || Object.keys(data).length == 0){
        throw Error(`Ticker '${this.ticker}' does not exist`);
      }

      if (data["Time Series (Daily)"][datePart] == undefined) {
        throw new RangeError();
      }

      return { close: data["Time Series (Daily)"][datePart]["4. close"] };

    } catch (err) {
      if (err instanceof RangeError) {
        console.log(`DATE '${datePart}' does not exist.`);
      } else {
        console.error(err);
      }
    }
  }

  /**
   *
   * @returns {Promise<{
   *        market_cap: string,
   *        shares: string,
   *        beta: string
   *    } | undefined>
   * }
   */
  async shareAttributes() {
    /**@type {string}*/ const func = "OVERVIEW";
    /**@type {string}*/ let url = this.baseUrl + func;
    try {
      /**@type {any}*/ const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any} */ const data = await response.json();
      if(data['Error Message'] != undefined || Object.keys(data).length == 0){
        throw Error(`Ticker '${this.ticker}' does not exist`);
      }

      return {
        market_cap: data["MarketCapitalization"],
        shares: data["SharesOutstanding"],
        beta: data["Beta"],
      };

    } catch (err) {
      console.error(err);
    }
  }

  /**
   *
   * @returns {Promise<{
   *        fiscal_year_end: string,
   *        pretax_income: string,
   *        income_tax: string,
   *        interest_expense: string
   *    } | undefined>
   * }
   */
  async fromIncomeStmt() {
    /**@type {string}*/ const func = "INCOME_STATEMENT";
    /**@type {string}*/ let url = this.baseUrl + func;
    try {
      /**@type {any}*/ const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any}*/ const data = await response.json();
      if(data['Error Message'] != undefined || Object.keys(data).length == 0){
        throw Error(`Ticker '${this.ticker}' does not exist`);
      }      
      return {
        fiscal_year_end: data["annualReports"][0].fiscalDateEnding,
        pretax_income: data["annualReports"][0].incomeBeforeTax,
        income_tax: data["annualReports"][0].incomeTaxExpense,
        interest_expense: data["annualReports"][0].interestExpense,
      };

    } catch (err) {
      console.error(err);
    }
  }

  /**
   *
   * @returns {Promise<{
   *        fiscal_year_end: string,
   *        total_debt: string
   *    } | undefined>
   * }
   */
  async fromBalSheet() {
    /**@type {string}*/ const func = "BALANCE_SHEET";
    /**@type {string}*/ let url = this.baseUrl + func;
    try {
      /**@type {any}*/ const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /**@type {any}*/ const data = await response.json();
      if(data['Error Message'] != undefined || Object.keys(data).length == 0){
        throw Error(`Ticker '${this.ticker}' does not exist`);
      }

      return {
        fiscal_year_end: data["annualReports"][0].fiscalDateEnding,
        total_debt: data["annualReports"][0].longTermDebt,
      };
      
    } catch (err) {
      console.error(err);
    }
  }

  /**
   *
   * @returns {Promise<string[] | undefined>}
   * order is newest to oldest
   */
  async fromCashflowStmt() {
    /**@type {string}*/ const func = "CASH_FLOW";
    /**@type {string}*/ let url = this.baseUrl + func;
    try {
      /**@type {any}*/ const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /**@type {any}*/ const data = await response.json();
      if(data['Error Message'] != undefined || Object.keys(data).length == 0){
        throw Error(`Ticker '${this.ticker}' does not exist`);
      }      
      
      //const reports = data["annualReports"]; //"should" be 5 years of reports
      //const reports = data["quarterlyReports"];  //"should" be 20 quarters of reports
      const reports = data['annualReports'].map((/**@type {Object}*/period) => (period.operatingCashflow-period.capitalExpenditures).toString());
      return reports;
    } catch (err) {
      console.error(err);
    }
  }
}

