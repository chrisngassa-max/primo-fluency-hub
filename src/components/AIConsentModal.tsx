import { useState, useEffect } from "react";
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

const A1_TEXT = `Les devoirs écrits déterministes restent accessibles sans IA ni voix.
Les aides et bilans IA nécessitent ton accord pour l'IA.
Les fonctions vocales nécessitent ton accord pour la voix.
Tu peux choisir séparément et modifier tes choix dans ton profil.
Les autres parcours restent soumis à leurs conditions d'accès.`;

export default function AIConsentModal({ open, onClose, blocking = true }: Props) {
  const { accept, isFullyGranted, consent, loading } = useAIConsent();
  const [ai, setAi] = useState(false);
  const [bio, setBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playingTTS, setPlayingTTS] = useState(false);

  useEffect(() => {
    if (!loading && open) {
      setAi(!!consent?.consent_ai && !consent?.revoked_at);
      setBio(!!consent?.consent_biometric && !consent?.revoked_at);
    }
  }, [loading, open, consent?.consent_ai, consent?.consent_biometric, consent?.revoked_at]);

  const handleAccept = async () => {
    setSaving(true);
    const { error } = await accept(ai, bio, "modal");
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
      toast.message("Refus enregistré. Les devoirs écrits déterministes restent accessibles.");
      onClose?.();
    }
  };

  const playTTS = async () => {
    if (!isFullyGranted) return;
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
          <DialogTitle>Choisir mes consentements IA et voix</DialogTitle>
          <DialogDescription>
            Les devoirs écrits déterministes restent accessibles sans ces accords. Les fonctionnalités qui en dépendent restent protégées.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md bg-muted p-3 whitespace-pre-line">
            {A1_TEXT}
            {isFullyGranted && <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={playTTS} disabled={playingTTS}>
              <Volume2 className="h-4 w-4 mr-1" />
              {playingTTS ? "Lecture…" : "Écouter"}
            </Button>}
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
          <Button asChild variant="outline"><Link to="/eleve/devoirs">Mes devoirs écrits</Link></Button>
          <Button variant="outline" onClick={handleRefuse} disabled={saving || loading}>
            Je refuse
          </Button>
          <Button onClick={handleAccept} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Enregistrer mes choix
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
