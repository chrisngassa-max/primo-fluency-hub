import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Users, Trash2, Edit, UserPlus, UserMinus, Loader2,
  Copy, Check, Eye, ChevronRight, Ticket, Mail,
} from "lucide-react";
import InviteStudentDialog from "@/components/InviteStudentDialog";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

interface CreatedStudent {
  prenom: string;
  nom: string;
  email: string;
  password: string;
}

const GroupesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Create group dialog
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

  // Add student dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addGroupId, setAddGroupId] = useState("");
  const [newPrenom, setNewPrenom] = useState("");
  const [newNom, setNewNom] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [inviteGroupName, setInviteGroupName] = useState("");

  // Track expanded groups to fetch members
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

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

  // Fetch members for ALL groups (simpler approach, one query)
  const { data: allMembers } = useQuery({
    queryKey: ["all-group-members", user?.id],
    queryFn: async () => {
      if (!groups || groups.length === 0) return [];
      const groupIds = groups.map((g) => g.id);
      const { data, error } = await supabase
        .from("group_members")
        .select("*, eleve:profiles(id, nom, prenom, email, mot_de_passe_initial)")
        .in("group_id", groupIds);
      if (error) throw error;
      return data;
    },
    enabled: !!groups && groups.length > 0,
  });

  // Fetch profils_eleves for progress display
  const { data: allProfils } = useQuery({
    queryKey: ["all-eleve-profils", user?.id],
    queryFn: async () => {
      if (!allMembers || allMembers.length === 0) return [];
      const eleveIds = [...new Set(allMembers.map((m: any) => m.eleve_id))];
      const { data, error } = await supabase
        .from("profils_eleves")
        .select("eleve_id, taux_reussite_global")
        .in("eleve_id", eleveIds);
      if (error) throw error;
      return data;
    },
    enabled: !!allMembers && allMembers.length > 0,
  });

  const getMembersForGroup = (groupId: string) =>
    (allMembers ?? []).filter((m: any) => m.group_id === groupId);

  const getProgress = (eleveId: string) => {
    const p = (allProfils ?? []).find((p: any) => p.eleve_id === eleveId);
    return p ? Math.round(Number(p.taux_reussite_global)) : 0;
  };

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

  const openAddStudent = (groupId: string) => {
    setAddGroupId(groupId);
    setCreatedStudent(null);
    setNewPrenom("");
    setNewNom("");
    setNewEmail("");
    setNewPassword("");
    setAddOpen(true);
  };

  const openInvite = (groupId: string, groupName: string) => {
    setInviteGroupId(groupId);
    setInviteGroupName(groupName);
    setInviteOpen(true);
  };

  const handleAddStudent = async () => {
    if (!newPrenom.trim() || !newNom.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("Tous les champs sont obligatoires.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setAddingMember(true);
    setCreatedStudent(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-student", {
        body: {
          prenom: newPrenom.trim(),
          nom: newNom.trim(),
          email: newEmail.trim(),
          password: newPassword.trim(),
          group_id: addGroupId,
        },
      });
      if (error) {
        // Try to extract server error message from the response
        const serverMsg = data?.error || error.message;
        throw new Error(serverMsg);
      }
      if (data?.error) throw new Error(data.error);

      const student = data.student as CreatedStudent;
      setCreatedStudent(student);
      setNewPrenom("");
      setNewNom("");
      setNewEmail("");
      setNewPassword("");
      toast.success(`${student.prenom} ${student.nom} créé(e) et ajouté(e) !`);
      qc.invalidateQueries({ queryKey: ["all-group-members"] });
    } catch (e: any) {
      toast.error("Erreur lors de la création", { description: e.message });
    } finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (membershipId: string) => {
    try {
      const { error } = await supabase.from("group_members").delete().eq("id", membershipId);
      if (error) throw error;
      toast.success("Élève retiré du groupe.");
      qc.invalidateQueries({ queryKey: ["all-group-members"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openEdit = (g: any) => {
    setEditId(g.id); setEditNom(g.nom); setEditNiveau(g.niveau); setEditDesc(g.description || "");
    setEditOpen(true);
  };

  const progressColor = (val: number) => {
    if (val >= 80) return "bg-green-500";
    if (val >= 60) return "bg-orange-400";
    if (val > 0) return "bg-destructive";
    return "bg-muted";
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
          <p className="text-sm text-muted-foreground">Cliquez sur un groupe pour voir ses élèves.</p>
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

      {/* Empty state */}
      {groups && groups.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun groupe</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Créez votre premier groupe pour commencer.</p>
          </CardContent>
        </Card>
      )}

      {/* Accordion groups */}
      <Accordion
        type="multiple"
        value={expandedGroups}
        onValueChange={setExpandedGroups}
        className="space-y-3"
      >
        {(groups ?? []).map((g) => {
          const members = getMembersForGroup(g.id);
          return (
            <AccordionItem key={g.id} value={g.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center">
                <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{g.nom}</span>
                        <Badge variant="outline">{g.niveau}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {members.length} élève(s)
                        </span>
                      </div>
                      {g.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{g.description}</p>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <div className="flex items-center gap-1 pr-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(g); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => e.stopPropagation()}>
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

              <AccordionContent className="px-4 pb-4 pt-0">
                {/* Action buttons */}
                <div className="flex justify-end gap-2 mb-3">
                  <Button size="sm" variant="outline" onClick={() => openInvite(g.id, g.nom)}>
                    <Ticket className="h-4 w-4 mr-2" />Inviter un élève
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openAddStudent(g.id)}>
                    <UserPlus className="h-4 w-4 mr-2" />Créer un compte élève
                  </Button>
                </div>

                {members.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Aucun élève dans ce groupe. Ajoutez-en un !
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                         <tr className="border-b">
                           <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Prénom & Nom</th>
                           <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Identifiant</th>
                           <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Progression</th>
                           <th className="text-center py-2.5 px-3 font-medium text-muted-foreground w-24">Actions</th>
                         </tr>
                      </thead>
                      <tbody>
                        {members.map((m: any) => {
                          const prog = getProgress(m.eleve_id);
                          const eleve = m.eleve;
                          return (
                            <tr
                              key={m.id}
                              className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => navigate(`/formateur/eleves/${m.eleve_id}`)}
                            >
                              <td className="py-2.5 px-3 font-medium">
                                {eleve?.prenom} {eleve?.nom}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[180px] truncate block">
                                    {eleve?.email || "—"}
                                  </code>
                                  {eleve?.email && (
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(eleve.email, `email-${m.id}`); }}
                                    >
                                      {copiedField === `email-${m.id}` ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${progressColor(prog)}`}
                                      style={{ width: `${Math.max(prog, 4)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-8">{prog}%</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/formateur/eleves/${m.eleve_id}`); }}
                                    title="Voir le dossier"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                    onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.id); }}
                                    title="Retirer du groupe"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

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

      {/* Add Student Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Créer un compte élève</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prénom</Label>
                <Input placeholder="Prénom" value={newPrenom} onChange={(e) => setNewPrenom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Nom</Label>
                <Input placeholder="Nom" value={newNom} onChange={(e) => setNewNom(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="email@exemple.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Mot de passe temporaire</Label>
              <Input type="text" placeholder="Minimum 6 caractères" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStudent()}
              />
            </div>
            <Button onClick={handleAddStudent} disabled={addingMember} className="w-full">
              {addingMember ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Créer et ajouter au groupe
            </Button>

            {createdStudent && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-primary">
                  ✅ Élève créé — notez ces identifiants :
                </p>
                <div className="space-y-2 text-sm">
                  <div><strong>Nom :</strong> {createdStudent.prenom} {createdStudent.nom}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate"><strong>Email :</strong> {createdStudent.email}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => copyToClipboard(createdStudent.email, "new-email")}>
                      {copiedField === "new-email" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span><strong>Mot de passe :</strong> <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{createdStudent.password}</code></span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => copyToClipboard(createdStudent.password, "new-pwd")}>
                      {copiedField === "new-pwd" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Student Dialog */}
      <InviteStudentDialog
        groupId={inviteGroupId}
        groupName={inviteGroupName}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  );
};

export default GroupesPage;
