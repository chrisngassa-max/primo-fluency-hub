import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Copy, Check, Eye, EyeOff, ChevronRight, Ticket, Mail, Search, ArrowRightLeft, PlusCircle,
  KeyRound, RefreshCw, MessageCircle,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import InviteStudentDialog from "@/components/InviteStudentDialog";
import { detectAdvancedStudentsBatch, type AdvancedSignal } from "@/lib/detectAdvancedStudent";
import { AdvancedStudentBadge } from "@/components/AdvancedStudentBadge";
import { GroupeNiveauxMap, type EleveAvecNiveaux } from "@/components/formateur/GroupeNiveauxMap";
import { useSandbox } from "@/contexts/SandboxContext";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

const hasStudentIdentity = (member: any) => {
  const eleve = member?.eleve;
  return Boolean(
    String(eleve?.prenom ?? "").trim()
    || String(eleve?.nom ?? "").trim()
    || String(eleve?.email ?? "").trim(),
  );
};

const namesFromDisplayName = (displayName?: string) => {
  const parts = String(displayName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    prenom: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? "",
    nom: parts.length > 1 ? parts[parts.length - 1] : "",
  };
};

const getSandboxStudentIdentity = (student: any) => {
  if (!student) return null;
  const fromDisplay = namesFromDisplayName(student.display_name);
  return {
    id: student.user_id,
    prenom: fromDisplay.prenom,
    nom: fromDisplay.nom,
    email: String(student.email ?? "").trim(),
  };
};

interface CreatedStudent {
  prenom: string;
  nom: string;
  email: string;
  password: string;
}

interface PasswordDelivery {
  name: string;
  email: string;
  password: string;
}

