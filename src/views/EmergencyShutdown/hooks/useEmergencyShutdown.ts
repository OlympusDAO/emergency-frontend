import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";
import { encodeFunctionData, type Abi } from "viem";
import { readContract } from "wagmi/actions";
import type { MetaTransactionData } from "@safe-global/types-kit";
import Safe from "@safe-global/protocol-kit";
import {
  EMERGENCY_ADDRESSES,
  type ChainId,
  type EmergencyComponent,
  type EmergencyCallArg,
  type MultisigOwner,
  emergencyAbi,
  coolerV2Abi,
  crossChainBridgeAbi,
  peripheryEnablerAbi,
  reserveMigratorAbi,
  yieldRepurchaseFacilityAbi,
  ccipLockReleasePoolAbi,
  heartAbi,
  emissionManagerAbi,
  bondManagerAbi,
} from "@/generated/emergency";
import { config } from "@/config/wagmi";
import {
  createSafeApiKit,
  getSafeAppUrl,
} from "../utils/safeTransaction.ts";

const ABI_MAP: Record<string, Abi> = {
  emergency: emergencyAbi as Abi,
  cooler_v2: coolerV2Abi as Abi,
  heart: heartAbi as Abi,
  emission_manager: emissionManagerAbi as Abi,
  cross_chain_bridge: crossChainBridgeAbi as Abi,
  periphery_enabler: peripheryEnablerAbi as Abi,
  reserve_migrator: reserveMigratorAbi as Abi,
  yield_repurchase_facility: yieldRepurchaseFacilityAbi as Abi,
  ccip_lock_release_pool: ccipLockReleasePoolAbi as Abi,
  bond_manager: bondManagerAbi as Abi,
};

export interface ShutdownResult {
  safeTxHash: string;
  safeAppUrl: string;
}

interface BatchShutdownResult {
  results: { owner: MultisigOwner; components: string[]; result: ShutdownResult }[];
}

function resolveContractAddress(
  contractKey: string,
  chainId: ChainId
): `0x${string}` {
  const addresses = EMERGENCY_ADDRESSES[chainId];
  if (!addresses) throw new Error(`No addresses for chain ${chainId}`);

  const contractName = contractKey.split(".").pop()!;
  const address = addresses.contracts[contractName];
  if (!address) throw new Error(`Contract ${contractName} not found on chain ${chainId}`);
  return address;
}

const erc20BalanceOfAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Resolve a dynamic arg value at runtime.
 *
 * - `pool_balance`: reads the OHM balance of the token pool contract
 * - `external.tokens.*`: resolves token addresses from chain config
 * - Static values pass through as-is
 */
async function resolveDynamicArg(
  arg: EmergencyCallArg,
  contractAddress: `0x${string}`,
  chainId: ChainId
): Promise<unknown> {
  if (arg.value !== "dynamic" || !arg.envKey) {
    // Static value
    if (arg.type === "bytes" && arg.value === "") return "0x";
    if (arg.type === "bool") return Boolean(arg.value);
    return arg.value;
  }

  const addresses = EMERGENCY_ADDRESSES[chainId];
  if (!addresses) throw new Error(`No addresses for chain ${chainId}`);

  // pool_balance: read OHM.balanceOf(tokenPoolContract)
  if (arg.envKey === "pool_balance") {
    const ohmAddress = addresses.contracts["OHM"];
    if (!ohmAddress) throw new Error("OHM contract not found on chain");

    const balance = await readContract(config, {
      address: ohmAddress,
      abi: erc20BalanceOfAbi,
      functionName: "balanceOf",
      args: [contractAddress],
      chainId,
    });
    return balance;
  }

  // external.tokens.X,external.tokens.Y → resolve token addresses from config
  if (arg.envKey.includes("external.tokens.")) {
    // These token addresses are not in our config — they need to be hardcoded
    // or resolved from an on-chain registry. For now, throw a clear error.
    throw new Error(
      `Dynamic token resolution for "${arg.envKey}" is not yet supported. ` +
      `This component requires manual token address configuration.`
    );
  }

  throw new Error(`Unknown dynamic envKey: ${arg.envKey}`);
}

/**
 * Build MetaTransactionData[] for a list of components.
 * All components must target the same Safe.
 */
