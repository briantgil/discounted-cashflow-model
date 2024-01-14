// @ts-check

import fs from "fs";

export default class FileService {
  /**
   *
   * @param {string} filepath
   */
  constructor(filepath) {
    this.file = filepath;
  }

  /**
   *
   * @returns {Object}
   */
  parseFile() {
    /**
     * @typedef {Object} tickerData
     * @property {string} market_cap
     * @property {string} outstanding_shares
     * @property {string} beta
     * @property {string} pretax_income
     * @property {string} income_tax
     * @property {string} total_debt
     * @property {string} interest_expense
     * @property {string[]} free_cash_flows //order is newest to oldest
     * @property {string} ticker
     * @property {string} date
     */
    const tickerData = {};

    //file has colon-separated key-value pair per line 
    fs.readFile(this.file, "utf-8", (err, data) => {
      data
        .trim()
        .split("\n")
        .forEach((line) => {
          let [k, v] = line.split(":");
          //console.log(`${k}-${v}`);
          tickerData[k] = v;
        });
    });

    return tickerData;
  }
}
