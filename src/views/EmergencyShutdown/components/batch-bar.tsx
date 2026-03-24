import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmergencyComponent, MultisigOwner } from "@/generated/emergency";

interface BatchBarProps {
  batchQueue: EmergencyComponent[];
  batchByOwner: Partial<Record<MultisigOwner, EmergencyComponent[]>>;
  onReview: () => void;
  onClear: () => void;
}

export function BatchBar({
  batchQueue,
  batchByOwner,
  onReview,
  onClear,
}: BatchBarProps) {
  if (batchQueue.length === 0) return null;

  const ownerCount = Object.keys(batchByOwner).length;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant="destructive">{batchQueue.length}</Badge>
          <span className="text-sm text-foreground">
            {batchQueue.length === 1 ? "component" : "components"} selected
          </span>
          {ownerCount > 1 && (
            <span className="text-xs text-muted-foreground">
              Will create {ownerCount} proposals (Emergency MS + DAO MS)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="default" onClick={onClear}>
            Clear
          </Button>
          <Button
            variant="default"
            size="default"
            className="bg-foreground text-background hover:bg-foreground/80 font-semibold !cursor-pointer"
            onClick={onReview}
          >
            Review Batch
          </Button>
        </div>
      </div>
    </div>
  );
}
