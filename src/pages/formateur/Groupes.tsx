import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Users, Trash2, Edit, UserPlus, UserMinus, Loader2 } from "lucide-react";

const NIVEAUX = ["A1", "A2", "B1", "B2", "C1"] as const;

const GroupesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("A1");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editNom, setEditNom] = useState("");
  const [editNiveau, setEditNiveau] = useState("A1");
  const [editDesc, setEditDesc] = useState("");

  // Member management
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberGroupId, setMemberGroupId] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Fetch groups
  const { data: groups, isLoading } = useQuery({
    queryKey: ["formateur-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch members for selected group
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", memberGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, eleve:profiles(id, nom, prenom, email)")
        .eq("group_id", memberGroupId);
      if (error) throw error;
      return data;
    },
    enabled: !!memberGroupId && memberOpen,
  });

  // Fetch member counts
  const { data: memberCounts } = useQuery({
    queryKey: ["group-member-counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((m) => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
      return counts;
    },
    enabled: !!user,
  });

  const handleCreate = async () => {
    if (!nom.trim()) { toast.error("Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("groups").insert({
        nom, niveau: niveau as any, description: desc || null, formateur_id: user!.id,
      });
      if (error) throw error;
      toast.success("Groupe créé !");
      setCreateOpen(false);
      setNom(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["formateur-groups"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("groups").update({
        nom: editNom, niveau: editNiveau as any, description: editDesc || null,
      }).eq("id", editId);
      if (error) throw error;
      toast.success("Groupe modifié !");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["formateur-groups"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async (groupId: string) => {
    try {
      const { error } = await supabase.from("groups").delete().eq("id", groupId);
      if (error) throw error;
      toast.success("Groupe supprimé.");
      qc.invalidateQueries({ queryKey: ["formateur-groups"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) { toast.error("Entrez un email."); return; }
    setAddingMember(true);
    try {
      // Find eleve by email
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, nom, prenom")
        .eq("email", newMemberEmail.trim().toLowerCase());
      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) {
        toast.error("Aucun élève trouvé avec cet email.");
        return;
      }
      const eleveId = profiles[0].id;
      // Check not already member
      const existing = members?.find((m) => (m as any).eleve?.id === eleveId);
      if (existing) { toast.error("Cet élève est déjà dans le groupe."); return; }

      const { error } = await supabase.from("group_members").insert({
        group_id: memberGroupId, eleve_id: eleveId,
      });
      if (error) throw error;
      toast.success(`${profiles[0].prenom} ${profiles[0].nom} ajouté(e) !`);
      setNewMemberEmail("");
      qc.invalidateQueries({ queryKey: ["group-members", memberGroupId] });
      qc.invalidateQueries({ queryKey: ["group-member-counts"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (membershipId: string) => {
    try {
      const { error } = await supabase.from("group_members").delete().eq("id", membershipId);
      if (error) throw error;
      toast.success("Élève retiré du groupe.");
      qc.invalidateQueries({ queryKey: ["group-members", memberGroupId] });
      qc.invalidateQueries({ queryKey: ["group-member-counts"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const openEdit = (g: any) => {
    setEditId(g.id); setEditNom(g.nom); setEditNiveau(g.niveau); setEditDesc(g.description || "");
    setEditOpen(true);
  };

  const openMembers = (groupId: string) => {
    setMemberGroupId(groupId);
    setMemberOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Groupes & Élèves</h1>
          <p className="text-sm text-muted-foreground">Gérez vos groupes de formation.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouveau groupe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un groupe</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom du groupe</Label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Groupe A1 Mars 2026" />
              </div>
              <div className="space-y-2">
                <Label>Niveau</Label>
                <Select value={niveau} onValueChange={setNiveau}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Notes..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Groups list */}
      {groups && groups.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun groupe</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Créez votre premier groupe pour commencer.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(groups ?? []).map((g) => (
          <Card key={g.id} className="hover:border-primary/20 transition-colors">
            <CardContent className="py-4 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{g.nom}</p>
                      <Badge variant="outline">{g.niveau}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {memberCounts?.[g.id] || 0} élève(s)
                      </span>
                    </div>
                    {g.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{g.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMembers(g.id)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le groupe ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Les membres seront retirés.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(g.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le groupe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editNom} onChange={(e) => setEditNom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Niveau</Label>
              <Select value={editNiveau} onValueChange={setEditNiveau}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gérer les membres</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Add member */}
            <div className="flex gap-2">
              <Input
                placeholder="Email de l'élève"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
              />
              <Button onClick={handleAddMember} disabled={addingMember} size="sm">
                {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Members list */}
            {membersLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (members ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun membre.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(members ?? []).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{m.eleve?.prenom} {m.eleve?.nom}</p>
                      <p className="text-xs text-muted-foreground">{m.eleve?.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveMember(m.id)}>
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupesPage;
