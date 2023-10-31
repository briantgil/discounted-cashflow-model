import 'dotenv/config';

const apiKeys = {
                av: process.env.ALPHA_VANTAGE,
                poly: process.env.POLYGON
}

const dcfModelConfig = {
                    riskFreeRate:0.04431, //5yr ust; source: cnbc 
                    marketRate:0.0796, //s&p 500; source: investopedia
                    terminalGrowthRate:0.0293, //gdp; source: world bank 
                    marginOfSafety:0.30,
                    durationYears:5
}

export { dcfModelConfig, apiKeys };

