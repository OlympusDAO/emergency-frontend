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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EmergencyComponent, ChainId } from "@/generated/emergency";
import { EMERGENCY_ADDRESSES } from "@/generated/emergency";
import { IconExternalLink, IconCheck, IconX } from "@tabler/icons-react";

interface ShutdownConfirmModalProps {
  component: EmergencyComponent | null;
  chainId: ChainId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (component: EmergencyComponent) => Promise<{ safeTxHash: string; safeAppUrl: string }>;
  isPending: boolean;
}

export function ShutdownConfirmModal({
  component,
  chainId,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: ShutdownConfirmModalProps) {
  const [result, setResult] = useState<{
    safeTxHash: string;
    safeAppUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!component) return null;

  const addresses = EMERGENCY_ADDRESSES[chainId];
  const safeAddress =
    component.owner === "emergency"
      ? addresses?.multisigs.emergency
      : addresses?.multisigs.dao;

  const handleConfirm = async () => {
    try {
      setError(null);
      const res = await onConfirm(component);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setResult(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  // Success state
  if (result) {
    return (
      <AlertDialog open={open} onOpenChange={handleClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconCheck className="size-4 text-green-500" />
              Proposal Submitted
            </AlertDialogTitle>
            <AlertDialogDescription>
              The shutdown proposal for{" "}
              <span className="font-medium text-foreground">
                {component.name}
              </span>{" "}
              has been submitted to the Safe Transaction Service.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 px-0">
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="text-base font-semibold">Safe TX Hash</p>
              <p className="text-sm text-muted-foreground font-mono break-all">
                {result.safeTxHash}
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Close</AlertDialogCancel>
            <Button
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/80"
              onClick={() => window.open(result.safeAppUrl, "_blank")}
            >
              <IconExternalLink className="size-3.5" />
              Open in Safe App
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Confirmation state
  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <div className="flex items-start justify-between">
          <AlertDialogHeader className="flex-1">
            <AlertDialogTitle>Confirm Emergency Shutdown</AlertDialogTitle>
            <AlertDialogDescription>
            You are about to propose an emergency shutdown for{" "}
            <span className="font-medium text-foreground">
              {component.name}
            </span>
            . This action will create a Safe transaction that requires additional
            signatures to execute.
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

        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Component</span>
              <span className="text-sm font-medium text-foreground">{component.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Owner</span>
              <Badge
                variant="outline"
                className={component.owner === "emergency" ? "text-destructive" : ""}
              >
                {component.owner === "emergency" ? "Emergency MS" : "DAO MS"}
              </Badge>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm text-muted-foreground">Target Safe</span>
              <span className="text-xs font-mono break-all text-right max-w-[200px] text-foreground">
                {safeAddress ?? "N/A"}
              </span>
            </div>
          </div>

          <div>
            <p className="text-base font-semibold mb-1">Transaction Details</p>
            <div className="space-y-1">
              {component.calls.map((call) => (
                <div
                  key={call.signature}
                  className="rounded-md bg-muted p-2 text-sm font-mono"
                >
                  {call.signature}
                </div>
              ))}
            </div>
          </div>

          {component.shutdownCriteria.length > 0 && (
            <div>
              <p className="text-base font-semibold mb-1">Shutdown Criteria</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                {component.shutdownCriteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} size="lg">Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            size="lg"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Submitting..." : "Submit Shutdown Proposal"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
