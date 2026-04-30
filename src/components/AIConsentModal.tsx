import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAIConsent } from "@/hooks/useAIConsent";
import { toast } from "sonner";
import { Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose?: () => void;
  /** If true, the user cannot dismiss (used for first-time and post-revoke flows). */
  blocking?: boolean;
}

const A1_TEXT = `Cette formation utilise une IA.
L'IA corrige tes exercices et prépare ton travail.
Pour les exercices à l'oral, tu dois enregistrer ta voix.
Ton formateur peut écouter ta voix.
L'IA peut transformer ta voix en texte.
Pour utiliser l'application, tu dois accepter l'IA et la voix.
Si tu refuses, tu ne peux pas suivre la formation ici.`;

export default function AIConsentModal({ open, onClose, blocking = true }: Props) {
  const { accept } = useAIConsent();
  const [ai, setAi] = useState(false);
  const [bio, setBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playingTTS, setPlayingTTS] = useState(false);

  const handleAccept = async () => {
    if (!ai || !bio) {
      toast.error("Vous devez cocher les deux cases pour accepter.");
      return;
    }
    setSaving(true);
    const { error } = await accept(true, true, "modal");
    setSaving(false);
    if (error) toast.error("Erreur d'enregistrement du consentement");
    else {
      toast.success("Consentement enregistré");
      onClose?.();
    }
  };

  const handleRefuse = async () => {
    setSaving(true);
    const { error } = await accept(false, false, "modal_refusal");
    setSaving(false);
    if (error) toast.error("Erreur");
    else {
      toast.message("Refus enregistré. L'accès aux fonctionnalités pédagogiques est désactivé.");
      onClose?.();
    }
  };

  const playTTS = async () => {
    setPlayingTTS(true);
    try {
      const { data, error } = await supabase.functions.invoke("tcf-process-audio", {
        body: { action: "tts", text: A1_TEXT },
      });
      if (error || !data?.audioBase64) throw error || new Error("TTS failed");
      const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
      audio.onended = () => setPlayingTTS(false);
      await audio.play();
    } catch {
      toast.error("Lecture audio indisponible");
      setPlayingTTS(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !blocking) onClose?.(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => blocking && e.preventDefault()} onEscapeKeyDown={(e) => blocking && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Consentement IA et voix obligatoire</DialogTitle>
          <DialogDescription>
            Le traitement IA et le traitement vocal sont nécessaires à l'exécution de la formation sur captcf.fr.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md bg-muted p-3 whitespace-pre-line">
            {A1_TEXT}
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={playTTS} disabled={playingTTS}>
              <Volume2 className="h-4 w-4 mr-1" />
              {playingTTS ? "Lecture…" : "Écouter"}
            </Button>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={ai} onCheckedChange={(v) => setAi(v === true)} />
            <span>J'accepte l'utilisation de l'IA pour ma formation (correction, suivi, devoirs, bilans, adaptation pédagogique).</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={bio} onCheckedChange={(v) => setBio(v === true)} />
            <span>J'accepte l'enregistrement, la transcription et le traitement de ma voix pour les exercices oraux. Mon formateur peut écouter mes réponses.</span>
          </label>

          <p className="text-xs text-muted-foreground">
            <Link to="/legal" className="underline">Lire la politique de confidentialité</Link>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button variant="outline" onClick={handleRefuse} disabled={saving}>
            Je refuse
          </Button>
          <Button onClick={handleAccept} disabled={saving || !ai || !bio}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            J'accepte
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
