import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { attachCurriculumPathToSession } from "@/lib/curriculum/exerciseBridge";
import { inferCurriculumSessionCode } from "@/lib/curriculum/sessionCode";

interface AttachCurriculumPathButtonProps {
  sessionId: string;
  sessionTitle?: string | null;
  palierCible?: string | null;
  onAttached: () => void | Promise<void>;
}

export function AttachCurriculumPathButton({ sessionId, sessionTitle, palierCible, onAttached }: AttachCurriculumPathButtonProps) {
  const [loading, setLoading] = useState(false);
  const sessionCode = inferCurriculumSessionCode(sessionTitle);
  if (!sessionCode) return null;

  const handleAttach = async () => {
    setLoading(true);
    try {
      const result = await attachCurriculumPathToSession({ sessionId, sessionCode, palierCible });
      await onAttached();
      toast.success(`Parcours ${result.code} rattaché`, {
        description: result.linkedExercises > 0
          ? `${result.linkedExercises} activité(s) ajoutée(s) sur ${result.totalExercises}.`
          : `${result.totalExercises} activité(s) étaient déjà rattachées.`,
      });
    } catch (error) {
      toast.error(`Impossible de rattacher le parcours ${sessionCode}`, {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
      onClick={() => void handleAttach()}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
      Rattacher le parcours {sessionCode}
    </Button>
  );
}

export default AttachCurriculumPathButton;
