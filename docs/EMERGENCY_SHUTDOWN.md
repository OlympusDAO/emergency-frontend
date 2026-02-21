# Emergency Shutdown Dashboard

Technical documentation for the Emergency Shutdown Dashboard — a React frontend that allows authorized Safe multisig signers to propose emergency shutdown transactions for the Olympus protocol.

## Table of Contents

- [Setup](#setup)
- [Architecture Overview](#architecture-overview)
- [Codegen](#codegen)
- [Generated Files](#generated-files)
- [Wagmi & Providers](#wagmi--providers)
- [Hooks](#hooks)
- [Utils](#utils)
- [Components](#components)
- [Access Control](#access-control)
- [Safe Transaction Flow](#safe-transaction-flow)
- [Environment Variables](#environment-variables)
- [Known Limitations](#known-limitations)

---

## Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- A WalletConnect Cloud project ID (from [cloud.walletconnect.com](https://cloud.walletconnect.com))
- A Safe Transaction Service API key (from [safe.global](https://safe.global) → Developer Portal → API Keys)

### Installation

```bash
pnpm install
```

### Environment

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID for RainbowKit |
| `VITE_OLYMPUS_SAFE_API_KEY` | Safe Transaction Service API key |

### Running codegen

The frontend depends on generated files from the `olympus-v3` repository. Run codegen before the first build:

```bash
pnpm codegen:emergency
```

This fetches `emergency-config.json` and `emergency-abis.json` from GitHub and generates TypeScript files into `src/generated/emergency/`. See [Codegen](#codegen) for details.

### Development

```bash
pnpm dev
```

Opens the app at `http://localhost:5173/emergency`.

### Production build

```bash
pnpm build
pnpm preview
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  olympus-v3 repo (GitHub)                           │
│  emergency-config.json + emergency-abis.json        │
└──────────────────┬──────────────────────────────────┘
                   │  pnpm codegen:emergency
                   ▼
┌─────────────────────────────────────────────────────┐
│  src/generated/emergency/                           │
│  types.ts, components.ts, addresses.ts, abis/*.json │
└──────────────────┬──────────────────────────────────┘
                   │  imported by
                   ▼
┌─────────────────────────────────────────────────────┐
│  src/views/EmergencyShutdown/                       │
│  hooks/ → on-chain reads + Safe API                 │
│  utils/ → Safe SDK helpers                          │
│  components/ → UI cards + modal                     │
│  index.tsx → main page with access gating           │
└─────────────────────────────────────────────────────┘
```

The frontend is a single-page app with one route (`/emergency`). The data pipeline is:

1. **Codegen** fetches config + ABIs from the `olympus-v3` repo and generates TypeScript files
2. **Hooks** read on-chain contract state (via wagmi) and Safe multisig info (via Safe API Kit)
3. **Components** render the dashboard UI and handle shutdown proposal flow

---

## Codegen

**Script**: `scripts/emergency-codegen.ts`
**Command**: `pnpm codegen:emergency`

The codegen script fetches two JSON files from the `olympus-v3` repository:

| File | Description |
|------|-------------|
| `emergency-config.json` | Components, chains, contract addresses, shutdown calls |
| `emergency-abis.json` | Minimal ABIs for each contract (only emergency-relevant functions) |

It then generates TypeScript files into `src/generated/emergency/`.

### Source URL
// todo: change CallistoDAO to OlympusDAO when PR(https://github.com/OlympusDAO/olympus-v3/pull/198) will merge
```
https://raw.githubusercontent.com/CallistoDAO/olympus-v3/emergency/documentation/emergency/
```

> **Note**: This URL points to the `CallistoDAO` fork while the upstream PR (https://github.com/OlympusDAO/olympus-v3/pull/198) is pending. Update to `OlympusDAO` once merged.

### What the codegen produces

The script generates 4 TypeScript files and 10 ABI JSON files. All are prefixed with a "DO NOT EDIT" comment.

---

## Generated Files

```
src/generated/emergency/
├── types.ts           # TypeScript types
├── components.ts      # EMERGENCY_COMPONENTS array
├── addresses.ts       # EMERGENCY_ADDRESSES + chain ID/name mappings
├── abis/              # Individual ABI JSON files
│   ├── bond_manager.json
│   ├── ccip_lock_release_pool.json
│   ├── cooler_v2.json
│   ├── cross_chain_bridge.json
│   ├── emergency.json
│   ├── emission_manager.json
│   ├── heart.json
│   ├── periphery_enabler.json
│   ├── reserve_migrator.json
│   └── yield_repurchase_facility.json
└── index.ts           # Barrel exports + ABI re-exports
```

### `types.ts`

Defines the core types used throughout the app:

- `ChainId` — union of supported chain IDs: `1 | 10 | 42161 | 8453 | 80094 | 11155111`
- `ChainName` — `"mainnet" | "optimism" | "arbitrum" | "base" | "berachain" | "sepolia"`
- `MultisigOwner` — `"emergency" | "dao"`
- `EmergencyComponent` — full component definition including calls, criteria, severity
- `EmergencyCall` — individual contract call with ABI key, function name, args
- `ChainAddresses` — contract + multisig addresses per chain

### `components.ts`

Exports `EMERGENCY_COMPONENTS` — a readonly array of all 15 emergency components. Each component defines:

- Which chains it's available on (`availableOn`)
- Which multisig owns it (`owner`: `"emergency"` or `"dao"`)
- The contract calls to execute for shutdown (`calls`)
- Shutdown criteria and post-shutdown steps for the UI

### `addresses.ts`

Exports:

- `EMERGENCY_ADDRESSES` — contract and multisig addresses keyed by chain ID
- `CHAIN_ID_TO_NAME` / `CHAIN_NAME_TO_ID` — bidirectional chain mappings

### `abis/`

Each JSON file contains a minimal ABI array with only the functions relevant to emergency operations (shutdown, disable, status checks). These are imported as JSON and re-exported from `index.ts` as typed constants (e.g., `emergencyAbi`, `coolerV2Abi`).

---

## Wagmi & Providers

**Config**: `src/config/wagmi.ts`

Uses RainbowKit's `getDefaultConfig` with 6 supported chains:

| Chain | ID | Notes |
|-------|----|-------|
| Mainnet | 1 | Primary chain |
| Arbitrum | 42161 | |
| Base | 8453 | |
| Berachain | 80094 | Custom chain definition via `defineChain()` |
| Optimism | 10 | |
| Sepolia | 11155111 | Testnet |

**Provider stack** (in `src/main.tsx`):

```
WagmiProvider → QueryClientProvider → RainbowKitProvider → BrowserRouter → App
```

Plus a `<Toaster />` from sonner for toast notifications.

---

## Hooks

All hooks are in `src/views/EmergencyShutdown/hooks/`.

### `useIsSafeSigner`

Checks whether the connected wallet is a signer on the Emergency and/or DAO multisigs.

**How it works**:
1. Creates a `SafeApiKit` instance with the API key
2. Calls `apiKit.getSafeInfo(safeAddress)` for both Emergency MS and DAO MS
3. Checks if the connected address is in the `owners` array

**Returns**:
```ts
{
  isEmergencySigner: boolean;
  isDaoSigner: boolean;
  emergencyThreshold: number;
  emergencyOwnerCount: number;
  daoThreshold: number;
  daoOwnerCount: number;
  isLoading: boolean;
  error: Error | null;
}
```

**Caching**: `staleTime: Infinity` — fetches once per address/chain combination, no polling. Signer status rarely changes, so we avoid unnecessary Safe API requests.

### `useComponentStatus`

Reads on-chain status for each emergency component on the current chain.

**How it works**:
1. Filters `EMERGENCY_COMPONENTS` to those available on the current chain
2. Builds a batch of `useReadContracts` calls based on each component's ABI key
3. Maps the boolean return values to status strings

**Status check strategy per ABI key**:

| ABI Key | Function | `true` = shutdown? |
|---------|----------|-------------------|
| `periphery_enabler` | `isEnabled()` | No (false = shutdown) |
| `cooler_v2` | `borrowsPaused()` | Yes (true = shutdown) |
| `cross_chain_bridge` | `bridgeActive()` | No (false = shutdown) |
| `reserve_migrator` | `locallyActive()` | No (false = shutdown) |
| `yield_repurchase_facility` | `isShutdown()` | Yes (true = shutdown) |
| `emergency` | `isActive()` | No (false = shutdown) |

**Returns**: `{ statuses: Record<string, "active" | "disabled" | "unknown">, isLoading: boolean }`

**Caching**: `refetchInterval: 30s`, `staleTime: 10s` — on-chain status can change, so we poll.

### `useEmergencyShutdown`

Core mutation hook that builds and proposes a Safe transaction for shutting down a component.

**Flow**:
1. Determines which Safe (Emergency MS or DAO MS) based on `component.owner`
2. For each call in `component.calls`:
   - Resolves the correct ABI (with special handling for `withdrawLiquidity` → `ccip_lock_release_pool` ABI)
   - Resolves dynamic args on-chain (e.g., `pool_balance` reads `OHM.balanceOf(pool)`)
   - Encodes function data via viem's `encodeFunctionData`
3. Initializes Safe Protocol Kit with `window.ethereum` provider
4. Creates a Safe transaction (auto-batches via MultiSend if multiple calls)
5. Signs the transaction with the connected wallet
6. Proposes the transaction to the Safe Transaction Service via API Kit
7. Returns the Safe TX hash and a link to the Safe App

**Dynamic arg resolution**:

Some components have args with `value: "dynamic"` and an `envKey` that describes how to resolve them at runtime:

| `envKey` | Resolution |
|----------|------------|
| `pool_balance` | Reads `OHM.balanceOf(tokenPoolContract)` on-chain |
| `external.tokens.*` | Not yet supported — throws a clear error |

---

## Utils

All utils are in `src/views/EmergencyShutdown/utils/safeTransaction.ts`.

### `createSafeApiKit(chainId)`

Creates a `SafeApiKit` instance configured with the chain ID and the `VITE_OLYMPUS_SAFE_API_KEY` env variable. Used by `useIsSafeSigner` (to query Safe info) and `useEmergencyShutdown` (to propose transactions).

### `createSafeProtocolKit(safeAddress, provider)`

Initializes `Safe` Protocol Kit via `Safe.init()`. Used during transaction creation and signing.

### `getSafeAppUrl(chainId, safeAddress, safeTxHash)`

Builds a URL to the Safe App transaction page so other signers can review and co-sign.

Format: `https://app.safe.global/transactions/tx?safe={prefix}:{safeAddress}&id=multisig_{safeAddress}_{safeTxHash}`

Chain prefix mapping: `eth` (1), `sep` (11155111), `arb1` (42161), `base` (8453), `oeth` (10), `bera` (80094).

---

## Components

### `emergency-component-card.tsx`

Card component for each emergency component. Displays:

- Component name with owner badge (Emergency MS = red, DAO MS = purple)
- Status badge (Active / Disabled / Unknown) with loading skeleton
- Severity badge (critical / high / medium / low)
- Description text
- Available networks as badges
- Shutdown actions (function signatures) as badges
- Shutdown criteria as a bulleted list
- "Disable" button — enabled only if the user is a signer for the component's owner

### `shutdown-confirm-modal.tsx`

Two-state modal using AlertDialog:

1. **Confirmation state**: Shows component info, target Safe address, transaction details (function signatures), shutdown criteria, and a red "Submit Shutdown Proposal" button
2. **Success state**: Shows the Safe TX hash and a button to open the Safe App where other signers can review and co-sign

---

## Access Control

The dashboard implements a strict access gate — components are only visible to authorized signers.

| State | What the user sees |
|-------|-------------------|
| Not connected | Full-screen "Access Restricted" message with Connect button |
| Connected, loading | Skeleton loader while Safe API is queried |
| Connected, not a signer | Full-screen "Unauthorized" message |
| Connected, signer | Full dashboard with components |

**Signer permissions** determine which components a user can shut down:

| Emergency MS Signer | DAO MS Signer | Can Shut Down |
|---------------------|---------------|---------------|
| Yes | No | Only `emergency` owner components |
| No | Yes | Only `dao` owner components |
| Yes | Yes | All components |
| No | No | None (access denied) |

---

## Safe Transaction Flow

```
User clicks "Disable"
    │
    ▼
ShutdownConfirmModal opens (confirmation state)
    │
    ▼
User clicks "Submit Shutdown Proposal"
    │
    ├── 1. Encode call data (viem encodeFunctionData)
    ├── 2. Resolve dynamic args on-chain if needed
    ├── 3. Safe.init() with window.ethereum
    ├── 4. protocolKit.createTransaction({ transactions })
    ├── 5. protocolKit.getTransactionHash()
    ├── 6. protocolKit.signTransaction() → wallet popup
    ├── 7. apiKit.proposeTransaction() → Safe TX Service
    │
    ▼
ShutdownConfirmModal (success state)
    │
    ▼
User clicks "Open in Safe App" → other signers co-sign → execute
```

The Safe Transaction Service API key (`VITE_OLYMPUS_SAFE_API_KEY`) is passed to `SafeApiKit` in the constructor. The API key is required as Safe's public API is being deprecated.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID for RainbowKit |
| `VITE_OLYMPUS_SAFE_API_KEY` | Yes | Safe Transaction Service API key |

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Get your Safe API key from: https://safe.global/ -> Developer Portal -> API Keys

---

## File Structure

```
scripts/
└── emergency-codegen.ts            # Codegen script

src/
├── config/
│   └── wagmi.ts                    # Wagmi + RainbowKit config
├── generated/emergency/            # Auto-generated (do not edit)
│   ├── types.ts
│   ├── components.ts
│   ├── addresses.ts
│   ├── abis/*.json
│   └── index.ts
└── views/EmergencyShutdown/
    ├── index.tsx                    # Main page with access gating
    ├── components/
    │   ├── emergency-component-card.tsx
    │   ├── shutdown-confirm-modal.tsx
    │   └── index.ts
    ├── hooks/
    │   ├── useIsSafeSigner.ts
    │   ├── useComponentStatus.ts
    │   ├── useEmergencyShutdown.ts
    │   └── index.ts
    └── utils/
        ├── safeTransaction.ts
        └── index.ts
```

---

## Known Limitations

- **Dynamic token resolution (`external.tokens.*`)**: Some components have call args that reference external token addresses. These are not yet resolved automatically — the hook throws a descriptive error if encountered. Requires manual token address configuration or an on-chain registry.
- **`withdrawLiquidity` ABI override**: The config specifies `abi: "periphery_enabler"` for `withdrawLiquidity`, but this function exists on the `ccip_lock_release_pool` contract. The `useEmergencyShutdown` hook has a runtime override to use the correct ABI.
- **Codegen source URL**: Currently points to the `CallistoDAO` fork. Update `BASE_URL` in `scripts/emergency-codegen.ts` to `OlympusDAO` once the upstream PR merges.
- **Node.js polyfills**: `@safe-global/protocol-kit` uses Node.js built-ins (`Buffer`, `stream`, etc.). The `vite-plugin-node-polyfills` plugin is required in `vite.config.ts` to shim these for the browser.
- **RainbowKit + wagmi version lock**: RainbowKit 2.2.x requires `wagmi ^2.9.0`. Do not upgrade to wagmi v3 without a matching RainbowKit release.
