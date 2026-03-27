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
  mintrAbi,
  trsryAbi,
} from "@/generated/emergency";
import type { Abi } from "viem";

type StatusMap = Record<string, "active" | "disabled" | "unknown">;

interface StatusCheckConfig {
  abi: Abi;
  functionName: string;
  /** If true, the returned boolean `true` means shutdown */
  trueIsShutdown: boolean;
}

const ABI_MAP: Record<string, Abi> = {
  periphery_enabler: peripheryEnablerAbi as Abi,
  cooler_v2: coolerV2Abi as Abi,
  cross_chain_bridge: crossChainBridgeAbi as Abi,
  reserve_migrator: reserveMigratorAbi as Abi,
  yield_repurchase_facility: yieldRepurchaseFacilityAbi as Abi,
  emergency: emergencyAbi as Abi,
  mintr: mintrAbi as Abi,
  trsry: trsryAbi as Abi,
};

/**
 * Maps abiKey to the default status-check function and its interpretation.
 * Used when a component does not specify an explicit `statusCheck`.
 */
function getDefaultStatusCheck(abiKey: string): StatusCheckConfig | null {
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
 * Resolves the status check config for a component.
 * Uses the explicit `statusCheck` field when present, otherwise falls back
 * to deriving the check from `calls[0].abi`.
 */
function resolveStatusCheck(
  component: EmergencyComponent
): StatusCheckConfig | null {
  if (component.statusCheck) {
    const abi = ABI_MAP[component.statusCheck.abi];
    if (!abi) return null;
    return {
      abi,
      functionName: component.statusCheck.functionName,
      trueIsShutdown: component.statusCheck.trueIsShutdown,
    };
  }

  const abiKey = component.calls[0]?.abi;
  if (!abiKey) return null;
  return getDefaultStatusCheck(abiKey);
}

/**
 * Resolves the contract address for a component's status check on the given chain.
 * Uses the `statusCheck.contractKey` when present, otherwise falls back to `calls[0].contractKey`.
 */
function resolveStatusAddress(
  component: EmergencyComponent,
  chainId: ChainId
): `0x${string}` | null {
  const addresses = EMERGENCY_ADDRESSES[chainId];
  if (!addresses) return null;

  const contractKey =
    component.statusCheck?.contractKey ?? component.calls[0]?.contractKey;
  if (!contractKey) return null;

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
      const check = resolveStatusCheck(component);
      if (!check) return null;

      const address = resolveStatusAddress(component, chainId);
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
    const check = resolveStatusCheck(component);
    const address = resolveStatusAddress(component, chainId);
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
