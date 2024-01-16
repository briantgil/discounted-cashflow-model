// @ts-check

import fs from "fs";

export default class FileService {

  /**@type {string}*/ file;

  /**
   *
   * @param {string} filepath
   */
  constructor(filepath) {
    this.file = filepath;
  }

  /**
   * @typedef {Object} TickerData
   * @property {string} close
   * @property {string} market_cap
   * @property {string} shares
   * @property {string} beta
   * @property {string} pretax_income
   * @property {string} income_tax
   * @property {string} interest_expense
   * @property {string} total_debt
   * @property {string[]} free_cash_flows //order is newest to oldest
   * @returns {Promise<TickerData>}
   */
  async parseFile() {
    /**@type {Object}*/ const tickerData = {};

    //file has colon-separated key-value pair per line 
    await fs.readFile(this.file, "utf-8", (err, data) => {
      if (err) throw err;  //throw error if file does not exist
      data
        .trim()
        .split("\n")
        .forEach((line) => {
          let [k, v] = line.split(":");
          //console.log(`${k}-${v}`);
          tickerData[k] = v;
          //console.log(tickerData);
        });
    });
    console.log(tickerData);
    return tickerData;  //FIXME: issue with await, maybe use readFileSync
  }
}
