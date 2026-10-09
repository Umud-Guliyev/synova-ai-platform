import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { demoInterventions, type Intervention } from "@/data/demo-orders";
import { createFromFactor, setStatus } from "@/lib/interventions";
import type { RiskFactor } from "@/lib/risk";

type Ctx = {
  interventions: Intervention[];
  updateStatus: (id: string, status: unknown) => void;
  createFromFactor: (orderId: string, factor: RiskFactor) => Intervention | null;
};

const InterventionsContext = createContext<Ctx | null>(null);

/** In-memory demo state: survives in-app navigation, resets on page reload. */
export function InterventionsProvider({ children }: { children: ReactNode }) {
  const [interventions, setInterventions] = useState<Intervention[]>(demoInterventions);

  const updateStatus = useCallback((id: string, status: unknown) => {
    setInterventions((l) => setStatus(l, id, status));
  }, []);

  const create = useCallback(
    (orderId: string, factor: RiskFactor) => {
      const r = createFromFactor(interventions, orderId, factor);
      if (r.created) setInterventions(r.list);
      return r.created;
    },
    [interventions],
  );

  const value = useMemo(() => ({ interventions, updateStatus, createFromFactor: create }), [interventions, updateStatus, create]);
  return <InterventionsContext.Provider value={value}>{children}</InterventionsContext.Provider>;
}

export function useInterventions(): Ctx {
  const ctx = useContext(InterventionsContext);
  if (!ctx) throw new Error("useInterventions must be used inside InterventionsProvider");
  return ctx;
}
