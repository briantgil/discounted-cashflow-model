// @ts-check

import 'dotenv/config';

/**
 * @typedef {Object} ApiKeys
 * @property {string} av
 * @property {string} poly
 */
/** @type {ApiKeys}*/
const apiKeys = {
                av: process.env.ALPHA_VANTAGE != undefined ? process.env.ALPHA_VANTAGE : "",
                poly: process.env.POLYGON != undefined ? process.env.POLYGON : ""
}

/**
 * @typedef {Object} DcfModelConfig
 * @property {number} riskFreeRate - 5yr ust; source: cnbc 
 * @property {number} marketRate - s&p 500; source: investopedia
 * @property {number} terminalGrowthRate - gdp; source: world bank 
 * @property {number} marginOfSafety
 * @property {number} durationYears
 */
/** @type {DcfModelConfig} */
const dcfModelConfig = {
                    riskFreeRate:0.03854, 
                    marketRate:0.0796, 
                    terminalGrowthRate:0.0293, 
                    marginOfSafety:0.30,
                    durationYears:5
}

export { dcfModelConfig, apiKeys };

