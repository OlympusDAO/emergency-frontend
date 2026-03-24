import { useState, useMemo } from "react";
import { useChainId, useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { IconAlertTriangle, IconX, IconShieldLock, IconExternalLink } from "@tabler/icons-react";
import { toast } from "sonner";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  EMERGENCY_COMPONENTS,
  EMERGENCY_ADDRESSES,
  CHAIN_ID_TO_NAME,
  type ChainId,
  type EmergencyComponent,
  type MultisigOwner,
} from "@/generated/emergency";

import { EmergencyComponentCard, ShutdownConfirmModal, BatchBar, BatchReviewModal } from "./components";
import { useIsSafeSigner, useComponentStatus, useEmergencyShutdown, usePendingProposals, useBatchQueue } from "./hooks";
import { EXPLORER_URL } from "./utils";

type OwnerFilter = "all" | MultisigOwner;

const STATUS_ORDER: Record<string, number> = { active: 0, unknown: 1, disabled: 2 };
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const WARNING_DISMISSED_KEY = "emergency-warning-dismissed";

export default function EmergencyShutdown() {
  const chainId = useChainId() as ChainId;
  const { isConnected } = useAccount();
  const chainName = CHAIN_ID_TO_NAME[chainId] ?? "unknown";
  const addresses = EMERGENCY_ADDRESSES[chainId];

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [selectedComponent, setSelectedComponent] =
    useState<EmergencyComponent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(
    () => localStorage.getItem(WARNING_DISMISSED_KEY) === "true"
  );

  const {
    isEmergencySigner,
    isDaoSigner,
    isLoading: signerLoading,
  } = useIsSafeSigner();

  const { statuses, isLoading: statusLoading } = useComponentStatus(chainId);
  const { shutdown, isPending, shutdownBatch, isBatchPending } = useEmergencyShutdown();
  const { pendingProposals } = usePendingProposals();
  const {
    batchQueue,
    addToBatch,
    removeFromBatch,
    clearBatch,
    isInBatch,
    batchByOwner,
  } = useBatchQueue();
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);

  // Filter components by current chain
  const chainComponents = useMemo(
    () =>
      EMERGENCY_COMPONENTS.filter((c) =>
        c.availableOn.includes(chainName)
      ),
    [chainName]
  );

  // Filter by owner
  const filteredComponents = useMemo(
    () =>
      ownerFilter === "all"
        ? chainComponents
        : chainComponents.filter((c) => c.owner === ownerFilter),
    [chainComponents, ownerFilter]
  );

  const sortedComponents = useMemo(
    () =>
      [...filteredComponents].sort((a, b) => {
        const statusA = STATUS_ORDER[statuses[a.id] ?? "unknown"] ?? 2;
        const statusB = STATUS_ORDER[statuses[b.id] ?? "unknown"] ?? 2;
        if (statusA !== statusB) return statusA - statusB;
        const sevA = SEVERITY_ORDER[a.severity] ?? 3;
        const sevB = SEVERITY_ORDER[b.severity] ?? 3;
        return sevA - sevB;
      }),
    [filteredComponents, statuses]
  );

  const canExecute = (component: EmergencyComponent): boolean => {
    if (component.owner === "emergency") return isEmergencySigner;
    if (component.owner === "dao") return isDaoSigner;
    return false;
  };

  const handleDisable = (component: EmergencyComponent) => {
    setSelectedComponent(component);
    setModalOpen(true);
  };

  const handleToggleBatch = (component: EmergencyComponent) => {
    if (isInBatch(component.id)) {
      removeFromBatch(component.id);
    } else {
      addToBatch(component);
    }
  };

  const handleBatchSubmit = async () => {
    const result = await shutdownBatch(batchByOwner);
    clearBatch();
    const count = result.results.length;
    toast.success(
      `${count} batch ${count === 1 ? "proposal" : "proposals"} submitted`
    );
    return result;
  };

  const handleConfirm = async (component: EmergencyComponent) => {
    const result = await shutdown(component);
    toast.success(`Shutdown proposal submitted for ${component.name}`);
    return result;
  };

  const dismissWarning = () => {
    setWarningDismissed(true);
    localStorage.setItem(WARNING_DISMISSED_KEY, "true");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconAlertTriangle className="size-5 text-destructive" />
            <h1 className="text-base font-semibold">Emergency Shutdown</h1>
          </div>
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </header>

      {/* Access Gate: not connected */}
      {!isConnected && (
        <main className="mx-auto max-w-6xl px-4 flex flex-col items-center justify-center min-h-[calc(100vh-49px)] gap-4 text-center">
          <IconShieldLock className="size-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            This dashboard is restricted to authorized Safe multisig signers.
            Connect a wallet that is a signer on the Emergency or DAO multisig
            to access shutdown controls.
          </p>
          <ConnectButton />
        </main>
      )}

      {/* Access Gate: connected but checking */}
      {isConnected && signerLoading && (
        <main className="mx-auto max-w-6xl px-4 flex flex-col items-center justify-center min-h-[calc(100vh-49px)] gap-4 text-center">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </main>
      )}

      {/* Access Gate: connected but not a signer */}
      {isConnected && !signerLoading && !isEmergencySigner && !isDaoSigner && (
        <main className="mx-auto max-w-6xl px-4 flex flex-col items-center justify-center min-h-[calc(100vh-49px)] gap-4 text-center">
          <IconShieldLock className="size-12 text-destructive/40" />
          <h2 className="text-lg font-semibold">Unauthorized</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Your connected wallet is not a signer on any of the protocol
            multisigs on this network. Switch to an authorized wallet or change
            the network to access shutdown controls.
          </p>
        </main>
      )}

      {/* Dashboard: authorized signer */}
      {isConnected && !signerLoading && (isEmergencySigner || isDaoSigner) && (
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Warning Banner */}
        {!warningDismissed && (
          <Alert variant="warning">
            <IconAlertTriangle className="size-4" />
            <AlertTitle>Emergency Use Only</AlertTitle>
            <AlertDescription className="flex items-start justify-between gap-4">
              <span>
                This dashboard is for emergency shutdown procedures only. Actions
                taken here will propose Safe transactions that, once executed, will
                disable critical protocol components. Ensure you understand the
                implications before proceeding.
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={dismissWarning}
                className="shrink-0"
              >
                <IconX className="size-3" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Network Info */}
        {addresses && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-foreground">
                Connected Network:
              </span>
              <Badge variant="outline">{chainName}</Badge>
              {isEmergencySigner && (
                <Badge variant="destructive">Emergency Signer</Badge>
              )}
              {isDaoSigner && (
                <Badge variant="secondary">DAO Signer</Badge>
              )}
            </div>
            <Separator />
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {addresses.multisigs.emergency && (
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground">Emergency MS: </span>
                  <span className="font-mono break-all text-muted-foreground">
                    {addresses.multisigs.emergency}
                  </span>
                  <a
                    href={`${EXPLORER_URL[chainId]}/address/${addresses.multisigs.emergency}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <IconExternalLink className="size-3.5" />
                  </a>
                </div>
              )}
              {addresses.multisigs.dao && (
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground">DAO MS: </span>
                  <span className="font-mono break-all text-muted-foreground">
                    {addresses.multisigs.dao}
                  </span>
                  <a
                    href={`${EXPLORER_URL[chainId]}/address/${addresses.multisigs.dao}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <IconExternalLink className="size-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Contracts ({filteredComponents.length})
          </h2>
          <Select
            value={ownerFilter}
            onValueChange={(v) => setOwnerFilter(v as OwnerFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              <SelectItem value="emergency">Emergency MS</SelectItem>
              <SelectItem value="dao">DAO MS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Component Grid */}
        <div className="flex flex-col gap-3">
          {sortedComponents.map((component) => (
            <EmergencyComponentCard
              key={component.id}
              component={component}
              chainId={chainId}
              status={statuses[component.id] ?? "unknown"}
              statusLoading={statusLoading}
              canExecute={canExecute(component)}
              onDisable={handleDisable}
              pendingProposal={pendingProposals[component.id]}
              isInBatch={isInBatch(component.id)}
              onToggleBatch={handleToggleBatch}
            />
          ))}
        </div>

        {filteredComponents.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No components available on {chainName}
            {ownerFilter !== "all" ? ` for ${ownerFilter} multisig` : ""}.
          </div>
        )}
      </main>
      )}

      {/* Shutdown Confirmation Modal */}
      <ShutdownConfirmModal
        component={selectedComponent}
        chainId={chainId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfirm={handleConfirm}
        isPending={isPending}
      />

      {/* Batch Bar & Review Modal */}
      <BatchBar
        batchQueue={batchQueue}
        batchByOwner={batchByOwner}
        onReview={() => setBatchReviewOpen(true)}
        onClear={clearBatch}
      />
      <BatchReviewModal
        batchByOwner={batchByOwner}
        chainId={chainId}
        open={batchReviewOpen}
        onOpenChange={setBatchReviewOpen}
        onSubmit={handleBatchSubmit}
        isPending={isBatchPending}
      />
    </div>
  );
}