async function buildTransactions(
  components: EmergencyComponent[],
  chainId: ChainId
): Promise<MetaTransactionData[]> {
  const transactions: MetaTransactionData[] = [];

  for (const component of components) {
    for (const call of component.calls) {
      const abiKey =
        call.function === "withdrawLiquidity"
          ? "ccip_lock_release_pool"
          : call.abi;
      const abi = ABI_MAP[abiKey];
      if (!abi) throw new Error(`Unknown ABI key: ${abiKey}`);

      const contractAddress = resolveContractAddress(
        call.contractKey,
        chainId
      );

      const args = await Promise.all(
        call.args.map((arg: EmergencyCallArg) =>
          resolveDynamicArg(arg, contractAddress, chainId)
        )
      );

      const data = encodeFunctionData({
        abi,
        functionName: call.function,
        args: args.length > 0 ? args : undefined,
      });

      transactions.push({
        to: contractAddress,
        data,
        value: "0",
      });
    }
  }

  return transactions;
}

/**
 * Propose a batch of transactions to a Safe.
 */
async function proposeSafeTransaction(
  transactions: MetaTransactionData[],
  safeAddress: `0x${string}`,
  senderAddress: `0x${string}`,
  chainId: ChainId
): Promise<ShutdownResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = (window as any).ethereum;
  if (!provider) throw new Error("No EIP-1193 provider found");

  const protocolKit = await Safe.init({
    provider: provider as string,
    safeAddress,
  });

  const safeTransaction = await protocolKit.createTransaction({
    transactions,
  });

  const safeTxHash =
    await protocolKit.getTransactionHash(safeTransaction);

  const signedTransaction =
    await protocolKit.signTransaction(safeTransaction);

  const apiKit = createSafeApiKit(chainId);
  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: signedTransaction.data,
    safeTxHash,
    senderAddress,
    senderSignature:
      signedTransaction.getSignature(senderAddress)!.data,
  });

  const safeAppUrl = getSafeAppUrl(chainId, safeAddress, safeTxHash);
  return { safeTxHash, safeAppUrl };
}

export function useEmergencyShutdown() {
  const { address } = useAccount();
  const chainId = useChainId() as ChainId;
  const [lastResult, setLastResult] = useState<ShutdownResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (component: EmergencyComponent): Promise<ShutdownResult> => {
      if (!address) throw new Error("Wallet not connected");

      const addresses = EMERGENCY_ADDRESSES[chainId];
      if (!addresses) throw new Error(`No addresses for chain ${chainId}`);

      const safeAddress =
        component.owner === "emergency"
          ? addresses.multisigs.emergency
          : addresses.multisigs.dao;

      if (!safeAddress)
        throw new Error(
          `No ${component.owner} multisig address on chain ${chainId}`
        );

      const transactions = await buildTransactions([component], chainId);
      const result = await proposeSafeTransaction(
        transactions,
        safeAddress,
        address as `0x${string}`,
        chainId
      );

      setLastResult(result);
      return result;
    },
  });

  const batchMutation = useMutation({
    mutationFn: async (
      grouped: Partial<Record<MultisigOwner, EmergencyComponent[]>>
    ): Promise<BatchShutdownResult> => {
      if (!address) throw new Error("Wallet not connected");

      const addresses = EMERGENCY_ADDRESSES[chainId];
      if (!addresses) throw new Error(`No addresses for chain ${chainId}`);

      const entries = Object.entries(grouped) as [MultisigOwner, EmergencyComponent[]][];

      const settled = await Promise.allSettled(
        entries.map(async ([owner, ownerComponents]) => {
          const safeAddress =
            owner === "emergency"
              ? addresses.multisigs.emergency
              : addresses.multisigs.dao;

          if (!safeAddress)
            throw new Error(
              `No ${owner} multisig address on chain ${chainId}`
            );

          const transactions = await buildTransactions(ownerComponents, chainId);
          const result = await proposeSafeTransaction(
            transactions,
            safeAddress,
            address as `0x${string}`,
            chainId
          );

          return {
            owner,
            components: ownerComponents.map((c) => c.name),
            result,
          };
        })
      );

      const results: BatchShutdownResult["results"] = [];
      const errors: string[] = [];

      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          results.push(outcome.value);
        } else {
          errors.push(outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason));
        }
      }

      if (errors.length > 0 && results.length === 0) {
        throw new Error(errors.join("; "));
      }

      return { results };
    },
  });

  return {
    shutdown: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    lastResult,
    reset: () => {
      mutation.reset();
      setLastResult(null);
    },
    shutdownBatch: batchMutation.mutateAsync,
    isBatchPending: batchMutation.isPending,
    batchError: batchMutation.error,
  };
}
