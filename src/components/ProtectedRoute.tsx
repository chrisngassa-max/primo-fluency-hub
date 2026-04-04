import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import PendingApprovalPage from "@/components/PendingApprovalPage";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "formateur" | "eleve" | "admin";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { session, role, profileStatus, loading } = useAuth();
  const isAuthResolved = !loading && (!session || (role !== null && profileStatus !== null));

  if (!isAuthResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    if (role === "formateur") return <Navigate to="/formateur" replace />;
    if (role === "eleve") return <Navigate to="/eleve" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  // Block pending students from accessing the eleve dashboard
  if (requiredRole === "eleve" && profileStatus === "pending") {
    return <PendingApprovalPage />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
