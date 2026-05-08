import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Users, TrendingUp, User } from "lucide-react";

const EleveProfil = () => {
  const { user } = useAuth();

  const [prenom, setPrenom] = useState(user?.user_metadata?.prenom ?? "");
  const [nom, setNom] = useState(user?.user_metadata?.nom ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

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
      const { data: formateur } = await supabase
        .from("profiles")
        .select("prenom, nom")
        .eq("id", group.formateur_id)
        .single();
      return { nom: group.nom, niveau: group.niveau, formateur: formateur ? `${formateur.prenom} ${formateur.nom}` : "—" };
    },
    enabled: !!user?.id,
  });

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

      if (
        prenom !== (user?.user_metadata?.prenom ?? "") ||
        nom !== (user?.user_metadata?.nom ?? "")
      ) {
        updates.data = { prenom, nom };
        metaChanged = true;
      }

      if (email !== user?.email) {
        updates.email = email;
      }

      if (password) {
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
          .update({ prenom, nom })
          .eq("id", user.id);
      }

      setPassword("");
      toast.success("Profil mis à jour !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const initiales = [user?.user_metadata?.prenom, user?.user_metadata?.nom]
    .filter(Boolean).map((s: string) => s[0].toUpperCase()).join("") || "?";

  const fullName = [user?.user_metadata?.prenom, user?.user_metadata?.nom]
    .filter(Boolean).join(" ") || "—";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-[28px] font-extrabold tracking-tight text-[#0b234a]">Profil Élève</h1>

      {/* Hero */}
      <div className="rounded-2xl p-6 flex flex-col items-center gap-2 shadow-sm bg-[#b4c5e4]">
        <div className="h-[88px] w-[88px] rounded-full bg-transparent border-2 border-[#0b234a]/30 flex items-center justify-center text-[32px] font-extrabold text-[#0b234a] shrink-0 mb-1">
          {initiales}
        </div>
        <p className="text-[22px] font-extrabold text-[#0b234a] tracking-tight">{fullName}</p>
        <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
          {profilEleve?.niveau_actuel && (
            <span className="text-xs font-bold bg-white/50 text-[#0b234a] px-3 py-1 rounded-md">
              {profilEleve.niveau_actuel}
            </span>
          )}
          {groupInfo && (
            <span className="text-xs font-bold bg-white/50 text-[#0b234a] px-3 py-1 rounded-md">
              {groupInfo.nom}
            </span>
          )}
        </div>
      </div>

      {/* Ma formation */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground">Ma formation</h2>
        <div className="rounded-[0.625rem] border bg-card divide-y shadow-sm">
          {groupLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : groupInfo ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-purple-500 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium">Groupe : {groupInfo.nom}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium">
                  Niveau actuel : {profilEleve?.niveau_actuel ?? groupInfo.niveau}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium">Formateur : {groupInfo.formateur}</span>
              </div>
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                Tu n'es pas encore inscrit dans un groupe. Rejoins un groupe depuis ton tableau de bord.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Informations personnelles */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground">Informations personnelles</h2>
        <div className="rounded-[0.625rem] border bg-card divide-y shadow-sm">
          <div className="px-4 py-1">
            <Input
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Prénom"
              className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm"
            />
          </div>
          <div className="px-4 py-1">
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom"
              className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm"
            />
          </div>
          <div className="px-4 py-1">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground">Sécurité</h2>
        <div className="rounded-[0.625rem] border bg-card shadow-sm">
          <div className="px-4 py-1">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoComplete="new-password"
              className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full cap-orange-button py-4 text-[17px]"
      >
        {saving ? "Enregistrement…" : "Enregistrer les modifications"}
      </button>
    </div>
  );
};

export default EleveProfil;
