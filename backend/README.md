# Backend (Hardhat)

This backend contains the Solidity smart contracts and tooling to develop, test, deploy, and verify the SimpleToken and TokenFaucet contracts using Hardhat 3 and Ignition.

## Tech stack
- Hardhat 3 with Ignition (deployment engine)
- Solidity 0.8.28 (profiles configured)
- @nomicfoundation/hardhat-toolbox-mocha-ethers (testing)
- @nomicfoundation/hardhat-verify (Etherscan verification)
- dotenv for environment variables

## Prerequisites
- Node.js (LTS) and npm
- A Sepolia RPC endpoint (e.g., Infura, Alchemy, Ankr)
- A funded account private key for deployments
- An Etherscan API key (for verification)

## Installation
1. Open a terminal in this directory:
   cd backend
2. Install dependencies:
   npm install

## Environment variables (.env)
Create a .env file in the backend directory with the following variables:

```ini
# Sepolia RPC (Infura/Alchemy/Ankr, etc.)
SEPOLIA_RPC_URL=https://sepolia.example-rpc-provider.com/v3/YOUR_KEY

# Private key for the deployer account (use a low-balance, dedicated key)
SEPOLIA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

Notes:
- Do not wrap values in quotes.
- Avoid trailing spaces.
- .env is already ignored by Git.

## Compile
Compile contracts:
- npx hardhat compile

## Test
Run the test suite:
- npx hardhat test

## Deploy (Ignition)
Ignition modules define deployment recipes. A FaucetModule is provided to deploy SimpleToken and TokenFaucet together.

Deploy locally (Hardhat in-process network):
- npx hardhat ignition deploy ./ignition/modules/FaucetModule.ts

Deploy to Sepolia:
- npx hardhat ignition deploy ./ignition/modules/FaucetModule.ts --network sepolia

The module initializes the token and faucet with sensible defaults and funds the faucet with an initial token balance.

## Deployed addresses
Network: Sepolia (chainId 11155111)
- SimpleToken: 0xBCACFDD37b69eb826cF64E97bc4eDE7F33341B59
- TokenFaucet: 0x7B07473827BCc65714E2C28856231B3B66Cf2DdF

Note: These addresses correspond to the Sepolia deployment performed via Ignition. If you redeploy, addresses may change. Local (in-memory) deployments produce different, ephemeral addresses.

## Verify contracts (Etherscan)
Ensure ETHERSCAN_API_KEY is set in .env. Then verify each contract with the constructor arguments used at deployment.

SimpleToken (example values used by the module):
- npx hardhat verify --network sepolia <SimpleTokenAddress> "Test Token" "TEST" 10000000000000000000000 100000000000000000000000

TokenFaucet (example values used by the module):
- npx hardhat verify --network sepolia <TokenFaucetAddress> <SimpleTokenAddress> 10000000000000000000 3600 100000000000000000000 1000000000000000000000

Argument mapping:
- SimpleToken(name, symbol, initialSupply, cap) — amounts in wei (18 decimals)
- TokenFaucet(tokenAddress, tokensPerRequest, cooldownTimeSeconds, maxPerAddress, dailyLimit) — amounts in wei

## Troubleshooting
- Missing ETHERSCAN_API_KEY: add it to backend/.env and restart the terminal.
- "Address does not have bytecode": wait ~1–2 minutes; Etherscan may still be indexing.
- Constructor arguments mismatch: pass exactly the values used during deployment (wei for token amounts, seconds for cooldown).
- dotenv loading: the project imports dotenv in hardhat.config.ts, ensure .env is in the backend root.

## Project structure (key paths)
- contracts/: Solidity sources (SimpleToken.sol, TokenFaucet.sol)
- test/: Mocha/Chai tests for contracts
- ignition/modules/: Ignition deployment modules (e.g., FaucetModule.ts)
- hardhat.config.ts: Hardhat configuration (networks, plugins, verification)
- artifacts/, cache/: build outputs

## Security
- Never commit private keys or .env files.
- Use a dedicated deployment key with limited funds.

## License
This repository does not specify a license for the backend at this time.
