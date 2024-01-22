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
  async fetchAllData() {
    /**@type {Object}*/ const tickerData = {};

    try {
      //file has colon-separated key-value pair per line 
      const result = await fs.promises.readFile(this.file, "utf-8");  //TODO: close file?
            
      result
        .trim()
        .split("\n")
        .forEach((line) => {
          let [k, v] = line.split(":");
          //console.log(`${k}-${v}`);
          tickerData[k] = v.replaceAll(",", "").replace("\r", "");  
          if (k == 'free_cash_flows'){
            tickerData[k] = tickerData[k].split(" ");  //string[]
          }
          //console.log(tickerData);
        });
    
      //console.log(tickerData);
      return tickerData;  
    }
    catch (err){
      throw Error(err);      
    }   
  }

}
