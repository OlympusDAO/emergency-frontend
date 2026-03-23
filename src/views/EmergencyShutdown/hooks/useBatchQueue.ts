import { useState, useMemo, useCallback } from "react";
import type { EmergencyComponent, MultisigOwner } from "@/generated/emergency";

export function useBatchQueue() {
  const [batchQueue, setBatchQueue] = useState<EmergencyComponent[]>([]);

  const addToBatch = useCallback((component: EmergencyComponent) => {
    setBatchQueue((prev) =>
      prev.some((c) => c.id === component.id) ? prev : [...prev, component]
    );
  }, []);

  const removeFromBatch = useCallback((componentId: string) => {
    setBatchQueue((prev) => prev.filter((c) => c.id !== componentId));
  }, []);

  const clearBatch = useCallback(() => {
    setBatchQueue([]);
  }, []);

  const isInBatch = useCallback(
    (componentId: string) => batchQueue.some((c) => c.id === componentId),
    [batchQueue]
  );

  const batchByOwner = useMemo(() => {
    const grouped: Partial<Record<MultisigOwner, EmergencyComponent[]>> = {};
    for (const component of batchQueue) {
      const owner = component.owner;
      if (!grouped[owner]) grouped[owner] = [];
      grouped[owner].push(component);
    }
    return grouped;
  }, [batchQueue]);

  return {
    batchQueue,
    addToBatch,
    removeFromBatch,
    clearBatch,
    isInBatch,
    batchByOwner,
  };
}
