import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, arbitrum, base, optimism, sepolia } from "wagmi/chains";
import { defineChain } from "viem";

export const berachain = defineChain({
  id: 80094,
  name: "Berachain",
  nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.berachain.com"] },
  },
  blockExplorers: {
    default: { name: "Berascan", url: "https://berascan.com" },
  },
});

export const config = getDefaultConfig({
  appName: "Olympus Emergency Shutdown",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [mainnet, arbitrum, base, berachain, optimism, sepolia],
});
