import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Check, Loader2, Ticket, Link2, MessageCircle } from "lucide-react";

interface Props {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InviteStudentDialog = ({ groupId, groupName, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  const getInviteLink = (code: string) => {
    const publishedBase = "https://primo-fluency-hub.lovable.app";
    return `${publishedBase}/#/eleve/login?invite=${code}`;
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { error } = await supabase.from("group_invitations").insert({
        group_id: groupId,
        code,
        created_by: user!.id,
      });

      if (error) {
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
      toast.success("Code et lien d'invitation générés !");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(generatedCode!);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success("Code copié !");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getInviteLink(generatedCode!));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Lien copié !");
  };

  const copyWhatsAppMessage = async () => {
    const link = getInviteLink(generatedCode!);
    const msg = `📚 *Rejoins mon groupe CAP TCF « ${groupName} »*\n\nClique sur ce lien pour t'inscrire et rejoindre le groupe directement :\n👉 ${link}\n\n(Lien valable 7 jours)`;
    await navigator.clipboard.writeText(msg);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2000);
    toast.success("Message WhatsApp copié !");
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setGeneratedCode(null);
      setCopiedCode(false);
      setCopiedLink(false);
      setCopiedWhatsApp(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter des élèves — {groupName}</DialogTitle>
        </DialogHeader>

        {!generatedCode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Générez un lien d'invitation que vous pourrez envoyer directement
              sur WhatsApp ou par SMS. Vos élèves cliqueront dessus pour s'inscrire
              et rejoindre automatiquement ce groupe. Le lien est <strong>collectif</strong> :
              tous les élèves du groupe peuvent l'utiliser.
            </p>
            <Button onClick={generateCode} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Générer un lien d'invitation
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Code display */}
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Code d'invitation</p>
              <p className="text-3xl font-bold tracking-[0.3em] font-mono text-primary">
                {generatedCode}
              </p>
              <p className="text-xs text-muted-foreground">Valable 7 jours</p>
            </div>

            {/* WhatsApp message - primary action */}
            <div className="space-y-2">
              <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground">Message prêt à envoyer :</p>
                <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-line">
                  📚 <strong>Rejoins mon groupe CAP TCF « {groupName} »</strong>{"\n"}
                  Clique sur le lien pour t'inscrire :{"\n"}
                  👉 <span className="text-primary break-all">{getInviteLink(generatedCode)}</span>
                </p>
              </div>
              <Button onClick={copyWhatsAppMessage} className="w-full gap-2" size="lg">
                {copiedWhatsApp ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                {copiedWhatsApp ? "Copié !" : "Copier le message pour WhatsApp"}
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={copyLink} variant="outline" size="sm" className="gap-1.5">
                {copiedLink ? <Check className="h-3.5 w-3.5 text-primary" /> : <Link2 className="h-3.5 w-3.5" />}
                {copiedLink ? "Copié" : "Copier le lien"}
              </Button>
              <Button onClick={copyCode} variant="outline" size="sm" className="gap-1.5">
                {copiedCode ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? "Copié" : "Copier le code"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteStudentDialog;
