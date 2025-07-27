# Crypto Crash Game Backend

This project implements the backend for an online "Crash" game, where players bet in USD, convert to cryptocurrency, and decide when to cash out before the game "crashes." It integrates with a real-time crypto price API and provides real-time multiplayer updates via WebSockets.

The focus is on backend game logic, simulated cryptocurrency transactions, real-time price integration, and robust WebSocket implementation.

## Table of Contents

* [Features](#features)
* [Technical Stack](#technical-stack)
* [Game Rules](#game-rules)
* [API Endpoints](#api-endpoints)
* [WebSocket Events](#websocket-events)
* [Installation & Setup](#installation--setup)
* [Running the Project](#running-the-project)
* [Testing](#testing)
* [Provably Fair Algorithm](#provably-fair-algorithm)
* [Cryptocurrency Conversion](#cryptocurrency-conversion)
* [Project Structure](#project-structure)
* [Notes](#notes)
* [License](#license)
* [Contact](#contact)

## Features

* **Core Game Logic:** Implements the "Crash" game mechanics with an exponential multiplier and a provably fair crash algorithm.
* **Cryptocurrency Integration:** Fetches real-time crypto prices (e.g., CoinGecko) and handles USD-to-crypto conversions for bets and payouts.
* **Simulated Crypto Wallet:** Manages player balances and simulates on-chain transactions.
* **Real-time Multiplayer:** Uses WebSockets for live updates on game rounds, multiplier changes, player cashouts, and crashes.
* **Data Persistence:** Stores game state, player data, bets, cashouts, and transaction logs in MongoDB.
* **Robustness:** Includes handling for crypto API rate limits/errors, and ensures atomicity for balance updates.

## Technical Stack

* **Language/Framework:** Node.js with Express.js
* **Database:** MongoDB
* **WebSocket Library:** `ws` or `socket.io` (whichever you chose to implement)
* **Crypto API:** A free public crypto API like CoinGecko or CoinMarketCap.

## Game Rules

* A new game round starts every 10 seconds.
* Players place bets in USD, which are converted to a chosen cryptocurrency (e.g., BTC, ETH) based on real-time prices.
* Once the round starts, a multiplier begins at 1x and increases exponentially over time ($$1 + (\text{time\_elapsed} \times \text{growth\_factor})$$).
* The game randomly "crashes" at a multiplier value (e.g., 1.5x, 3x, 10x ... up to 120x) determined by a provably fair algorithm.
* Players can cash out at any time before the crash, earning their bet (in crypto) multiplied by the current multiplier, converted back to USD for display.
* If a player does not cash out before the crash, they lose their bet.
* Game state (bets, cashouts, crash point, player balances) is tracked and stored.

## API Endpoints

The following REST API endpoints are available:

| Method | Endpoint                      | Description                                                  | Request Body / Parameters                                     | Response Example (Simplified)                               |
| :----- | :---------------------------- | :----------------------------------------------------------- | :------------------------------------------------------------ | :---------------------------------------------------------- |
| `GET`  | `/api/player/:playerId/wallet` | Check a player's wallet balance (in crypto and USD equivalent). | `playerId` (path)                                             | `{ cryptoBalance: 0.5, usdEquivalent: 30000, cryptoCurrency: "bitcoin" }` |
| `POST` | `/api/bet`                    | Place a bet in USD, converting to crypto.                    | `{ playerId: "player123", amountUSD: 10, cryptoCurrency: "bitcoin" }` | `{ success: true, message: "Bet placed!", betId: "bet-xyz" }` |
| `POST` | `/api/cashout`                | Process cash out winnings.                                   | `{ playerId: "player123", betId: "bet-xyz" }`                 | `{ success: true, message: "Cashout successful!", payoutUSD: 20 }` |
| `GET`  | `/api/round/current`          | Get the current game round details (status, current multiplier). | None                                                          | `{ roundId: "round-abc", status: "playing", currentMultiplier: 1.55 }` |
| `GET`  | `/api/rounds`                 | Get a list of past game rounds (including crash points for verification). | None                                                          | `[{ roundId: "round-def", crashPoint: 3.12, startTime: "...", endTime: "...", initialSeed: "..." }]` |
| `GET`  | `/api/player/:playerId/transactions` | Get transaction history for a player.                        | `playerId` (path)                                             | `[{ transactionId: "tx-1", type: "bet", cryptoAmount: 0.001, usdEquivalent: 60 }]` |
| `POST` | `/api/player/:playerId/deposit` | Simulate depositing crypto to a player's wallet (for testing). | `{ cryptoAmount: 0.01, cryptoCurrency: "bitcoin" }`           | `{ message: "Deposit successful", newBalance: 0.01 }`       |


## WebSocket Events

The backend uses WebSockets to provide real-time updates to connected clients:

* `roundStart`:
    * **Payload:** `{ roundId: string, startTime: Date }`
    * **Description:** Notifies clients when a new round begins.
* `multiplierUpdate`:
    * **Payload:** `{ multiplier: number }`
    * **Description:** Sends frequent updates (at least every 100ms) on the current multiplier.
* `playerCashout`:
    * **Payload:** `{ playerId: string, cryptoPayout: number, usdEquivalent: number, cashoutMultiplier: number }`
    * **Description:** Notifies all clients when a player successfully cashes out.
* `roundCrash`:
    * **Payload:** `{ roundId: string, crashPoint: number, finalMultiplier: number, initialSeed: string }`
    * **Description:** Notifies all clients when the round crashes, including the final crash point and seed for verification.
* `cashoutRequest`:
    * **Payload (Client to Server):** `{ playerId: string, betId: string }`
    * **Description:** Allows players to send cashout requests during the round.

## Installation & Setup

To set up the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone [YOUR_REPOSITORY_URL]
    cd crypto-crash-game-backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Configuration:**
    Create a `.env` file in the root directory of your project. Copy the contents from `.env.example` and fill in your specific values:
    ```
    PORT=3000
    MONGO_URI=mongodb://localhost:27017/cryptocrash_game
    CRYPTO_API_KEY=YOUR_COINGECKO_API_KEY_HERE
    COINGECKO_BASE_URL=[https://api.coingecko.com/api/v3](https://api.coingecko.com/api/v3)
    GAME_ROUND_INTERVAL_MS=10000
    MULTIPLIER_UPDATE_INTERVAL_MS=100
    MAX_CRASH_MULTIPLIER=120
    PROVABLY_FAIR_SECRET_SEED=aSuperSecretStringForHashing
    ```
    * Ensure your MongoDB instance is running and accessible via the `MONGO_URI`.
    * Obtain a free API key from a service like CoinGecko (though basic CoinGecko public data often doesn't require a key, be mindful of rate limits).

## Running the Project

To start the backend server:

```bash
npm start
