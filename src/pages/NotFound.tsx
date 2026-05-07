import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import AppFooter from "@/components/AppFooter";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const homeRoute = role === "formateur" ? "/formateur" : role === "eleve" ? "/eleve" : "/";

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "linear-gradient(180deg, hsl(40 30% 95%) 0%, hsl(220 30% 90%) 100%)" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* 404 + icon overlay */}
        <div className="relative flex items-center justify-center mb-6">
          <span className="select-none font-extrabold text-[10rem] sm:text-[13rem] leading-none pointer-events-none"
            style={{ color: "hsl(220 30% 80%)" }}>
            404
          </span>
          <div className="absolute flex items-center justify-center">
            <GraduationCap className="h-14 w-14 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3 max-w-sm">
          <h1 className="text-2xl font-extrabold text-foreground">Oups ! Page introuvable</h1>
          <p className="text-muted-foreground leading-relaxed">
            Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-8 w-full max-w-sm space-y-4">
          <Button
            size="lg"
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-full text-base py-6"
            onClick={() => navigate(homeRoute)}
          >
            Retour à l'accueil
          </Button>
          <button
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
            onClick={() => navigate("/legal")}
          >
            Nous contacter
          </button>
        </div>
      </div>

      <AppFooter />
    </div>
  );
};

export default NotFound;
