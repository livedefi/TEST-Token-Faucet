import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

// WalletConnect Project ID (required). Set WALLETCONNECT_PROJECT_ID in your environment.
const projectId = import.meta.env.WALLETCONNECT_PROJECT_ID ?? 'CHANGE_ME';

// Optional: custom RPC transport for Sepolia (Alchemy/QuickNode URL)
const sepoliaRpc = import.meta.env.SEPOLIA_RPC_URL;

const transports: Record<number, ReturnType<typeof http>> = {};
if (sepoliaRpc) transports[sepolia.id] = http(sepoliaRpc);

export const config = getDefaultConfig({
  appName: 'TEST Token',
  projectId,
  chains: [sepolia],
  ssr: false,
  transports: Object.keys(transports).length ? transports : undefined,
});

export default config;