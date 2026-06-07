export interface DiagnosticQuestion {
  competence: string;
  choix?: string[];
  [key: string]: any;
}

export function parseNbQuestions(requestedNbQuestions: any, requestedNbQuestionsSnake: any): number {
  return Math.max(5, Math.min(30, Number(requestedNbQuestions ?? requestedNbQuestionsSnake ?? 10)));
}

export function validateDiagnosticQuestions(questions: DiagnosticQuestion[], expectedCount: number): string | null {
  if (!questions || !Array.isArray(questions)) {
    return "Questions missing or invalid format";
  }
  if (questions.length !== expectedCount) {
    return `Nombre de questions invalide : ${questions.length} reçues, ${expectedCount} attendues.`;
  }
  for (const q of questions) {
    if (["CO", "CE", "Structures"].includes(q.competence)) {
      if (q.choix && q.choix.length > 0 && q.choix.length !== 4) {
        return `QCM invalide : ${q.competence} doit avoir 4 choix`;
      }
    }
  }
  return null; // OK
}
