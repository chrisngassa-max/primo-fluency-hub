import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const homeRoute = role === "formateur" ? "/formateur" : role === "eleve" ? "/eleve" : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">Cette page n'existe pas</p>
        <p className="text-sm text-muted-foreground">
          L'adresse que vous avez saisie ne correspond à aucune page de l'application.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <Button onClick={() => navigate(homeRoute)} className="gap-2">
            <Home className="h-4 w-4" /> Accueil
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
