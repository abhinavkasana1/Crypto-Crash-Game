const axios = require('axios');

let cachedPrice = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 1000; // Cache for 10 seconds

const getCryptoPrice = async () => {
  const now = Date.now();

  if (cachedPrice && (now - lastFetchTime < CACHE_DURATION)) {
    console.log('Using cached BTC price');
    return cachedPrice;
  }

  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');

    if (response.data && response.data.bitcoin && response.data.bitcoin.usd) {
      const price = response.data.bitcoin.usd;
      cachedPrice = price;
      lastFetchTime = now;
      console.log('Fetched new BTC price from CoinGecko:', price);
      return price;
    } else {
      console.error('Error: Unexpected response format from CoinGecko API', response.data);
      return cachedPrice || null;
    }
  } catch (error) {
    console.error('Error fetching BTC price from CoinGecko:', error.message);
    return cachedPrice || null;
  }
};

module.exports = {
  getCryptoPrice,
};