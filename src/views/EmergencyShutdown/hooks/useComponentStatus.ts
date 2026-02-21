import { useReadContracts } from "wagmi";
import {
  EMERGENCY_ADDRESSES,
  EMERGENCY_COMPONENTS,
  CHAIN_ID_TO_NAME,
  type ChainId,
  type ChainName,
  type EmergencyComponent,
  emergencyAbi,
  coolerV2Abi,
  crossChainBridgeAbi,
  reserveMigratorAbi,
  yieldRepurchaseFacilityAbi,
  peripheryEnablerAbi,
} from "@/generated/emergency";
import type { Abi } from "viem";

type StatusMap = Record<string, "active" | "disabled" | "unknown">;

interface StatusCheckConfig {
  abi: Abi;
  functionName: string;
  /** If true, the returned boolean `true` means shutdown */
  trueIsShutdown: boolean;
}

/**
 * Maps abiKey to the status-check function and its interpretation.
 */
function getStatusCheck(abiKey: string): StatusCheckConfig | null {
  switch (abiKey) {
    case "periphery_enabler":
      return {
        abi: peripheryEnablerAbi as Abi,
        functionName: "isEnabled",
        trueIsShutdown: false, // true = active, false = shutdown
      };
    case "cooler_v2":
      return {
        abi: coolerV2Abi as Abi,
        functionName: "borrowsPaused",
        trueIsShutdown: true, // true = paused = shutdown
      };
    case "cross_chain_bridge":
      return {
        abi: crossChainBridgeAbi as Abi,
        functionName: "bridgeActive",
        trueIsShutdown: false, // false = shutdown
      };
    case "reserve_migrator":
      return {
        abi: reserveMigratorAbi as Abi,
        functionName: "locallyActive",
        trueIsShutdown: false, // false = shutdown
      };
    case "yield_repurchase_facility":
      return {
        abi: yieldRepurchaseFacilityAbi as Abi,
        functionName: "isShutdown",
        trueIsShutdown: true, // true = shutdown
      };
    case "emergency":
      return {
        abi: emergencyAbi as Abi,
        functionName: "isActive",
        trueIsShutdown: false, // false = shutdown
      };
    default:
      return null;
  }
}

/**
 * Resolves the contract address for a component's first call on the given chain.
 */
function resolveContractAddress(
  component: EmergencyComponent,
  chainId: ChainId
): `0x${string}` | null {
  const addresses = EMERGENCY_ADDRESSES[chainId];
  if (!addresses) return null;

  const contractKey = component.calls[0]?.contractKey;
  if (!contractKey) return null;

  // contractKey format: "olympus.policies.Emergency" or "olympus.periphery.CoolerV2Composites"
  const contractName = contractKey.split(".").pop();
  if (!contractName) return null;

  return (addresses.contracts[contractName] as `0x${string}`) ?? null;
}

export function useComponentStatus(chainId: ChainId): {
  statuses: StatusMap;
  isLoading: boolean;
} {
  const chainName: ChainName | undefined = CHAIN_ID_TO_NAME[chainId];
  const chainComponents = EMERGENCY_COMPONENTS.filter(
    (c) => chainName && c.availableOn.includes(chainName)
  );

  // Build the contracts array for useReadContracts
  const contracts = chainComponents
    .map((component) => {
      const abiKey = component.calls[0]?.abi;
      if (!abiKey) return null;

      const check = getStatusCheck(abiKey);
      if (!check) return null;

      const address = resolveContractAddress(component, chainId);
      if (!address) return null;

      return {
        address,
        abi: check.abi,
        functionName: check.functionName,
        chainId,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      refetchInterval: 30_000,
      staleTime: 10_000,
    },
  });

  const statuses: StatusMap = {};
  let dataIdx = 0;

  for (const component of chainComponents) {
    const abiKey = component.calls[0]?.abi;
    if (!abiKey) {
      statuses[component.id] = "unknown";
      continue;
    }

    const check = getStatusCheck(abiKey);
    const address = resolveContractAddress(component, chainId);
    if (!check || !address) {
      statuses[component.id] = "unknown";
      continue;
    }

    const result = data?.[dataIdx];
    dataIdx++;

    if (!result || result.status === "failure") {
      statuses[component.id] = "unknown";
      continue;
    }

    const value = result.result as boolean;
    const isShutdown = check.trueIsShutdown ? value : !value;
    statuses[component.id] = isShutdown ? "disabled" : "active";
  }

  return { statuses, isLoading };
}
