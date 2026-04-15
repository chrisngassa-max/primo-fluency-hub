import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import type { WizardState } from "../types";

interface Props {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onBack: () => void;
  onPublish: () => void;
}

const Step3_Assignation = ({ state, onChange, onBack, onPublish }: Props) => {
  const { user } = useAuth();

  // Fetch groups + members
  const { data: groups, isLoading } = useQuery({
    queryKey: ["formateur-groups-members", user?.id],
    queryFn: async () => {
      const { data: grps } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true);
      if (!grps?.length) return [];

      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, group_id, profiles:profiles(id, nom, prenom)")
        .in("group_id", grps.map((g) => g.id));

      return grps.map((g) => ({
        ...g,
        eleves: (members || [])
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => ({
            id: m.eleve_id,
            nom: `${m.profiles?.prenom || ""} ${m.profiles?.nom || ""}`.trim() || "Élève",
          })),
      }));
    },
    enabled: !!user,
  });

  const toggleEleve = (id: string) => {
    const current = new Set(state.elevesSelected);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    onChange({ elevesSelected: Array.from(current) });
  };

  const toggleGroup = (eleves: { id: string }[]) => {
    const ids = eleves.map((e) => e.id);
    const current = new Set(state.elevesSelected);
    const allIn = ids.every((id) => current.has(id));
    if (allIn) {
      ids.forEach((id) => current.delete(id));
    } else {
      ids.forEach((id) => current.add(id));
    }
    onChange({ elevesSelected: Array.from(current) });
  };

  return (
    <div className="space-y-6">
      {/* Récap */}
      <div>
        <p className="text-base font-semibold mb-2">
          {state.generated.length} exercice(s) prêt(s) à être publiés
        </p>
        <div className="flex flex-wrap gap-2">
          {state.generated.map((ex, i) => (
            <Badge key={i} variant="secondary" className="text-sm">
              {ex.titre || `Exercice ${i + 1}`}
            </Badge>
          ))}
        </div>
      </div>

      {/* Élèves */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Assigner à des élèves (optionnel)</Label>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !groups?.length ? (
          <p className="text-sm text-muted-foreground">Aucun groupe trouvé.</p>
        ) : (
          groups.map((g: any) => (
            <div key={g.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={g.eleves.length > 0 && g.eleves.every((e: any) => state.elevesSelected.includes(e.id))}
                  onCheckedChange={() => toggleGroup(g.eleves)}
                />
                <span className="text-sm font-semibold">{g.nom}</span>
                <Badge variant="outline" className="text-xs">{g.niveau}</Badge>
              </div>
              <div className="pl-6 space-y-1">
                {g.eleves.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={state.elevesSelected.includes(e.id)}
                      onCheckedChange={() => toggleEleve(e.id)}
                    />
                    <span className="text-sm">{e.nom}</span>
                  </div>
                ))}
                {g.eleves.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun élève</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Devoir switch */}
      {state.elevesSelected.length > 0 && (
        <div className="flex items-center gap-3">
          <Switch
            checked={state.creerCommeDevoir}
            onCheckedChange={(v) => onChange({ creerCommeDevoir: v })}
          />
          <Label className="text-base">Créer comme devoir immédiat</Label>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" size="lg" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Button
          size="xl"
          onClick={onPublish}
          disabled={state.loadingPublish}
          className="gap-2"
        >
          {state.loadingPublish ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          {state.loadingPublish ? "Publication…" : "Publier"}
        </Button>
      </div>
    </div>
  );
};

export default Step3_Assignation;