const GroupesPage = () => {
  const { user } = useAuth();
  const { session: sandboxSession } = useSandbox();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "groupes");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams(value === "groupes" ? {} : { tab: value }, { replace: true });
  };

  // Create group dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("A1");
  const [desc, setDesc] = useState("");
  const [typeDemarche, setTypeDemarche] = useState<"titre_sejour" | "naturalisation">("titre_sejour");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      setSearchParams((current) => {
        current.delete("new");
        return current;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editNom, setEditNom] = useState("");
  const [editNiveau, setEditNiveau] = useState("A1");
  const [editDesc, setEditDesc] = useState("");
  const [editTypeDemarche, setEditTypeDemarche] = useState<"titre_sejour" | "naturalisation">("titre_sejour");

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
  const [searchQuery, setSearchQuery] = useState("");
  const [shownPasswords, setShownPasswords] = useState<Record<string, boolean>>({});
  const [resettingPwd, setResettingPwd] = useState<string | null>(null);

  // Set custom password dialog
  const [setPwdOpen, setSetPwdOpen] = useState(false);
  const [setPwdEleveId, setSetPwdEleveId] = useState<string | null>(null);
  const [setPwdEleveName, setSetPwdEleveName] = useState("");
  const [setPwdEleveEmail, setSetPwdEleveEmail] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customPwd, setCustomPwd] = useState("");
  const [showCustomPwd, setShowCustomPwd] = useState(false);
  const [savingCustomPwd, setSavingCustomPwd] = useState(false);
  const [passwordDelivery, setPasswordDelivery] = useState<PasswordDelivery | null>(null);

  const buildPasswordMessage = (delivery: PasswordDelivery) =>
    `Bonjour ${delivery.name},\n\nVoici vos identifiants CAP TCF :\nIdentifiant : ${delivery.email}\nMot de passe : ${delivery.password}\n\nLien : https://captcf.fr/#/eleve/login`;

  const sandboxIdentityById = useMemo(() => {
    return new Map((sandboxSession?.eleve_emails ?? [])
      .map((student: any) => [student.user_id, getSandboxStudentIdentity(student)] as const)
      .filter(([, identity]) => Boolean(identity)));
  }, [sandboxSession?.eleve_emails]);

  const hydrateSandboxIdentities = (members: any[] = []) => members.map((member: any) => {
    const identity = sandboxIdentityById.get(member.eleve_id);
    if (!identity || hasStudentIdentity(member)) return member;
    const current = member.eleve ?? {};
    return {
      ...member,
      eleve: {
        ...current,
        id: current.id ?? member.eleve_id,
        prenom: String(current.prenom ?? "").trim() || identity.prenom,
        nom: String(current.nom ?? "").trim() || identity.nom,
        email: String(current.email ?? "").trim() || identity.email,
      },
      eleve_missing_profile: false,
    };
  });

  const openSetPasswordDialog = (eleveId: string, eleveName: string, eleveEmail = "") => {
    setSetPwdEleveId(eleveId);
    setSetPwdEleveName(eleveName);
    setSetPwdEleveEmail(eleveEmail);
    setCustomEmail(eleveEmail);
    setCustomPwd("");
    setShowCustomPwd(false);
    setPasswordDelivery(null);
    setSetPwdOpen(true);
  };

  const handleSetPasswordOpenChange = (open: boolean) => {
    setSetPwdOpen(open);
    if (!open) {
      setPasswordDelivery(null);
      setCustomEmail("");
      setCustomPwd("");
      setShowCustomPwd(false);
    }
  };

  const copyDeliveryMessage = async () => {
    if (!passwordDelivery) return;
    await navigator.clipboard.writeText(buildPasswordMessage(passwordDelivery));
    setCopiedField("pwd-whatsapp");
    setTimeout(() => setCopiedField(null), 2000);
    toast.success("Message pret a envoyer copie.");
  };

  const handleSaveCustomPassword = async () => {
    if (!setPwdEleveId) return;
    const email = customEmail.trim().toLowerCase();
    const password = customPwd.trim();
    const emailChanged = !!email && email !== setPwdEleveEmail.toLowerCase();
    if (!emailChanged && !password) {
      toast.error("Modifiez l'email ou saisissez un nouveau mot de passe.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email invalide.");
      return;
    }
    if (password && password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setSavingCustomPwd(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-student-credentials", {
        body: {
          eleve_id: setPwdEleveId,
          ...(emailChanged ? { new_email: email } : {}),
          ...(password ? { new_password: password } : {}),
        },
      });
      if (error) throw new Error(data?.error || error.message);
      if (data?.error) throw new Error(data.error);
      const savedEmail = data?.email || setPwdEleveEmail;
      const savedPassword = data?.password || password;
      setShownPasswords((s) => ({ ...s, [setPwdEleveId]: true }));
      setSetPwdEleveEmail(savedEmail);
      if (savedPassword) {
        setPasswordDelivery({
          name: setPwdEleveName,
          email: savedEmail,
          password: savedPassword,
        });
      }
      toast.success(`Identifiants mis a jour pour ${setPwdEleveName}`);
      qc.invalidateQueries({ queryKey: ["all-group-members"] });
      qc.invalidateQueries({ queryKey: ["student-profile-info"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSavingCustomPwd(false);
    }
  };

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
  const [membersEdgeError, setMembersEdgeError] = useState<string | null>(null);
  const { data: allMembers } = useQuery<any[]>({
    queryKey: ["all-group-members", user?.id, sandboxSession?.id, sandboxSession?.eleve_emails?.map((student: any) => student.user_id).join(",")],
    queryFn: async () => {
      if (!groups || groups.length === 0) return [];
      const hasRealGroup = groups.some((g: any) => !g.sandbox_session_id);
      const { data, error } = await supabase.functions.invoke("formateur-group-members");
      if (error || data?.error) {
        const message = (error as any)?.message || data?.error || "Erreur inconnue";
        if (hasRealGroup) {
          // Surface visible error: silent fallback on real groups would be dangerous
          setMembersEdgeError(message);
          toast.error("Impossible de charger les élèves", {
            description: `Edge function formateur-group-members en échec : ${message}`,
          });
        } else {
          setMembersEdgeError(null);
        }
        const groupIds = groups.map((g) => g.id);
        const fallback = await supabase
          .from("group_members")
          .select("*, eleve:profiles(id, nom, prenom, email, mot_de_passe_initial)")
          .in("group_id", groupIds);
        if (fallback.error) throw fallback.error;
        return hydrateSandboxIdentities(fallback.data ?? []);
      }
      setMembersEdgeError(null);
      const members = (data?.members ?? []) as any[];
      if (members.some((member) => !hasStudentIdentity(member))) {
        const groupIds = groups.map((g) => g.id);
        const fallback = await supabase
          .from("group_members")
          .select("*, eleve:profiles(id, nom, prenom, email, mot_de_passe_initial)")
          .in("group_id", groupIds);
        if (!fallback.error && fallback.data?.length) {
          const fallbackById = new Map(fallback.data.map((member: any) => [member.id, member]));
          return hydrateSandboxIdentities(members.map((member) => hasStudentIdentity(member) ? member : fallbackById.get(member.id) ?? member));
        }
      }
      return hydrateSandboxIdentities(members);
    },
    enabled: !!groups && groups.length > 0,
  });

  // Fetch profils_eleves for progress display
  const { data: allProfils } = useQuery({
    queryKey: ["all-eleve-profils", user?.id],
    queryFn: async () => {
      if (!allMembers || allMembers.length === 0) return [];
      const eleveIds = [...new Set(allMembers.map((m: any) => String(m.eleve_id)).filter(Boolean))];
      const { data, error } = await supabase
        .from("profils_eleves")
        .select("eleve_id, taux_reussite_global, niveau_co, niveau_ce, niveau_ee, niveau_eo, profil_litteratie")
        .in("eleve_id", eleveIds);
      if (error) throw error;
      return data;
    },
    enabled: !!allMembers && allMembers.length > 0,
  });

  // ─── Détection "élève en avance" (formateur uniquement) ───
  const advancedEleveIds = useMemo<string[]>(
    () => [...new Set((allMembers ?? []).map((m: any) => String(m.eleve_id)).filter(Boolean))],
    [allMembers]
  );
  const { data: advancedMap = {} as Record<string, AdvancedSignal> } = useQuery({
    queryKey: ["groupes-advanced", user?.id, advancedEleveIds.join(",")],
    queryFn: () => detectAdvancedStudentsBatch(advancedEleveIds, user!.id),
    enabled: !!user?.id && advancedEleveIds.length > 0,
    staleTime: 60_000,
  });

  const getMembersForGroup = (groupId: string) =>
    (allMembers ?? []).filter((m: any) => m.group_id === groupId);

  const getProgress = (eleveId: string) => {
    const p = (allProfils ?? []).find((p: any) => p.eleve_id === eleveId);
    return p ? Math.round(Number(p.taux_reussite_global)) : 0;
  };

  const getStudentDisplayName = (member: any) => {
    const name = `${member.eleve?.prenom ?? ""} ${member.eleve?.nom ?? ""}`.trim();
    return name || (member.eleve_missing_profile ? "Profil élève à restaurer" : "Élève sans nom");
  };

  const sortedStudents = useMemo(() => {
    return [...(allMembers ?? [])].sort((a: any, b: any) => {
      const nomA = (a.eleve?.nom || "").toLowerCase();
      const nomB = (b.eleve?.nom || "").toLowerCase();
      return nomA.localeCompare(nomB);
    });
  }, [allMembers]);

  const handleCreate = async () => {
    if (!nom.trim()) { toast.error("Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("groups").insert({
        nom, niveau: niveau as any, description: desc || null, formateur_id: user!.id, type_demarche: typeDemarche,
      } as any);
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
        nom: editNom, niveau: editNiveau as any, description: editDesc || null, type_demarche: editTypeDemarche,
      } as any).eq("id", editId);
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

  const handleResetPassword = async (eleveId: string, eleveName: string) => {
    if (!confirm(`Réinitialiser le mot de passe de ${eleveName} ?\n\nUn nouveau mot de passe sera généré et l'ancien ne fonctionnera plus.`)) return;
    setResettingPwd(eleveId);
    try {
      const { data, error } = await supabase.functions.invoke("reset-student-password", {
        body: { eleve_id: eleveId },
      });
      if (error) throw new Error(data?.error || error.message);
      if (data?.error) throw new Error(data.error);
      setShownPasswords((s) => ({ ...s, [eleveId]: true }));
      toast.success(`Nouveau mot de passe : ${data.password}`, { duration: 10000 });
      qc.invalidateQueries({ queryKey: ["all-group-members"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setResettingPwd(null);
    }
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

  // Reassign student: move from current group to new group
  const handleReassign = async (membershipId: string, eleveId: string, newGroupId: string) => {
    try {
      const { error } = await supabase
        .from("group_members")
        .update({ group_id: newGroupId })
        .eq("id", membershipId);
      if (error) throw error;
      toast.success("Élève réassigné au nouveau groupe !");
      qc.invalidateQueries({ queryKey: ["all-group-members"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // Add student to an additional group
  const handleAddToGroup = async (eleveId: string, newGroupId: string) => {
    try {
      // Check if already in that group
      const existing = (allMembers ?? []).find((m: any) => m.eleve_id === eleveId && m.group_id === newGroupId);
      if (existing) {
        toast.warning("L'élève est déjà dans ce groupe.");
        return;
      }
      const { error } = await supabase.from("group_members").insert({
        eleve_id: eleveId,
        group_id: newGroupId,
      });
      if (error) throw error;
      toast.success("Élève ajouté au groupe !");
      qc.invalidateQueries({ queryKey: ["all-group-members"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // Get all groups for a specific student
  const getStudentGroups = (eleveId: string) => {
    return (allMembers ?? [])
      .filter((m: any) => m.eleve_id === eleveId)
      .map((m: any) => ({
        membershipId: m.id,
        groupId: m.group_id,
        group: (groups ?? []).find((g) => g.id === m.group_id),
      }));
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openEdit = (g: any) => {
    setEditId(g.id); setEditNom(g.nom); setEditNiveau(g.niveau); setEditDesc(g.description || ""); setEditTypeDemarche(g.type_demarche || "titre_sejour");
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
          <h1 className="text-3xl font-bold tracking-tight text-primary">Groupes & Élèves</h1>
          <p className="text-sm text-muted-foreground">Cliquez sur un groupe pour voir ses élèves.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-5"><Plus className="h-4 w-4 mr-2" />Nouveau groupe</Button>
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
              <div className="space-y-2">
                <Label>Type de démarche IRN</Label>
                <Select value={typeDemarche} onValueChange={(v) => setTypeDemarche(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="titre_sejour">Titre de séjour / Résidence (CO + CE)</SelectItem>
                    <SelectItem value="naturalisation">Naturalisation (CO + CE + EE + EO)</SelectItem>
                  </SelectContent>
                </Select>
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

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="groupes">Vue par Groupes</TabsTrigger>
          <TabsTrigger value="eleves">Vue par Élèves</TabsTrigger>
        </TabsList>

        <TabsContent value="groupes">
          {membersEdgeError && (
            <Card className="mb-3 border-destructive bg-destructive/5">
              <CardContent className="py-3 text-sm text-destructive flex items-start justify-between gap-3">
                <div>
                  <strong>Erreur de chargement des élèves.</strong> L'edge function <code>formateur-group-members</code> a échoué : {membersEdgeError}. Les données affichées proviennent d'un fallback direct sur <code>profiles</code> et peuvent être incomplètes.
                </div>
                <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["all-group-members"] })}>Réessayer</Button>
              </CardContent>
            </Card>
          )}
          {/* Empty state */}
          {groups && groups.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Aucun groupe</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Créez votre premier groupe pour commencer.</p>
                <Button onClick={() => setCreateOpen(true)} className="mt-4"><Plus className="h-4 w-4 mr-2" />Créer mon premier groupe</Button>
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
                              {members.length === 0 ? "Aucun élève" : members.length === 1 ? "1 élève" : `${members.length} élèves`}
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
                      <Button size="sm" onClick={() => openInvite(g.id, g.nom)}>
                        <Ticket className="h-4 w-4 mr-2" />Inviter par lien
                      </Button>
                      <Button size="sm" variant="link" className="text-xs" onClick={() => openAddStudent(g.id)}>
                        Créer un compte directement
                      </Button>
                    </div>

                    {/* Carte des niveaux du groupe */}
                    {members.length > 0 && (() => {
                      const elevesAvecNiveaux: EleveAvecNiveaux[] = members
                        .filter((m: any) => m.eleve)
                        .map((m: any) => {
                          const p = (allProfils ?? []).find((p: any) => p.eleve_id === m.eleve_id);
                          return {
                            id: m.eleve_id,
                            prenom: m.eleve.prenom ?? "",
                            nom: m.eleve.nom ?? "",
                            niveau_co: (p as any)?.niveau_co ?? "A1",
                            niveau_ce: (p as any)?.niveau_ce ?? "A1",
                            niveau_ee: (p as any)?.niveau_ee ?? "A1",
                            niveau_eo: (p as any)?.niveau_eo ?? "A1",
                            profil_litteratie: (p as any)?.profil_litteratie ?? "standard",
                          } satisfies EleveAvecNiveaux;
                        });
                      return <div className="mb-4"><GroupeNiveauxMap eleves={elevesAvecNiveaux} /></div>;
                    })()}

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
                               <th className="text-right py-2.5 px-3 font-medium text-muted-foreground w-52">Actions</th>
                             </tr>
                          </thead>
                          <tbody>
                            {members.map((m: any) => {
                              const prog = getProgress(m.eleve_id);
                              const eleve = m.eleve;
                              const studentName = getStudentDisplayName(m);
                              return (
                                <tr
                                  key={m.id}
                                  className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                                  onClick={() => navigate(`/formateur/eleves/${m.eleve_id}`)}
                                >
                                  <td className="py-2.5 px-3 font-medium">
                                    <div className="flex flex-col gap-1">
                                      <span>{studentName}</span>
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto w-fit p-0 text-xs font-semibold text-primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openSetPasswordDialog(m.eleve_id, studentName, eleve?.email || "");
                                        }}
                                      >
                                        <KeyRound className="mr-1 h-3.5 w-3.5" />
                                        Modifier email / mot de passe
                                      </Button>
                                    </div>
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
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost" size="icon" className="h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); navigate(`/formateur/eleves/${m.eleve_id}`); }}
                                        title="Voir le dossier"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openSetPasswordDialog(m.eleve_id, studentName, eleve?.email || "");
                                        }}
                                        title="Réinitialiser le mot de passe"
                                      >
                                        <KeyRound className="h-3.5 w-3.5" />
                                        Identifiants
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
        </TabsContent>

        <TabsContent value="eleves">
          {sortedStudents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Aucun élève inscrit</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Ajoutez des élèves à vos groupes pour les voir ici.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un nom ou prénom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prénom & Nom</TableHead>
                      <TableHead>Identifiant</TableHead>
                      <TableHead>Mot de passe</TableHead>
                      <TableHead>Groupe</TableHead>
                      <TableHead className="text-center">Progression</TableHead>
                      <TableHead className="text-center w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Deduplicate students (they may appear in multiple groups)
                      const seen = new Set<string>();
                      return sortedStudents
                        .filter((m: any) => {
                          if (seen.has(m.eleve_id)) return false;
                          seen.add(m.eleve_id);
                          if (!searchQuery.trim()) return true;
                          const q = searchQuery.toLowerCase();
                          return (m.eleve?.prenom || "").toLowerCase().includes(q) || (m.eleve?.nom || "").toLowerCase().includes(q);
                        })
                        .map((m: any) => {
                          const eleve = m.eleve;
                          const studentName = getStudentDisplayName(m);
                          const studentGroups = getStudentGroups(m.eleve_id);
                          const otherGroups = (groups ?? []).filter(
                            (g) => !studentGroups.some((sg) => sg.groupId === g.id)
                          );
                          const prog = getProgress(m.eleve_id);
                          return (
                            <TableRow key={m.eleve_id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span>{studentName}</span>
                                    <AdvancedStudentBadge signal={advancedMap[m.eleve_id]} compact />
                                  </div>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto w-fit p-0 text-xs font-semibold text-primary"
                                    onClick={() => openSetPasswordDialog(m.eleve_id, studentName, eleve?.email || "")}
                                  >
                                    <KeyRound className="mr-1 h-3.5 w-3.5" />
                                    Modifier email / mot de passe
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{eleve?.email || "—"}</code>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {eleve?.mot_de_passe_initial ? (
                                    <>
                                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono min-w-[80px] inline-block">
                                        {shownPasswords[m.eleve_id] ? eleve.mot_de_passe_initial : "••••••••"}
                                      </code>
                                      <Button
                                        variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => setShownPasswords((s) => ({ ...s, [m.eleve_id]: !s[m.eleve_id] }))}
                                        title={shownPasswords[m.eleve_id] ? "Masquer" : "Afficher"}
                                      >
                                        {shownPasswords[m.eleve_id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                      </Button>
                                      <Button
                                        variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => copyToClipboard(eleve.mot_de_passe_initial!, `pwd-${m.eleve_id}`)}
                                        title="Copier"
                                      >
                                        {copiedField === `pwd-${m.eleve_id}` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">non disponible</span>
                                  )}
                                  <Button
                                    variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs"
                                    onClick={() => openSetPasswordDialog(m.eleve_id, studentName, eleve?.email || "")}
                                    title="Réinitialiser avec un mot de passe choisi"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                    Réinitialiser
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => handleResetPassword(m.eleve_id, studentName)}
                                    disabled={resettingPwd === m.eleve_id}
                                    title="Générer un nouveau mot de passe aléatoire"
                                  >
                                    {resettingPwd === m.eleve_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-1">
                                  {studentGroups.map((sg) => (
                                    <DropdownMenu key={sg.membershipId}>
                                      <DropdownMenuTrigger asChild>
                                        <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                                          {sg.group?.nom || "—"}
                                          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="min-w-[180px]">
                                        <DropdownMenuLabel className="text-xs">Réassigner vers...</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {(groups ?? []).filter((g) => g.id !== sg.groupId).map((g) => (
                                          <DropdownMenuItem key={g.id} onClick={() => handleReassign(sg.membershipId, m.eleve_id, g.id)}>
                                            <ArrowRightLeft className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                            {g.nom} <Badge variant="secondary" className="ml-auto text-[10px]">{g.niveau}</Badge>
                                          </DropdownMenuItem>
                                        ))}
                                        {(groups ?? []).filter((g) => g.id !== sg.groupId).length === 0 && (
                                          <DropdownMenuItem disabled className="text-xs text-muted-foreground">Aucun autre groupe</DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive" onClick={() => handleRemoveMember(sg.membershipId)}>
                                          <UserMinus className="h-3.5 w-3.5 mr-2" />Retirer de {sg.group?.nom}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ))}
                                  {otherGroups.length > 0 && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer" title="Ajouter à un groupe">
                                          <PlusCircle className="h-3 w-3" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="min-w-[180px]">
                                        <DropdownMenuLabel className="text-xs">Ajouter au groupe...</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {otherGroups.map((g) => (
                                          <DropdownMenuItem key={g.id} onClick={() => handleAddToGroup(m.eleve_id, g.id)}>
                                            <PlusCircle className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                            {g.nom} <Badge variant="secondary" className="ml-auto text-[10px]">{g.niveau}</Badge>
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${progressColor(prog)}`}
                                      style={{ width: `${Math.max(prog, 4)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-8">{prog}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => navigate(`/formateur/eleves/${m.eleve_id}`)}
                                  title="Voir le dossier"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                    })()}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
            <div className="space-y-2">
              <Label>Type de démarche IRN</Label>
              <Select value={editTypeDemarche} onValueChange={(v) => setEditTypeDemarche(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="titre_sejour">Titre de séjour / Résidence (CO + CE)</SelectItem>
                  <SelectItem value="naturalisation">Naturalisation (CO + CE + EE + EO)</SelectItem>
                </SelectContent>
              </Select>
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
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(buildPasswordMessage({
                      name: `${createdStudent.prenom} ${createdStudent.nom}`.trim(),
                      email: createdStudent.email,
                      password: createdStudent.password,
                    }));
                    setCopiedField("new-whatsapp");
                    setTimeout(() => setCopiedField(null), 2000);
                    toast.success("Message pret a envoyer copie.");
                  }}
                  className="w-full gap-2"
                  variant="secondary"
                >
                  {copiedField === "new-whatsapp" ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  {copiedField === "new-whatsapp" ? "Message copie" : "Copier le message WhatsApp"}
                </Button>
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

      {/* Set custom password dialog */}
      <Dialog open={setPwdOpen} onOpenChange={handleSetPasswordOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier les identifiants</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Modifiez l'email ou choisissez un nouveau mot de passe pour <strong>{setPwdEleveName}</strong>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="custom-email">Email de connexion</Label>
              <Input
                id="custom-email"
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="eleve@email.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-pwd">Nouveau mot de passe (optionnel, 6 caracteres minimum)</Label>
              <div className="flex gap-2">
                <Input
                  id="custom-pwd"
                  type={showCustomPwd ? "text" : "password"}
                  value={customPwd}
                  onChange={(e) => setCustomPwd(e.target.value)}
                  placeholder="ex: bonjour2026"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCustomPwd((v) => !v)}
                  title={showCustomPwd ? "Masquer" : "Afficher"}
                >
                  {showCustomPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {passwordDelivery && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-primary">
                  Mot de passe mis a jour. Identifiants a transmettre :
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate"><strong>Identifiant :</strong> {passwordDelivery.email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copyToClipboard(passwordDelivery.email, "reset-email")}
                      title="Copier l'identifiant"
                    >
                      {copiedField === "reset-email" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span><strong>Mot de passe :</strong> <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{passwordDelivery.password}</code></span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copyToClipboard(passwordDelivery.password, "reset-pwd")}
                      title="Copier le mot de passe"
                    >
                      {copiedField === "reset-pwd" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <Button onClick={copyDeliveryMessage} className="w-full gap-2" variant="secondary">
                  {copiedField === "pwd-whatsapp" ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  {copiedField === "pwd-whatsapp" ? "Message copie" : "Copier le message WhatsApp"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleSetPasswordOpenChange(false)} disabled={savingCustomPwd}>
              Fermer
            </Button>
            <Button
              onClick={handleSaveCustomPassword}
              disabled={
                savingCustomPwd ||
                (
                  customEmail.trim().toLowerCase() === setPwdEleveEmail.toLowerCase() &&
                  customPwd.trim().length === 0
                ) ||
                (customPwd.trim().length > 0 && customPwd.trim().length < 6)
              }
            >
              {savingCustomPwd && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupesPage;
