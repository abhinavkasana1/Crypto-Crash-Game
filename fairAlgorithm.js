// services/fairAlgorithm.js
const CryptoJS = require('crypto-js');

// Generates a random string to be used as a seed
const generateSeed = () => {
  return CryptoJS.lib.WordArray.random(32).toString(); // 32 bytes for a strong seed
};

// Generates a random client seed (can be input by player later)
const generateClientSeed = () => {
  return CryptoJS.lib.WordArray.random(16).toString(); // Shorter for client side
};

// Generates a random salt for each round
const generateSalt = () => {
  return CryptoJS.lib.WordArray.random(8).toString(); // 8 bytes for salt
};

// Computes the crash point based on server seed, client seed, and nonce/round number
// Follows a common provably fair implementation pattern for crash games
const calculateCrashPoint = (serverSeed, clientSeed, nonce, maxCrash = 100) => {
  // Combine all inputs and hash using HMAC-SHA256
  const hash = CryptoJS.HmacSHA256(`${serverSeed}-${clientSeed}-${nonce}`, serverSeed).toString();

  // Convert the hash (hex string) to a decimal number
  const h = parseInt(hash.substring(0, 8), 16); // Take first 8 chars for a number

  // A common method to get a value between 0 and 1 from a hash
  // This avoids bias towards 0 that simple modulo might have
  const e = 1 - (h / Math.pow(2, 32)); // Value between 0 and 1 (exclusive of 1)

  // Calculate crash point:
  // (maxCrash - 1) makes crash range from 1 to maxCrash
  // Example: 1 / e * (maxCrash - 1)
  // Or, a simpler formula commonly used is 99 / (1 - hash_value / (2^32))
  // For simplicity and to match common crash game logic:
  let crash = Math.floor((100 / (1 - e))) / 100; // Multiplier often is 1.00 minimum

  // Ensure minimum crash point, e.g., 1.01x if hash results in something too low
  if (crash < 1.01) {
      crash = 1.01;
  }

  return parseFloat(crash.toFixed(2));
};

module.exports = {
  generateSeed,
  generateClientSeed,
  generateSalt,
  calculateCrashPoint
};