import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Check, Loader2, Ticket } from "lucide-react";

interface Props {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InviteStudentDialog = ({ groupId, groupName, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateCode = async () => {
    setGenerating(true);
    try {
      // Generate a random 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));

      const { error } = await supabase.from("group_invitations").insert({
        group_id: groupId,
        code,
        created_by: user!.id,
      });

      if (error) {
        // If unique constraint violation, retry
        if (error.code === "23505") {
          const retryCode = String(Math.floor(100000 + Math.random() * 900000));
          const { error: retryErr } = await supabase.from("group_invitations").insert({
            group_id: groupId,
            code: retryCode,
            created_by: user!.id,
          });
          if (retryErr) throw retryErr;
          setGeneratedCode(retryCode);
        } else {
          throw error;
        }
      } else {
        setGeneratedCode(code);
      }
      toast.success("Code d'invitation généré !");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const copyMessage = async () => {
    const msg = `Rejoignez mon groupe TCF Pro « ${groupName} » avec le code : ${generatedCode}`;
    await navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Message copié !");
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setGeneratedCode(null);
      setCopied(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter un élève — {groupName}</DialogTitle>
        </DialogHeader>

        {!generatedCode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Générez un code d'invitation à 6 chiffres que vos élèves pourront saisir
              dans leur espace pour rejoindre ce groupe. Le code est valable 7 jours.
            </p>
            <Button onClick={generateCode} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              Générer un code d'invitation
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Code d'invitation :</p>
              <p className="text-4xl font-bold tracking-[0.3em] font-mono text-primary">
                {generatedCode}
              </p>
              <p className="text-xs text-muted-foreground">Valable 7 jours</p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground italic">
                « Rejoignez mon groupe TCF Pro « {groupName} » avec le code : {generatedCode} »
              </p>
            </div>

            <Button onClick={copyMessage} variant="outline" className="w-full gap-2">
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copié !" : "Copier le message"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteStudentDialog;
