import { Navigate } from "react-router-dom";
import { useAIConsent } from "@/hooks/useAIConsent";
import AIConsentModal from "./AIConsentModal";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  children: React.ReactNode;
}

/**
 * Guard for student pedagogical routes.
 * Requires both consent_ai === true AND consent_biometric === true.
 * Otherwise: shows a blocking consent modal (first time) or redirects to /eleve/acces-limite.
 */
export default function AIConsentRequiredRoute({ children }: Props) {
  const { consent, loading, isFullyGranted, hasAnswered } = useAIConsent();

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isFullyGranted) return <>{children}</>;

  // User already answered (refusal or revocation) → redirect to limited access page
  if (hasAnswered) {
    return <Navigate to="/eleve/acces-limite" replace />;
  }

  // First time → blocking modal
  return (
    <>
      <AIConsentModal open blocking />
      <div className="p-8">
        <Skeleton className="h-8 w-64" />
      </div>
    </>
  );
}
