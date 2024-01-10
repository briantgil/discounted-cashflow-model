// @ts-check

import fetch from 'node-fetch';

export default class TickerService {
  /**
   *
   * @param {string} ticker
   * @param {string} apiKey
   */
  constructor(ticker, apiKey) {
    this.ticker = ticker;
    this.baseUrl = `https://www.alphavantage.co/query?apikey=${apiKey}&symbol=${ticker}&function=`;
  }

  /**
   *
   * @param {string} date
   * @returns {Promise<{close: string} | undefined>}
   */
  async lastClosePrice(date) {
    const func = "TIME_SERIES_DAILY";
    let url = this.baseUrl + func;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any}*/ const data = await response.json();
      if (data["Time Series (Daily)"][date] == undefined) {
        throw new RangeError();
      }
      return { close: data["Time Series (Daily)"][date]["4. close"] };

    } catch (err) {
      if (err instanceof RangeError) {
        console.log(`DATE '${date}' does not exist.`);
      } else {
        console.error(err);
      }
    }
  }

  /**
   *
   * @returns {Promise<{
   *        "market cap": string,
   *        shares: string,
   *        beta: string
   *    } | undefined>
   * }
   */
  async shareAttributes() {
    const func = "OVERVIEW";
    let url = this.baseUrl + func;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any}*/ const data = await response.json();
      return {
        "market cap": data["MarketCapitalization"],
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
   *        "fiscal year end": string,
   *        "pretax income": string,
   *        "income tax": string,
   *        "interest expense": string
   *    } | undefined>
   * }
   */
  async fromIncomeStmt() {
    const func = "INCOME_STATEMENT";
    let url = this.baseUrl + func;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any}*/ const data = await response.json();
      return {
        "fiscal year end": data["annualReports"][0].fiscalDateEnding,
        "pretax income": data["annualReports"][0].incomeBeforeTax,
        "income tax": data["annualReports"][0].incomeTaxExpense,
        "interest expense": data["annualReports"][0].interestExpense,
      };

    } catch (err) {
      console.error(err);
    }
  }

  /**
   *
   * @returns {Promise<{
   *        "fiscal year end": string,
   *        "total debt": string
   *    } | undefined>
   * }
   */
  async fromBalSheet() {
    const func = "BALANCE_SHEET";
    let url = this.baseUrl + func;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any} */ const data = await response.json();
      return {
        "fiscal year end": data["annualReports"][0].fiscalDateEnding,
        "total debt": data["annualReports"][0].longTermDebt,
      };
      
    } catch (err) {
      console.error(err);
    }
  }

  /**
   *
   * @returns {Promise<number[] | undefined>}
   */
  async fromCashflowStmt() {
    const func = "CASH_FLOW";
    let url = this.baseUrl + func;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`http status: ${response.status}`);
      }

      /** @type {any} */ const data = await response.json();
      //const reports = data["annualReports"]; //"should" be 5 years of reports
      //const reports = data["quarterlyReports"];  //"should" be 20 quarters of reports
      const reports = data['annualReports'].map(/** @type {string} */ i => i.operatingCashflow-i.capitalExpenditures);
      return reports;
    } catch (err) {
      console.error(err);
    }
  }
}

