import TickerService from './ticker_service.js';
import 'dotenv/config';

const apiKeys = {
                av: process.env.ALPHA_VANTAGE,
                poly: process.env.POLYGON
}



const ticker = new TickerService("NVDA", apiKeys.av);
ticker.testMain();


