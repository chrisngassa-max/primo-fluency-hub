import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Loader2, CheckCircle2 } from "lucide-react";

const JoinGroupCard = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const { data: memberships } = useQuery({
    queryKey: ["eleve-memberships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, group:groups(nom, niveau)")
        .eq("eleve_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length !== 6) {
      toast.error("Saisissez un code à 6 chiffres.");
      return;
    }
    setJoining(true);
    try {
      // Find invitation by code
      const { data: invitation, error: invErr } = await supabase
        .from("group_invitations")
        .select("id, group_id, expires_at, group:groups(nom)")
        .eq("code", trimmed)
        .maybeSingle();

      if (invErr) throw invErr;
      if (!invitation) {
        toast.error("Code invalide ou expiré.");
        return;
      }

      // Check expiration
      if (new Date(invitation.expires_at) < new Date()) {
        toast.error("Ce code d'invitation a expiré.");
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", invitation.group_id)
        .eq("eleve_id", user!.id)
        .maybeSingle();

      if (existing) {
        toast.info("Tu fais déjà partie de ce groupe !");
        setCode("");
        return;
      }

      // Join group
      const { error: joinErr } = await supabase
        .from("group_members")
        .insert({ group_id: invitation.group_id, eleve_id: user!.id });

      if (joinErr) throw joinErr;

      const groupName = (invitation as any).group?.nom || "le groupe";
      toast.success(`Tu as rejoint le groupe « ${groupName} » !`);
      setCode("");
      qc.invalidateQueries({ queryKey: ["eleve-memberships"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setJoining(false);
    }
  };

  const hasGroups = memberships && memberships.length > 0;

  return (
    <Card className={hasGroups ? "" : "border-primary/30 bg-primary/5"}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Users className="h-8 w-8 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">
                {hasGroups ? "Mes groupes" : "Rejoindre un groupe"}
              </h3>
              {hasGroups ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {memberships.map((m: any) => (
                    <Badge key={m.group_id} variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {m.group?.nom} ({m.group?.niveau})
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Entre le code donné par ton formateur pour rejoindre ton groupe.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Code à 6 chiffres"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="max-w-[180px] text-center text-lg tracking-widest font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <Button onClick={handleJoin} disabled={joining || code.length !== 6}>
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rejoindre"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JoinGroupCard;
