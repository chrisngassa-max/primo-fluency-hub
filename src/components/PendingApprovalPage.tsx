import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, LogOut, RefreshCw } from "lucide-react";

const PendingApprovalPage = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Compte en attente de validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-base leading-relaxed">
            Votre compte est créé et rattaché à votre formateur. Il reste une dernière étape :
            votre formateur doit valider l'accès à la formation.
          </p>
          <div className="rounded-lg bg-muted/60 p-4 text-left text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Email confirmé
            </p>
            <p className="mt-2 flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 text-amber-600" /> Validation du formateur en attente
            </p>
            {user?.email && <p className="mt-3 text-xs text-muted-foreground">Compte : {user.email}</p>}
          </div>
          <p className="text-sm text-muted-foreground">
            Revenez sur cette page après la validation. Si l'attente dure, contactez directement votre formateur.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Vérifier mon accès
            </Button>
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApprovalPage;
