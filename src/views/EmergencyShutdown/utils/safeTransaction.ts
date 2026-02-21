import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import type { ChainId } from "@/generated/emergency";

const SAFE_API_KEY = import.meta.env.VITE_OLYMPUS_SAFE_API_KEY as
  | string
  | undefined;

const CHAIN_PREFIXES: Record<number, string> = {
  1: "eth",
  11155111: "sep",
  42161: "arb1",
  8453: "base",
  10: "oeth",
  80094: "bera",
};

export function createSafeApiKit(chainId: ChainId): SafeApiKit {
  return new SafeApiKit({
    chainId: BigInt(chainId),
    ...(SAFE_API_KEY ? { apiKey: SAFE_API_KEY } : {}),
  });
}

export async function createSafeProtocolKit(
  safeAddress: string,
  provider: string
): Promise<Safe> {
  return Safe.init({
    provider,
    safeAddress,
  });
}

export function getSafeAppUrl(
  chainId: ChainId,
  safeAddress: string,
  safeTxHash: string
): string {
  const prefix = CHAIN_PREFIXES[chainId] ?? "eth";
  return `https://app.safe.global/transactions/tx?safe=${prefix}:${safeAddress}&id=multisig_${safeAddress}_${safeTxHash}`;
}
