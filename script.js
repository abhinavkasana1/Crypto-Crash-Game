// public/script.js
const ws = new WebSocket(`ws://${location.host}`);
let cashedOutThisRound = false;
let currentPlayerId = null; // To store a simple player ID for testing

// --- UI Elements ---
const priceDisplay = document.getElementById('price');
const multiplierDisplay = document.getElementById('multiplier');
const cashoutButton = document.getElementById('cashout');
const registerButton = document.getElementById('registerPlayer');
const balanceDisplay = document.getElementById('balance');
const betInput = document.getElementById('betAmount');
const currencySelect = document.getElementById('betCurrency');
const placeBetButton = document.getElementById('placeBet');
const notificationsDiv = document.getElementById('notifications');
const roundInfoDiv = document.getElementById('roundInfo');

// --- Helper Functions ---
const addNotification = (message, type = 'info') => {
  const p = document.createElement('p');
  p.innerText = message;
  p.classList.add(type);
  notificationsDiv.prepend(p); // Add to top
  // Limit notifications
  if (notificationsDiv.children.length > 5) {
    notificationsDiv.removeChild(notificationsDiv.lastChild);
  }
};

const updatePlayerBalanceUI = async () => {
  if (!currentPlayerId) return;
  try {
    const response = await fetch(`/api/players/${currentPlayerId}/balance`);
    const data = await response.json();
    if (response.ok) {
      balanceDisplay.innerHTML = `
        Your Balance: <br>
        BTC: $${data.balanceUSD.BTC ? data.balanceUSD.BTC.toFixed(2) : 'N/A'} (${data.balanceCrypto.BTC ? data.balanceCrypto.BTC.toFixed(8) : 'N/A'} BTC)<br>
        ETH: $${data.balanceUSD.ETH ? data.balanceUSD.ETH.toFixed(2) : 'N/A'} (${data.balanceCrypto.ETH ? data.balanceCrypto.ETH.toFixed(8) : 'N/A'} ETH)
      `;
    } else {
      addNotification(`Failed to fetch balance: ${data.message}`, 'error');
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
    addNotification('Network error while fetching balance.', 'error');
  }
};

// --- WebSocket Message Handler ---
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);

  if (data.type === 'PRICE') {
    priceDisplay.innerText = `Current BTC Price: $${data.price ? data.price.toFixed(2) : 'Loading...'}`;
  } else if (data.type === 'ROUND_START') {
    addNotification(`New round started! Crash Point: x${data.crashPoint}. Round ID: ${data.roundId}`, 'info');
    roundInfoDiv.innerHTML = `Round ID: ${data.roundId}<br>Provably Fair Details:<br>
                              Server Seed: ${data.serverSeed}<br>Client Seed (Salt): ${data.clientSeed}<br>Nonce: ${data.nonce}`;
    multiplierDisplay.innerText = `x1.00`;
    multiplierDisplay.classList.remove('crash');
    cashoutButton.disabled = false;
    placeBetButton.disabled = false;
    cashedOutThisRound = false; // Reset for new round
  } else if (data.type === 'UPDATE') {
    if (!cashedOutThisRound) { // Only update if not cashed out
      multiplierDisplay.innerText = `x${data.multiplier.toFixed(2)}`;
      multiplierDisplay.classList.remove('crash');
    }
  } else if (data.type === 'CRASH') {
    multiplierDisplay.innerText = `💥 x${data.crashPoint.toFixed(2)}`;
    multiplierDisplay.classList.add('crash');
    addNotification(`Game CRASHED at x${data.crashPoint.toFixed(2)}!`, 'error');
    cashoutButton.disabled = true;
    placeBetButton.disabled = true;
    updatePlayerBalanceUI(); // Update balance to reflect losses/wins from previous round
  } else if (data.type === 'CASHOUT_SUCCESS') {
    addNotification(`Cashed out successfully at x${data.cashOutMultiplier}! Won ${data.payoutCrypto} ${data.currency} ($${data.payoutUSD}). New ${data.currency} Balance: ${data.newBalanceCrypto} ($${data.newBalanceUSD})`, 'success');
    cashoutButton.disabled = true; // Disable cashout after successful cashout
    cashedOutThisRound = true; // Set flag to stop further multiplier updates
    multiplierDisplay.innerText = `✅ x${data.cashOutMultiplier.toFixed(2)}`; // Show confirmation
    updatePlayerBalanceUI();
  } else if (data.type === 'PLAYER_CASHOUT') {
      addNotification(`Player ${data.playerId} cashed out at x${data.cashOutPoint} for $${data.payoutUSD}!`, 'warning');
  } else if (data.type === 'ERROR') {
    addNotification(`Error: ${data.message}`, 'error');
  }
};

