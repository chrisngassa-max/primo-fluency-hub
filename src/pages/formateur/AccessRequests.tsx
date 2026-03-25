import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { UserCheck, Users, Plus, Inbox } from "lucide-react";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

const AccessRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedStudent, setSelectedStudent] = useState<{ id: string; prenom: string; nom: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupNiveau, setNewGroupNiveau] = useState("A1");
  const [mode, setMode] = useState<"existing" | "new">("existing");

  // Fetch pending students
  const { data: pendingStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ["pending-students"],
    queryFn: async () => {
      // We need to fetch profiles with status='pending' and role='eleve'
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, prenom, nom, email, created_at, status")
        .eq("status", "pending");

      if (error) throw error;

      // Filter to only eleves by checking user_roles
      if (!profiles || profiles.length === 0) return [];

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "eleve")
        .in("user_id", profiles.map(p => p.id));

      const eleveIds = new Set(roles?.map(r => r.user_id) || []);
      return profiles.filter(p => eleveIds.has(p.id));
    },
  });

  // Fetch formateur's groups
  const { data: groups } = useQuery({
    queryKey: ["formateur-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ studentId, groupId, newGroupName, newGroupNiveau }: {
      studentId: string; groupId?: string; newGroupName?: string; newGroupNiveau?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("approve-student", {
        body: {
          student_id: studentId,
          group_id: groupId || undefined,
          new_group_name: newGroupName || undefined,
          new_group_niveau: newGroupNiveau || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Élève approuvé et assigné au groupe !");
      queryClient.invalidateQueries({ queryKey: ["pending-students"] });
      queryClient.invalidateQueries({ queryKey: ["formateur-groups"] });
      setDialogOpen(false);
      resetDialog();
    },
    onError: (err: Error) => {
      toast.error("Erreur d'approbation", { description: err.message });
    },
  });

  const resetDialog = () => {
    setSelectedStudent(null);
    setSelectedGroupId("");
    setNewGroupName("");
    setNewGroupNiveau("A1");
    setMode("existing");
  };

  const openApproveDialog = (student: { id: string; prenom: string; nom: string }) => {
    setSelectedStudent(student);
    setMode(groups && groups.length > 0 ? "existing" : "new");
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedStudent) return;
    if (mode === "existing" && !selectedGroupId) {
      toast.error("Sélectionnez un groupe.");
      return;
    }
    if (mode === "new" && !newGroupName.trim()) {
      toast.error("Entrez un nom de groupe.");
      return;
    }
    approveMutation.mutate({
      studentId: selectedStudent.id,
      groupId: mode === "existing" ? selectedGroupId : undefined,
      newGroupName: mode === "new" ? newGroupName.trim() : undefined,
      newGroupNiveau: mode === "new" ? newGroupNiveau : undefined,
    });
  };

  if (loadingStudents) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Inbox className="h-6 w-6 text-primary" />
          Demandes d'accès
        </h1>
        <p className="text-muted-foreground mt-1">
          Validez les inscriptions des nouveaux élèves et assignez-les à un groupe.
        </p>
      </div>

      {!pendingStudents || pendingStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Aucune demande en attente</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les nouveaux élèves inscrits apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {pendingStudents.map((student) => (
            <Card key={student.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <p className="font-semibold text-base">
                    {student.prenom} {student.nom}
                  </p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Inscrit le {new Date(student.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Button onClick={() => openApproveDialog(student)} className="gap-2">
                  <UserCheck className="h-4 w-4" />
                  Approuver
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetDialog(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assigner {selectedStudent?.prenom} {selectedStudent?.nom} à un groupe
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Toggle between existing and new group */}
            <div className="flex gap-2">
              <Button
                variant={mode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("existing")}
                className="gap-2"
                disabled={!groups || groups.length === 0}
              >
                <Users className="h-4 w-4" />
                Groupe existant
              </Button>
              <Button
                variant={mode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("new")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Nouveau groupe
              </Button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-2">
                <Label>Sélectionner un groupe</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un groupe…" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nom} ({g.niveau})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-group-name">Nom du nouveau groupe</Label>
                  <Input
                    id="new-group-name"
                    placeholder="Ex: Groupe A2 Matin"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-group-niveau">Niveau</Label>
                  <Select value={newGroupNiveau} onValueChange={setNewGroupNiveau}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NIVEAUX.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleConfirm}
              disabled={approveMutation.isPending}
              className="w-full text-lg py-5 gap-2"
            >
              <UserCheck className="h-5 w-5" />
              {approveMutation.isPending ? "Validation…" : "Confirmer l'inscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccessRequests;
