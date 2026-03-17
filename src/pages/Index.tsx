import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (role === "formateur") return <Navigate to="/formateur" replace />;
  if (role === "eleve") return <Navigate to="/eleve" replace />;

  // No role yet — redirect to auth
  return <Navigate to="/auth" replace />;
};

export default Index;
