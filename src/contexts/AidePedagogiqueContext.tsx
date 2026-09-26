import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_AIDE_CONTEXT,
  type AidePedagogiqueContext,
} from "@/lib/avatar/pedagogicalTypes";

type AidePedagogiqueContextValue = {
  context: AidePedagogiqueContext;
  setAideContext: (patch: Partial<AidePedagogiqueContext>) => void;
  resetAideContext: () => void;
};

const AideCtx = createContext<AidePedagogiqueContextValue | null>(null);

export function AidePedagogiqueProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AidePedagogiqueContext>(DEFAULT_AIDE_CONTEXT);

  const setAideContext = useCallback((patch: Partial<AidePedagogiqueContext>) => {
    setContext((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetAideContext = useCallback(() => {
    setContext(DEFAULT_AIDE_CONTEXT);
  }, []);

  const value = useMemo(
    () => ({ context, setAideContext, resetAideContext }),
    [context, setAideContext, resetAideContext],
  );

  return <AideCtx.Provider value={value}>{children}</AideCtx.Provider>;
}

export function useAidePedagogique(): AidePedagogiqueContextValue {
  const value = useContext(AideCtx);
  if (!value) {
    return {
      context: DEFAULT_AIDE_CONTEXT,
      setAideContext: () => undefined,
      resetAideContext: () => undefined,
    };
  }
  return value;
}
