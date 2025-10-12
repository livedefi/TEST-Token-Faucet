# TEST Token Faucet Monorepo (Backend + Frontend)

A compact, professional repository that contains:
- Backend: Hardhat smart contracts and tests for an ERC‑20 token (SimpleToken) and a rate‑limited token faucet (TokenFaucet) on Sepolia.
- Frontend: React + Vite + TypeScript app using Wagmi/RainbowKit to interact with the faucet, request tokens, and view status.

Repository structure
- backend/ — Smart contracts, tests, Hardhat config, deployment modules
  - Read more: [Backend README](./backend/README.md)
- frontend/ — React app (UI, web3 config, ABIs)
  - Read more: [Frontend README](./frontend/README.md)

Prerequisites
- Node.js 18+ and npm
- A Sepolia‑compatible wallet (e.g., MetaMask)
- Sepolia RPC and WalletConnect Project ID (see Frontend README)
- Contract addresses and ABIs (see Backend README)

Quick start
- Install dependencies
  - `cd backend && npm install`
  - `cd ../frontend && npm install`
- Configure environment
  - `backend/.env` (deployment settings, RPC, keys)
  - `frontend/.env` (WalletConnect, RPC, contract addresses)
- Development
  - Backend: compile, test, and deploy — see [Backend README](./backend/README.md)
  - Frontend: run dev server — see [Frontend README](./frontend/README.md)

Live site
- https://test-token-faucet.casaislabs.com/

Notes
- Keep secrets out of version control; never commit `.env` files.
- Ensure frontend ABIs and addresses match the deployed backend contracts.