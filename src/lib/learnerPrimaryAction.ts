export type LearnerPrimaryAction = {
  eyebrow: string;
  title: string;
  description: string;
  button: string;
  path: string;
};

type PrimaryActionInput = {
  testLoading: boolean;
  testCompleted: boolean;
  pendingTestId?: string;
  session?: { id: string; remaining: number };
  homework?: { id: string; title?: string | null; expired: boolean };
};

export function getLearnerPrimaryAction(input: PrimaryActionInput): LearnerPrimaryAction | null {
  if (!input.testLoading && !input.testCompleted) {
    return {
      eyebrow: "Première étape",
      title: "Évalue ton niveau",
      description: "Ce test permet de te proposer des activités adaptées.",
      button: "Commencer le test",
      path: "/eleve/test-positionnement",
    };
  }

  if (input.pendingTestId) {
    return {
      eyebrow: "À faire maintenant",
      title: "Termine ton test de bilan",
      description: "Ton formateur l’a préparé pour vérifier ce que tu as retenu.",
      button: "Faire le test",
      path: `/eleve/bilan-test/${input.pendingTestId}`,
    };
  }

  if (input.session) {
    return {
      eyebrow: "À faire maintenant",
      title: "Continue les exercices de ta séance",
      description: `${input.session.remaining} activité${input.session.remaining > 1 ? "s" : ""} encore à faire.`,
      button: "Continuer",
      path: `/eleve/exercices-seance/${input.session.id}`,
    };
  }

  if (input.homework) {
    return {
      eyebrow: "À faire maintenant",
      title: input.homework.title || "Un devoir t’attend",
      description: input.homework.expired
        ? "La date conseillée est passée, mais tu peux encore le terminer."
        : "Avance à ton rythme. Ton brouillon sera enregistré.",
      button: "Ouvrir le devoir",
      path: `/eleve/devoirs/${input.homework.id}`,
    };
  }

  return null;
}
