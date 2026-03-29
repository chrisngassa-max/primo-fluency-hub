import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { User, Mail, Lock, Save, Users, GraduationCap, TrendingUp } from "lucide-react";

const EleveProfil = () => {
  const { user } = useAuth();

  const [prenom, setPrenom] = useState(user?.user_metadata?.prenom ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch group info
  const { data: groupInfo, isLoading: groupLoading } = useQuery({
    queryKey: ["eleve-group-info", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group:groups(nom, niveau, formateur_id)")
        .eq("eleve_id", user!.id);
      if (!data || data.length === 0) return null;
      const group = (data[0] as any).group;
      if (!group) return null;
      // Get formateur name
      const { data: formateur } = await supabase
        .from("profiles")
        .select("prenom, nom")
        .eq("id", group.formateur_id)
        .single();
      return { nom: group.nom, niveau: group.niveau, formateur: formateur ? `${formateur.prenom} ${formateur.nom}` : "—" };
    },
    enabled: !!user?.id,
  });

  // Fetch student profile (niveau)
  const { data: profilEleve } = useQuery({
    queryKey: ["eleve-profil-niveau", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profils_eleves")
        .select("niveau_actuel, taux_reussite_global")
        .eq("eleve_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      let metaChanged = false;

      if (prenom !== (user?.user_metadata?.prenom ?? "")) {
        updates.data = { prenom };
        metaChanged = true;
      }

      if (email !== user?.email) {
        updates.email = email;
      }

      if (password) {
        if (password !== confirmPassword) {
          toast.error("Les mots de passe ne correspondent pas");
          setSaving(false);
          return;
        }
        if (password.length < 6) {
          toast.error("Le mot de passe doit contenir au moins 6 caractères");
          setSaving(false);
          return;
        }
        updates.password = password;
      }

      if (Object.keys(updates).length === 0) {
        toast.info("Aucune modification détectée");
        setSaving(false);
        return;
      }

      const { error } = await supabase.auth.updateUser(updates as any);
      if (error) throw error;

      if (metaChanged && user) {
        await supabase
          .from("profiles")
          .update({ prenom })
          .eq("id", user.id);
      }

      setPassword("");
      setConfirmPassword("");
      toast.success("Profil mis à jour !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Mon profil</h1>

      {/* Group & Level info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
            Ma formation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {groupLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : groupInfo ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Groupe
                </span>
                <span className="font-medium">{groupInfo.nom}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Niveau du groupe
                </span>
                <Badge variant="outline">{groupInfo.niveau}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Formateur
                </span>
                <span className="font-medium">{groupInfo.formateur}</span>
              </div>
              {profilEleve && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mon niveau actuel</span>
                  <Badge>{profilEleve.niveau_actuel}</Badge>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu n'es pas encore inscrit dans un groupe. Rejoins un groupe depuis ton tableau de bord.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Informations personnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prenom">Prénom</Label>
            <Input
              id="prenom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Ton prénom"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full text-base py-6"
        size="lg"
      >
        <Save className="h-5 w-5 mr-2" />
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
};

export default EleveProfil;
