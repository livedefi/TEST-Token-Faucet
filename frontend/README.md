# Frontend — Token Faucet (React + Vite + TypeScript)

A modern frontend to interact with an ERC‑20 faucet on the Sepolia network. It lets users connect their wallet, view faucet status and limits, check balances, request tokens, and add the token directly to MetaMask.

## Key features

- Wallet connection with RainbowKit and Wagmi (WalletConnect v2).
- Network detection (Sepolia) with guided messaging when on the wrong network.
- Contract reads: `SimpleToken` (symbol, name, decimals, balanceOf) and `TokenFaucet` (getFaucetBalance, getFaucetConfig, getUserInfo).
- Token requests (`requestTokens`) with state handling (cooldown, paused, per‑address/day limits).
- Reactive updates via the ERC‑20 `Transfer` event watcher.
- “Add token to wallet” button (MetaMask) using `wallet_watchAsset`.
- Clean, professional UI with Tailwind CSS.

## Prerequisites

- Node.js 18+ (LTS recommended) and npm.
- MetaMask (or another wallet compatible with WalletConnect v2).
- Contracts deployed on Sepolia:
  - `SimpleToken` address.
  - `TokenFaucet` address.
- WalletConnect v2 Project ID.
- (Optional) Sepolia RPC URL (if you don’t want to use the default RPC).

## Installation

1. Go to the frontend directory:
   - `cd frontend`
2. Install dependencies:
   - `npm install`

## Environment configuration

Create a `.env` file in the frontend with the following variables:

```
WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/xxx (optional)
SIMPLE_TOKEN_ADDRESS=0x...
TOKEN_FAUCET_ADDRESS=0x...
```

Important notes:
- Vite is configured to automatically expose variables with the prefixes: `WALLETCONNECT_`, `SEPOLIA_`, `SIMPLE_`, and `TOKEN_` (you don’t need the `VITE_` prefix).
- Make sure the addresses start with `0x` and are valid on Sepolia.

## ABIs

ABIs live in `src/abis/`:
- `SimpleToken.json`
- `TokenFaucet.json`

If you re‑deploy contracts or their interfaces change:
- Replace the ABIs with the new ones.
- Update the addresses in `.env`.

## Scripts

- Development: `npm run dev` (starts Vite dev server).
- Production build: `npm run build` (creates the `dist/` folder).
- Build preview: `npm run preview`.
- Lint: `npm run lint`.

## Getting started (development)

1. Ensure `.env` is properly configured.
2. Run `npm run dev`.
3. Open the local URL shown by Vite (default: `http://localhost:5173`).
4. Connect your wallet and make sure you are on Sepolia.

## Usage

- Disconnected screen: you’ll see a message and the “Connect Wallet” button.
- Wrong network: a warning will prompt you to switch to Sepolia (chainId 11155111).
- Connected screen:
  - Faucet status (tokens per request, cooldown, maximums, daily limit, total distributed today).
  - Your balances (faucet and user).
  - Your info (total received, remaining cooldown time if applicable).
  - “Request tokens” button (disabled if faucet is paused, you are in cooldown, or limits are reached).
  - “Add <SYMBOL> to wallet” button (in the header) to add the token to MetaMask.

## Backend coherence

- `.env` must point to contracts deployed on Sepolia.
- ABIs in `src/abis/` must exactly match the deployed contracts.
- `src/web3/config.ts` sets up Wagmi/RainbowKit with Sepolia and your `WALLETCONNECT_PROJECT_ID` (and optionally `SEPOLIA_RPC_URL`).

## Relevant structure

- `src/App.tsx`: Main UI component (faucet status, balances, actions, button to add token to MetaMask).
- `src/web3/config.ts`: Wagmi/RainbowKit configuration and Sepolia chain.
- `src/main.tsx`: React bootstrap, providers, and `App`.
- `src/index.css`: Global styles with Tailwind.
- `src/abis/`: Contract ABIs.

## Troubleshooting

- Environment banner: if `SIMPLE_TOKEN_ADDRESS` or `TOKEN_FAUCET_ADDRESS` are missing, you’ll see a notice in the UI.
- Wrong network: switch to Sepolia from your wallet.
- Error requesting tokens: check the message shown next to the button and confirm you’re not in cooldown, the faucet isn’t paused, and it has available balance.
- WalletConnect: ensure `WALLETCONNECT_PROJECT_ID` is correct.
- RPC: if you have connection issues, try setting `SEPOLIA_RPC_URL` with a reliable provider (Infura/Alchemy/etc.).

## Security and best practices

- Do not share your `.env` file or publish credentials in public repositories.
- Keep ABIs and contract addresses up to date after each deployment.
- Avoid hardcoding secrets in code.

---

If you need the frontend adapted to new requirements (new faucet/token features, more networks, i18n, etc.), let us know and we’ll incorporate them.