// --- Event Listeners ---
registerButton.addEventListener('click', async () => {
    const username = prompt("Enter a username to register:");
    if (!username) return;

    try {
        const response = await fetch('/api/players/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        if (response.ok) {
            currentPlayerId = data.playerId;
            addNotification(`Player ${data.username} registered! Your Player ID: ${currentPlayerId}`, 'success');
            registerButton.disabled = true; // Disable after registration
            await updatePlayerBalanceUI(); // Fetch initial balance
        } else {
            addNotification(`Registration failed: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Registration network error:', error);
        addNotification('Network error during registration.', 'error');
    }
});

placeBetButton.addEventListener('click', async () => {
  if (!currentPlayerId) {
    addNotification('Please register or log in first.', 'error');
    return;
  }
  const betAmount = parseFloat(betInput.value);
  const currency = currencySelect.value;

  if (isNaN(betAmount) || betAmount <= 0) {
    addNotification('Please enter a valid positive bet amount.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/game/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: currentPlayerId, usdAmount: betAmount, currency })
    });
    const data = await response.json();
    if (response.ok) {
      addNotification(`Bet of $${betAmount} in ${currency} placed! Converted to ${data.cryptoAmount} ${currency}.`, 'success');
      placeBetButton.disabled = true; // Disable bet button after placing bet for the round
      await updatePlayerBalanceUI(); // Update balance immediately after bet
    } else {
      addNotification(`Bet failed: ${data.message}`, 'error');
    }
  } catch (error) {
    console.error('Bet network error:', error);
    addNotification('Network error during bet placement.', 'error');
  }
});

cashoutButton.addEventListener('click', () => {
  if (!currentPlayerId) {
    addNotification('Please register or log in first to cash out.', 'error');
    return;
  }
  if (cashedOutThisRound) {
      addNotification('You have already cashed out this round.', 'warning');
      return;
  }
  if (!multiplierDisplay.innerText.startsWith('x')) { // Basic check if game is active
      addNotification('Game is not active or has crashed.', 'error');
      return;
  }

  // Send cashout request to server via WebSocket
  ws.send(JSON.stringify({
    type: 'CASHOUT_REQUEST',
    playerId: currentPlayerId,
    roundId: roundInfoDiv.innerText.match(/Round ID: (\w+)/)?.[1] // Extract round ID
  }));
});

// Initial load: Try to get player ID from local storage if previously set
window.onload = () => {
    const storedPlayerId = localStorage.getItem('currentPlayerId');
    if (storedPlayerId) {
        currentPlayerId = storedPlayerId;
        registerButton.disabled = true;
        updatePlayerBalanceUI();
        addNotification(`Resumed as Player ID: ${currentPlayerId}`, 'info');
    } else {
        addNotification('Please register to start playing.', 'info');
    }
};

// Save player ID to local storage on successful registration
registerButton.addEventListener('click', async () => { /* ... (existing registration logic) */
    const username = prompt("Enter a username to register:");
    if (!username) return;

    try {
        const response = await fetch('/api/players/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        if (response.ok) {
            currentPlayerId = data.playerId;
            localStorage.setItem('currentPlayerId', currentPlayerId); // Store it
            addNotification(`Player ${data.username} registered! Your Player ID: ${currentPlayerId}`, 'success');
            registerButton.disabled = true;
            await updatePlayerBalanceUI();
        } else {
            addNotification(`Registration failed: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Registration network error:', error);
        addNotification('Network error during registration.', 'error');
    }
});