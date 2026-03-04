import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { IconExternalLink, IconChevronDown } from "@tabler/icons-react";
import type { EmergencyComponent, ChainId } from "@/generated/emergency";
import { EMERGENCY_ADDRESSES } from "@/generated/emergency";
import type { PendingProposal } from "../hooks";
import { EXPLORER_URL } from "../utils";

interface EmergencyComponentCardProps {
  component: EmergencyComponent;
  chainId: ChainId;
  status: "active" | "disabled" | "unknown";
  statusLoading: boolean;
  canExecute: boolean;
  onDisable: (component: EmergencyComponent) => void;
  pendingProposal?: PendingProposal;
}

const SEVERITY_DOT_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

export function EmergencyComponentCard({
  component,
  chainId,
  status,
  statusLoading,
  canExecute,
  onDisable,
  pendingProposal,
}: EmergencyComponentCardProps) {
  const [contractsOpen, setContractsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const addresses = EMERGENCY_ADDRESSES[chainId];
  const explorerUrl = EXPLORER_URL[chainId];

  // Dedupe contracts from calls (last segment of contractKey → address key)
  const contracts = [
    ...new Map(
      component.calls.map((call) => {
        const key = call.contractKey.split(".").pop()!;
        return [key, addresses?.contracts[key]] as const;
      })
    ),
  ];

  const linkElement = contracts[0]?.[1] && explorerUrl && (
    contracts.length === 1 ? (
      <a
        href={`${explorerUrl}/address/${contracts[0][1]}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <IconExternalLink className="size-3.5" />
      </a>
    ) : (
      <button
        onClick={(e) => { e.stopPropagation(); setContractsOpen(true); }}
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
      >
        <IconExternalLink className="size-3.5" />
      </button>
    )
  );

  return (
    <>
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardContent className="py-3 px-4 space-y-1.5">
          {/* Primary row: info left, status+action right */}
          <div className="flex items-start gap-3">
            {/* Left: name, badges, description */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">
                  {component.name}
                </span>
                {linkElement}

                <Badge variant="outline">
                  {component.owner === "emergency" ? "Emergency MS" : "DAO MS"}
                </Badge>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`size-2 rounded-full ${SEVERITY_DOT_COLOR[component.severity] ?? "bg-gray-400"}`} />
                  {component.severity}
                </span>
                {pendingProposal && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    Pending {pendingProposal.confirmations}/{pendingProposal.threshold}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground line-clamp-1">
                {component.description}
              </p>
            </div>

            {/* Right: status + button + chevron in one row */}
            <div className="flex items-center gap-2 shrink-0">
              {statusLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <Badge
                  variant={
                    status === "active"
                      ? "outline"
                      : status === "disabled"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {status === "active"
                    ? "Active"
                    : status === "disabled"
                      ? "Disabled"
                      : "Unknown"}
                </Badge>
              )}

              {pendingProposal ? (
                <Button
                  variant="outline"
                  size="default"
                  className="border-amber-500 text-amber-600 hover:bg-amber-500/10"
                  onClick={(e) => { e.stopPropagation(); window.open(pendingProposal.safeAppUrl, "_blank"); }}
                >
                  <IconExternalLink className="size-3.5" />
                  Pending ({pendingProposal.confirmations}/{pendingProposal.threshold})
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="default"
                  className="px-5 font-semibold bg-foreground text-background hover:bg-foreground/80"
                  disabled={!canExecute || status === "disabled"}
                  onClick={(e) => { e.stopPropagation(); onDisable(component); }}
                >
                  {status === "disabled" ? "Already Disabled" : "Disable"}
                </Button>
              )}

              <IconChevronDown
                className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>

          {/* Expandable details */}
          <CollapsibleContent>
            <Separator className="my-3" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Available Networks
                </p>
                <div className="flex flex-wrap gap-1">
                  {component.availableOn.map((chain) => (
                    <Badge key={chain} variant="outline">
                      {chain}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Shutdown Actions
                </p>
                <div className="flex flex-wrap gap-1">
                  {component.calls.map((call) => (
                    <Badge key={call.signature} variant="secondary">
                      {call.function}()
                    </Badge>
                  ))}
                </div>
              </div>

              {component.shutdownCriteria.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Shutdown Criteria
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                    {component.shutdownCriteria.map((criteria) => (
                      <li key={criteria}>{criteria}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>

    {/* Contracts list modal */}
    {contracts.length > 1 && (
      <AlertDialog open={contractsOpen} onOpenChange={setContractsOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{component.name} — Contracts</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2">
            {contracts.map(([name, address]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 rounded-md bg-muted p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  {address && (
                    <p className="text-xs font-mono text-muted-foreground break-all">
                      {address}
                    </p>
                  )}
                </div>
                {address && explorerUrl && (
                  <a
                    href={`${explorerUrl}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <IconExternalLink className="size-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}
    </>
  );
}
