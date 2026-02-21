import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconExternalLink } from "@tabler/icons-react";
import type { EmergencyComponent } from "@/generated/emergency";
import type { PendingProposal } from "../hooks";

interface EmergencyComponentCardProps {
  component: EmergencyComponent;
  status: "active" | "disabled" | "unknown";
  statusLoading: boolean;
  canExecute: boolean;
  onDisable: (component: EmergencyComponent) => void;
  pendingProposal?: PendingProposal;
}

const SEVERITY_VARIANT: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export function EmergencyComponentCard({
  component,
  status,
  statusLoading,
  canExecute,
  onDisable,
  pendingProposal,
}: EmergencyComponentCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle>{component.name}</CardTitle>
          <Badge
            variant={
              component.owner === "emergency" ? "destructive" : "secondary"
            }
          >
            {component.owner === "emergency" ? "Emergency MS" : "DAO MS"}
          </Badge>
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
          <Badge variant={SEVERITY_VARIANT[component.severity] ?? "outline"}>
            {component.severity}
          </Badge>
          {pendingProposal && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              Pending {pendingProposal.confirmations}/{pendingProposal.threshold}
            </Badge>
          )}
        </div>
        <CardDescription>{component.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
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
          <p className="text-xs font-medium text-muted-foreground mb-1">
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
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Shutdown Criteria
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              {component.shutdownCriteria.map((criteria) => (
                <li key={criteria}>{criteria}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-auto">
        {pendingProposal ? (
          <Button
            variant="outline"
            className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
            size="lg"
            onClick={() => window.open(pendingProposal.safeAppUrl, "_blank")}
          >
            <IconExternalLink className="size-3.5" />
            Pending Signatures ({pendingProposal.confirmations}/{pendingProposal.threshold}) — View in Safe
          </Button>
        ) : (
          <Button
            variant="destructive"
            className="w-full"
            size="lg"
            disabled={!canExecute || status === "disabled"}
            onClick={() => onDisable(component)}
          >
            {status === "disabled" ? "Already Disabled" : "Disable"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
