export type ExerciseModalityInput = {
  titre?: string | null;
  consigne?: string | null;
  competence?: string | null;
  format?: string | null;
  contenu?: Record<string, unknown> | null;
};

export type ExerciseModalityIssue = {
  code: string;
  message: string;
  field: string;
};

const firstText = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";

export function getExerciseReadingSupport(contenu?: Record<string, unknown> | null) {
  return firstText(
    contenu?.texte,
    contenu?.texte_support,
    contenu?.support_texte,
    contenu?.document,
    contenu?.support,
    contenu?.enonce,
    contenu?.contexte,
  );
}

export function getExerciseAudioSupport(contenu?: Record<string, unknown> | null) {
  return {
    script: firstText(contenu?.script_audio, contenu?.audio_script, contenu?.support_audio),
    url: firstText(contenu?.audio_url, contenu?.url_audio, contenu?.audio_src),
  };
}

export function validateExerciseModality(exercise: ExerciseModalityInput): ExerciseModalityIssue[] {
  const issues: ExerciseModalityIssue[] = [];
  const competence = String(exercise.competence ?? "").toUpperCase();
  const format = String(exercise.format ?? "").toLowerCase();
  const contenu = exercise.contenu ?? {};
  const items = Array.isArray(contenu.items) ? contenu.items : [];

  if (!firstText(exercise.titre)) {
    issues.push({ code: "missing_title", field: "titre", message: "Le titre est obligatoire." });
  }
  if (!firstText(exercise.consigne)) {
    issues.push({ code: "missing_instruction", field: "consigne", message: "La consigne est obligatoire." });
  }

  if (competence === "CO") {
    const audio = getExerciseAudioSupport(contenu);
    if (!audio.script && !audio.url) {
      issues.push({
        code: "missing_listening_control",
        field: "contenu.script_audio",
        message: "Compréhension orale : ajoutez un script ou un fichier audio pour afficher le bouton d’écoute.",
      });
    }
    if (items.length === 0) {
      issues.push({
        code: "missing_questions",
        field: "contenu.items",
        message: "Compréhension orale : ajoutez au moins une question.",
      });
    }
  }

  if (competence === "CE") {
    if (!getExerciseReadingSupport(contenu)) {
      issues.push({
        code: "missing_reading_support",
        field: "contenu.texte",
        message: "Compréhension écrite : ajoutez le texte que l’élève doit lire.",
      });
    }
    if (items.length === 0) {
      issues.push({
        code: "missing_questions",
        field: "contenu.items",
        message: "Compréhension écrite : ajoutez au moins une question.",
      });
    }
  }

  if (competence === "EE" && format !== "production_ecrite") {
    issues.push({
      code: "missing_writing_control",
      field: "format",
      message: "Expression écrite : utilisez le format production_ecrite pour afficher la zone de rédaction.",
    });
  }

  if (competence === "EO" && format !== "production_orale") {
    issues.push({
      code: "missing_recording_control",
      field: "format",
      message: "Expression orale : utilisez le format production_orale pour afficher l’enregistreur.",
    });
  }

  return issues;
}

export function assertExerciseModality(exercise: ExerciseModalityInput) {
  const issues = validateExerciseModality(exercise);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }
}
