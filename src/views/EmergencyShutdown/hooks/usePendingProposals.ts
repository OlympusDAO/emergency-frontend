import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import { toFunctionSelector } from "viem";
import {
  EMERGENCY_ADDRESSES,
  EMERGENCY_COMPONENTS,
  CHAIN_ID_TO_NAME,
  type ChainId,
  type ChainName,
} from "@/generated/emergency";
import { createSafeApiKit, getSafeAppUrl } from "../utils/safeTransaction.ts";

export interface PendingProposal {
  confirmations: number;
  threshold: number;
  safeAppUrl: string;
}

export function usePendingProposals(): {
  pendingProposals: Record<string, PendingProposal>;
  isLoading: boolean;
} {
  const chainId = useChainId() as ChainId;
  const addresses = EMERGENCY_ADDRESSES[chainId];
  const chainName: ChainName | undefined = CHAIN_ID_TO_NAME[chainId];

  const { data, isLoading } = useQuery({
    queryKey: ["pending-proposals", chainId],
    queryFn: async () => {
      if (!addresses || !chainName) return {};

      const chainComponents = EMERGENCY_COMPONENTS.filter((c) =>
        c.availableOn.includes(chainName)
      );

      // Map: lowercase contract address → component entries with function selector
      const contractToComponents: Record<
        string,
        { id: string; owner: string; selector: string }[]
      > = {};

      for (const component of chainComponents) {
        const firstCall = component.calls[0];
        if (!firstCall) continue;
        const contractName = firstCall.contractKey.split(".").pop();
        if (!contractName) continue;
        const addr = addresses.contracts[contractName]?.toLowerCase();
        if (!addr) continue;

        // Compute 4-byte function selector from the call signature
        const selector = toFunctionSelector(`function ${firstCall.signature}`);

        if (!contractToComponents[addr]) contractToComponents[addr] = [];
        contractToComponents[addr].push({
          id: component.id,
          owner: component.owner,
          selector,
        });
      }

      const apiKit = createSafeApiKit(chainId);
      const result: Record<string, PendingProposal> = {};

      // Check each Safe for pending TXs
      const safes: { owner: string; address: string }[] = [];
      if (addresses.multisigs.emergency)
        safes.push({ owner: "emergency", address: addresses.multisigs.emergency });
      if (addresses.multisigs.dao)
        safes.push({ owner: "dao", address: addresses.multisigs.dao });

      for (const safe of safes) {
        try {
          const { results: pendingTxs } =
            await apiKit.getPendingTransactions(safe.address);

          for (const tx of pendingTxs) {
            const to = tx.to?.toLowerCase();
            if (!to || !tx.data) continue;

            const components = contractToComponents[to];
            if (!components) continue;

            for (const { id, owner, selector } of components) {
              if (owner !== safe.owner) continue;
              if (result[id]) continue;
              // Match by contract address + function selector
              if (!tx.data.startsWith(selector)) continue;

              result[id] = {
                confirmations: tx.confirmations?.length ?? 0,
                threshold: tx.confirmationsRequired ?? 0,
                safeAppUrl: getSafeAppUrl(chainId, safe.address, tx.safeTxHash),
              };
            }
          }
        } catch {
          // Safe may not exist on this chain or API error
        }
      }

      return result;
    },
    enabled: !!addresses && !!chainName,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    pendingProposals: data ?? {},
    isLoading,
  };
}
