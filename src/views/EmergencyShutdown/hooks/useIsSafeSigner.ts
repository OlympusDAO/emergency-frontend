import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";
import {
  EMERGENCY_ADDRESSES,
  type ChainId,
} from "@/generated/emergency";
import { createSafeApiKit } from "../utils/safeTransaction.ts";

interface SafeSignerResult {
  isEmergencySigner: boolean;
  isDaoSigner: boolean;
  emergencyThreshold: number;
  emergencyOwnerCount: number;
  daoThreshold: number;
  daoOwnerCount: number;
  isLoading: boolean;
  error: Error | null;
}

async function checkSignerStatus(
  chainId: ChainId,
  userAddress: string
): Promise<Omit<SafeSignerResult, "isLoading" | "error">> {
  const addresses = EMERGENCY_ADDRESSES[chainId];
  if (!addresses) {
    return {
      isEmergencySigner: false,
      isDaoSigner: false,
      emergencyThreshold: 0,
      emergencyOwnerCount: 0,
      daoThreshold: 0,
      daoOwnerCount: 0,
    };
  }

  const apiKit = createSafeApiKit(chainId);
  const lowerUser = userAddress.toLowerCase();

  let isEmergencySigner = false;
  let emergencyThreshold = 0;
  let emergencyOwnerCount = 0;

  const emergencyMs = addresses.multisigs.emergency;
  if (emergencyMs) {
    try {
      const info = await apiKit.getSafeInfo(emergencyMs);
      emergencyThreshold = info.threshold;
      emergencyOwnerCount = info.owners.length;
      isEmergencySigner = info.owners.some(
        (o) => o.toLowerCase() === lowerUser
      );
    } catch {
      // Safe may not exist on this chain
    }
  }

  let isDaoSigner = false;
  let daoThreshold = 0;
  let daoOwnerCount = 0;

  const daoMs = addresses.multisigs.dao;
  if (daoMs) {
    try {
      const info = await apiKit.getSafeInfo(daoMs);
      daoThreshold = info.threshold;
      daoOwnerCount = info.owners.length;
      isDaoSigner = info.owners.some((o) => o.toLowerCase() === lowerUser);
    } catch {
      // Safe may not exist on this chain
    }
  }

  return {
    isEmergencySigner,
    isDaoSigner,
    emergencyThreshold,
    emergencyOwnerCount,
    daoThreshold,
    daoOwnerCount,
  };
}

export function useIsSafeSigner(): SafeSignerResult {
  const { address } = useAccount();
  const chainId = useChainId() as ChainId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["safe-signer", chainId, address],
    queryFn: () => checkSignerStatus(chainId, address!),
    enabled: !!address && !!EMERGENCY_ADDRESSES[chainId],
    staleTime: Infinity,
  });

  return {
    isEmergencySigner: data?.isEmergencySigner ?? false,
    isDaoSigner: data?.isDaoSigner ?? false,
    emergencyThreshold: data?.emergencyThreshold ?? 0,
    emergencyOwnerCount: data?.emergencyOwnerCount ?? 0,
    daoThreshold: data?.daoThreshold ?? 0,
    daoOwnerCount: data?.daoOwnerCount ?? 0,
    isLoading,
    error: error as Error | null,
  };
}
