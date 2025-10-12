import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("FaucetModule", (m) => {
  // SimpleToken params
  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";
  const INITIAL_SUPPLY = 10_000n * 10n ** 18n; // 10,000 tokens
  const TOKEN_CAP = 100_000n * 10n ** 18n;     // 100,000 tokens

  // TokenFaucet params
  const TOKENS_PER_REQUEST = 10n * 10n ** 18n;   // 10 tokens per request
  const COOLDOWN_TIME = 3600n;                   // 1 hour in seconds
  const MAX_TOKENS_PER_ADDRESS = 100n * 10n ** 18n; // 100 tokens per address
  const DAILY_LIMIT = 1_000n * 10n ** 18n;       // 1,000 tokens per day

  // Deploy SimpleToken
  const simpleToken = m.contract("SimpleToken", [
    TOKEN_NAME,
    TOKEN_SYMBOL,
    INITIAL_SUPPLY,
    TOKEN_CAP,
  ]);

  // Deploy TokenFaucet (passing SimpleToken address)
  const tokenFaucet = m.contract("TokenFaucet", [
    simpleToken,
    TOKENS_PER_REQUEST,
    COOLDOWN_TIME,
    MAX_TOKENS_PER_ADDRESS,
    DAILY_LIMIT,
  ]);

  // Fund the faucet with some tokens
  const FAUCET_SUPPLY = 5_000n * 10n ** 18n; // 5,000 tokens
  m.call(simpleToken, "transfer", [tokenFaucet, FAUCET_SUPPLY]);

  return { simpleToken, tokenFaucet };
});