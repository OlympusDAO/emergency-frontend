import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IconExternalLink, IconCheck, IconX } from "@tabler/icons-react";
import type {
  EmergencyComponent,
  ChainId,
  MultisigOwner,
} from "@/generated/emergency";
import { EMERGENCY_ADDRESSES } from "@/generated/emergency";
import type { ShutdownResult } from "../hooks";

interface BatchReviewModalProps {
  batchByOwner: Partial<Record<MultisigOwner, EmergencyComponent[]>>;
  chainId: ChainId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<{
    results: { owner: MultisigOwner; components: string[]; result: ShutdownResult }[];
  }>;
  isPending: boolean;
}

export function BatchReviewModal({
  batchByOwner,
  chainId,
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: BatchReviewModalProps) {
  const [results, setResults] = useState<
    { owner: MultisigOwner; components: string[]; result: ShutdownResult }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const addresses = EMERGENCY_ADDRESSES[chainId];
  const allComponents = Object.values(batchByOwner).flat();
  const totalCalls = allComponents.reduce(
    (sum, c) => sum + c.calls.length,
    0
  );
  const ownerCount = Object.keys(batchByOwner).length;

  const handleSubmit = async () => {
    try {
      setError(null);
      const res = await onSubmit();
      setResults(res.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setResults(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  // Success state
  if (results) {
    return (
      <AlertDialog open={open} onOpenChange={handleClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconCheck className="size-4 text-green-500" />
              Batch Proposals Submitted
            </AlertDialogTitle>
            <AlertDialogDescription>
              {results.length === 1
                ? "1 batch proposal has been submitted."
                : `${results.length} batch proposals have been submitted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            {results.map((r) => (
              <div
                key={r.result.safeTxHash}
                className="rounded-md bg-muted p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {r.owner === "emergency" ? "Emergency MS" : "DAO MS"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.components.length}{" "}
                    {r.components.length === 1 ? "component" : "components"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.components.join(", ")}
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Safe TX Hash
                  </p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {r.result.safeTxHash}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(r.result.safeAppUrl, "_blank")
                  }
                >
                  <IconExternalLink className="size-3.5" />
                  Open in Safe App
                </Button>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Review state
  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <div className="flex items-start justify-between">
          <AlertDialogHeader className="flex-1">
            <AlertDialogTitle>Review Batch Shutdown</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to propose {allComponents.length}{" "}
              {allComponents.length === 1
                ? "component shutdown"
                : "component shutdowns"}{" "}
              ({totalCalls} {totalCalls === 1 ? "call" : "calls"} total).
              {ownerCount > 1 &&
                " This will create separate proposals for each Safe."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleClose(false)}
            className="shrink-0 -mt-1 -mr-2"
          >
            <IconX className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {(
            Object.entries(batchByOwner) as [
              MultisigOwner,
              EmergencyComponent[],
            ][]
          ).map(([owner, components]) => {
            const safeAddress =
              owner === "emergency"
                ? addresses?.multisigs.emergency
                : addresses?.multisigs.dao;

            return (
              <div key={owner} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={
                      owner === "emergency" ? "text-destructive" : ""
                    }
                  >
                    {owner === "emergency" ? "Emergency MS" : "DAO MS"}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {safeAddress ?? "N/A"}
                  </span>
                </div>

                {components.map((component) => (
                  <div
                    key={component.id}
                    className="rounded-md bg-muted p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {component.name}
                      </span>
                      <Badge variant="secondary">
                        {component.calls.length}{" "}
                        {component.calls.length === 1 ? "call" : "calls"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {component.calls.map((call) => (
                        <span
                          key={call.signature}
                          className="rounded bg-background px-2 py-0.5 text-xs font-mono text-muted-foreground"
                        >
                          {call.signature}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                <Separator />
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} size="lg">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="lg"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? "Submitting..."
              : `Submit ${ownerCount > 1 ? `${ownerCount} Proposals` : "Batch Proposal"}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
