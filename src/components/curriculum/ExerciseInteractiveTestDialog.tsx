import { useQuery } from "@tanstack/react-query";
import ExerciseStudentPreviewDialog from "@/components/ExerciseStudentPreviewDialog";
import { fetchExerciseBankDetail } from "@/lib/curriculum/exerciseLinks";

interface ExerciseInteractiveTestDialogProps {
  exerciseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciseInteractiveTestDialog({
  exerciseId,
  open,
  onOpenChange,
}: ExerciseInteractiveTestDialogProps) {
  const { data: exercise } = useQuery({
    queryKey: ["exercise-bank-detail", exerciseId],
    queryFn: () => fetchExerciseBankDetail(exerciseId!),
    enabled: open && !!exerciseId,
  });

  return (
    <ExerciseStudentPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      exercise={exercise ?? null}
      interactive
    />
  );
}
