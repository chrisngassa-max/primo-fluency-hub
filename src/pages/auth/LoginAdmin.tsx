import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const LoginAdmin = () => {
  const { signIn, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!loading && session && role === "admin") return <Navigate to="/admin" replace />;
  if (!loading && session && role === "formateur") return <Navigate to="/formateur" replace />;
  if (!loading && session && role === "eleve") return <Navigate to="/eleve" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    if (error) toast.error("Erreur de connexion", { description: error.message });
    else toast.success("Connexion réussie !");
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 dark:bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Button>

        <div className="text-center space-y-2">
          <span className="text-4xl" role="img" aria-label="Administration">🛡️</span>
          <h1 className="text-2xl font-bold text-foreground">Administration</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Adresse email</Label>
                <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Mot de passe</Label>
                <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginAdmin;
