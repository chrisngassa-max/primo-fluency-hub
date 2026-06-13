import { Contrast, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LearnerTextSize } from "@/lib/audioAccess";

interface Props {
  textSize: LearnerTextSize;
  highContrast: boolean;
  onTextSizeChange: (size: LearnerTextSize) => void;
  onHighContrastChange: (enabled: boolean) => void;
}

const sizes: LearnerTextSize[] = ["normal", "large", "extra-large"];

export default function LearnerAccessibilityToolbar({
  textSize,
  highContrast,
  onTextSizeChange,
  onHighContrastChange,
}: Props) {
  const currentIndex = sizes.indexOf(textSize);

  return (
    <div
      role="group"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
      aria-label="Réglages d’accessibilité"
    >
      <span className="text-sm font-semibold">Confort de lecture</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Réduire la taille du texte"
          title="Réduire le texte"
          disabled={currentIndex === 0}
          onClick={() => onTextSizeChange(sizes[Math.max(0, currentIndex - 1)])}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-12 text-center text-sm font-bold" aria-live="polite">
          {textSize === "normal" ? "A" : textSize === "large" ? "A+" : "A++"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Augmenter la taille du texte"
          title="Agrandir le texte"
          disabled={currentIndex === sizes.length - 1}
          onClick={() => onTextSizeChange(sizes[Math.min(sizes.length - 1, currentIndex + 1)])}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={highContrast ? "default" : "outline"}
          size="icon"
          className={highContrast ? "ml-2 bg-black text-white hover:bg-black/90" : "ml-2"}
          aria-label={highContrast ? "Désactiver le contraste renforcé" : "Activer le contraste renforcé"}
          aria-pressed={highContrast}
          title="Contraste renforcé"
          onClick={() => onHighContrastChange(!highContrast)}
        >
          <Contrast className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
