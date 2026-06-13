import { useState } from "react";
import { CircleHelp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StudentHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StudentHelpDialog({ open, onOpenChange }: StudentHelpDialogProps) {
  const [category, setCategory] = useState("activite");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-student-help", {
        body: {
          category,
          message: message.trim(),
          page: window.location.hash.replace(/^#/, "") || "/eleve",
        },
      });
      if (error) throw new Error(data?.error || error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Ta demande a été envoyée à ton formateur.");
      setMessage("");
      setCategory("activite");
      onOpenChange(false);
    } catch (error) {
      toast.error("La demande n’a pas pu être envoyée.", {
        description: error instanceof Error ? error.message : "Réessaie dans quelques instants.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5" />
            Demander de l’aide
          </DialogTitle>
          <DialogDescription>
            Explique simplement où tu es bloqué. Ton formateur recevra ta demande.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="help-category">Mon problème concerne</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="help-category" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activite">Un exercice ou un devoir</SelectItem>
                <SelectItem value="audio">L’audio ou le micro</SelectItem>
                <SelectItem value="connexion">La connexion</SelectItem>
                <SelectItem value="comprehension">Je ne comprends pas quoi faire</SelectItem>
                <SelectItem value="autre">Autre problème</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="help-message">Message (facultatif)</Label>
            <Textarea
              id="help-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Exemple : je n’entends pas l’audio du devoir."
            />
            <p className="text-xs text-muted-foreground">{message.length}/500 caractères</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
