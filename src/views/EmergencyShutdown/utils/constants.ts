import type { ChainId } from "@/generated/emergency";

export const EXPLORER_URL: Record<ChainId, string> = {
  1: "https://etherscan.io",
  10: "https://optimistic.etherscan.io",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
  80094: "https://berascan.com",
  11155111: "https://sepolia.etherscan.io",
};
