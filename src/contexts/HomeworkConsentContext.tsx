import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAIConsent } from '@/hooks/useAIConsent';
import { consentCapabilities } from '@/lib/homeworkConsent';

const Context = createContext({ ai: true, voice: true, loading: false });
export const useHomeworkConsent = () => useContext(Context);

function ScopedProvider({ children }: { children: ReactNode }) {
  const { consent, loading } = useAIConsent();
  const value = consentCapabilities(loading ? null : consent);
  return <Context.Provider value={{ ...value, loading }}>{children}</Context.Provider>;
}

export function HomeworkConsentProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return /^\/eleve\/devoirs(?:\/|$)/.test(pathname)
    ? <ScopedProvider>{children}</ScopedProvider> : <>{children}</>;
}

// Do not mount sensitive children when consent is missing (including their effects).
export function withHomeworkConsent<P extends object>(Component: ComponentType<P>, capability: 'ai' | 'voice' | 'both', fallback?: (props: P) => ReactNode) {
  return function HomeworkCapability(props: P) {
    const consent = useHomeworkConsent();
    const allowed = !consent.loading && (capability === 'both' ? consent.ai && consent.voice : consent[capability]);
    return allowed ? <Component {...props} /> : <>{fallback?.(props) ?? null}</>;
  };
}
