import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Printer, Save, Share2, CheckCircle2, XCircle, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface FeuilleAppelProps {
  sessionId: string;
  session: {
    titre: string;
    date_seance: string;
    duree_minutes: number;
    niveau_cible: string;
    group_id: string;
    group?: { nom: string; id: string };
  };
}

export default function FeuilleAppel({ sessionId, session }: FeuilleAppelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [presenceState, setPresenceState] = useState<Record<string, { present: boolean; commentaire: string }>>({});

  const groupId = (session as any)?.group?.id || session.group_id;

  // Fetch group members
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ["group-members-appel", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id, profiles:eleve_id(id, nom, prenom, email)")
        .eq("group_id", groupId);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        eleve_id: m.eleve_id,
        nom: m.profiles?.nom || "",
        prenom: m.profiles?.prenom || "",
        email: m.profiles?.email || "",
      }));
    },
    enabled: !!groupId,
  });

  // Fetch existing presences
  const { data: existingPresences, isLoading: loadingPresences } = useQuery({
    queryKey: ["presences", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presences")
        .select("*")
        .eq("session_id", sessionId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
  });

  // Initialize state from existing data
  useEffect(() => {
    if (!members) return;
    const state: Record<string, { present: boolean; commentaire: string }> = {};
    members.forEach((m) => {
      const existing = existingPresences?.find((p: any) => p.eleve_id === m.eleve_id);
      state[m.eleve_id] = {
        present: existing ? existing.present : false,
        commentaire: existing?.commentaire || "",
      };
    });
    setPresenceState(state);
  }, [members, existingPresences]);

  const togglePresence = (eleveId: string) => {
    setPresenceState((prev) => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], present: !prev[eleveId]?.present },
    }));
  };

  const setCommentaire = (eleveId: string, value: string) => {
    setPresenceState((prev) => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], commentaire: value },
    }));
  };

  const toggleAll = (present: boolean) => {
    setPresenceState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => (next[k] = { ...next[k], present }));
      return next;
    });
  };

  const handleSave = async () => {
    if (!members) return;
    setSaving(true);
    try {
      const upserts = members.map((m) => ({
        session_id: sessionId,
        eleve_id: m.eleve_id,
        present: presenceState[m.eleve_id]?.present ?? false,
        commentaire: presenceState[m.eleve_id]?.commentaire || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("presences")
        .upsert(upserts, { onConflict: "session_id,eleve_id" });

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["presences", sessionId] });
      toast.success("Feuille d'appel enregistrée");
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(presenceState).filter((p) => p.present).length;
  const totalCount = members?.length || 0;

  const handlePrint = () => {
    const groupName = (session as any)?.group?.nom || "Groupe";
    const dateStr = format(new Date(session.date_seance), "EEEE d MMMM yyyy", { locale: fr });

    const rows = (members || [])
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map((m, i) => {
        const p = presenceState[m.eleve_id];
        return `
        <tr>
          <td style="padding:10px 12px;border:1px solid #ddd;text-align:center;font-size:15px;">${i + 1}</td>
          <td style="padding:10px 12px;border:1px solid #ddd;font-size:15px;font-weight:600;">${m.nom.toUpperCase()} ${m.prenom}</td>
          <td style="padding:10px 12px;border:1px solid #ddd;text-align:center;font-size:20px;">
            ${p?.present ? "✅" : "❌"}
          </td>
          <td style="padding:10px 12px;border:1px solid #ddd;font-size:13px;color:#666;">
            ${p?.commentaire || ""}
          </td>
          <td style="padding:10px 12px;border:1px solid #ddd;min-width:120px;"></td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Feuille d'appel</title>
      <style>
        @page { margin: 20mm; }
        body { font-family: Arial, sans-serif; color: #222; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .meta { font-size: 14px; color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f3f4f6; padding: 10px 12px; border: 1px solid #ddd; font-size: 13px; text-align: left; }
        .summary { margin-top: 24px; padding: 12px; background: #f9fafb; border-radius: 8px; font-size: 14px; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; color: #888; }
        .signature { margin-top: 60px; border-top: 1px solid #ccc; width: 200px; text-align: center; padding-top: 8px; font-size: 12px; color: #888; }
      </style>
    </head><body>
      <h1>📋 Feuille d'appel — CAP TCF</h1>
      <div class="meta">
        <strong>${session.titre}</strong> · ${groupName} · Niveau ${session.niveau_cible}<br/>
        📅 ${dateStr} · ⏱ ${session.duree_minutes} minutes
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;">N°</th>
            <th>Nom & Prénom</th>
            <th style="width:80px;text-align:center;">Présent</th>
            <th>Observation</th>
            <th style="width:120px;">Signature</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <strong>Récapitulatif :</strong> ${presentCount} présent(s) / ${totalCount} inscrits · ${totalCount - presentCount} absent(s)
      </div>
      <div class="signature">Signature du formateur</div>
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.setTimeout(() => w.print(), 400);
    }
  };

  const handleShare = async () => {
    await handleSave();
    const groupName = (session as any)?.group?.nom || "Groupe";
    const dateStr = format(new Date(session.date_seance), "d MMMM yyyy", { locale: fr });
    const absentNames = (members || [])
      .filter((m) => !presenceState[m.eleve_id]?.present)
      .map((m) => `${m.prenom} ${m.nom}`)
      .join(", ");

    const text = `📋 *Feuille d'appel — ${session.titre}*
📅 ${dateStr} · ${groupName}
✅ Présents : ${presentCount}/${totalCount}
${totalCount - presentCount > 0 ? `❌ Absents : ${absentNames}` : "🎉 Aucune absence !"}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Appel ${session.titre}`, text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Récapitulatif copié dans le presse-papier (collez dans WhatsApp)");
    }
  };

  if (loadingMembers || loadingPresences) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!members || members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucun élève dans ce groupe</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Feuille d'appel
          </CardTitle>
          <Badge variant={presentCount === totalCount ? "default" : "secondary"}>
            {presentCount}/{totalCount} présent(s)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Tous présents
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Tous absents
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">N°</TableHead>
                <TableHead>Nom & Prénom</TableHead>
                <TableHead className="w-[80px] text-center">Présent</TableHead>
                <TableHead className="hidden md:table-cell">Observation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members
                .sort((a, b) => a.nom.localeCompare(b.nom))
                .map((m, i) => (
                  <TableRow
                    key={m.eleve_id}
                    className={presenceState[m.eleve_id]?.present ? "" : "bg-destructive/5"}
                  >
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {m.nom.toUpperCase()} {m.prenom}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={presenceState[m.eleve_id]?.present ?? false}
                        onCheckedChange={() => togglePresence(m.eleve_id)}
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Input
                        placeholder="Observation..."
                        value={presenceState[m.eleve_id]?.commentaire || ""}
                        onChange={(e) => setCommentaire(m.eleve_id, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimer PDF
          </Button>
          <Button variant="outline" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" /> Partager
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
