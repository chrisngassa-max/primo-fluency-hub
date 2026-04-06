import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, BookOpen, TrendingUp, ArrowRight, X } from "lucide-react";

const ONBOARDING_KEY = "tcf-eleve-onboarding-done";

const steps = [
  {
    icon: ClipboardList,
    emoji: "📝",
    title: "Évalue ton niveau réel",
    description: "Passe le test de positionnement. Il analyse tes 4 compétences TCF et adapte ton programme. C'est la première étape pour réussir ton TCF IRN.",
  },
  {
    icon: BookOpen,
    emoji: "📚",
    title: "Fais tes exercices chaque semaine",
    description: "Tu reçois des exercices adaptés à ton niveau, formatés exactement comme l'examen TCF. Plus tu pratiques, plus tu gagnes des points.",
  },
  {
    icon: TrendingUp,
    emoji: "📈",
    title: "Suis ta progression vers B1",
    description: "Ton tableau de bord montre ta progression compétence par compétence. L'objectif : atteindre le niveau B1 avant ton examen.",
  },
];

interface EleveOnboardingProps {
  onComplete: () => void;
}

const EleveOnboarding = ({ onComplete }: EleveOnboardingProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const handleFinish = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
      // localStorage may be unavailable in iframe
    }
    onComplete();
  };

  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-xl relative">
        <button
          onClick={handleFinish}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === currentStep
                    ? "w-8 bg-primary"
                    : i < currentStep
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-4xl">{steps[currentStep].emoji}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Étape {currentStep + 1} sur {steps.length}
              </p>
              <h2 className="text-xl font-bold text-foreground mt-1">
                {steps[currentStep].title}
              </h2>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                {steps[currentStep].description}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                Précédent
              </Button>
            )}
            {isLast ? (
              <Button className="flex-1 gap-2" size="lg" onClick={handleFinish}>
                Commencer
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 gap-2"
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export function useShowOnboarding(): [boolean, () => void] {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) setShow(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return [show, () => setShow(false)];
}

export default EleveOnboarding;
