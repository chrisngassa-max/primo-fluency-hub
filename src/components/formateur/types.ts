export interface ExerciceItem {
  question: string;
  options?: string[];
  bonne_reponse: string;
  explication?: string;
}

export interface ExerciceDraft {
  titre: string;
  consigne: string;
  format: string;
  competence: string;
  difficulte: number;
  contenu: {
    texte?: string;
    script_audio?: string;
    image_description?: string;
    items: ExerciceItem[];
    [key: string]: any;
  };
  metadata?: {
    code?: string;
    skill?: string;
    sub_skill?: string;
    time_limit_seconds?: number;
  };
  animation_guide?: any;
  variante_niveau_bas?: any;
  variante_niveau_haut?: any;
}

export interface PedagogicalReference {
  id: string;
  title: string;
  category?: string;
  level_min?: string;
  level_max?: string;
  objective?: string;
  format?: string;
}

export interface WizardState {
  step: 1 | 2 | 3;
  // Step 1
  themePredefini: string;
  themePersonnalise: string;
  competence: "CO" | "CE" | "EE" | "EO";
  count: number;
  niveau: "A0" | "A1" | "A2";
  difficulte: number;
  // Step 2
  generated: ExerciceDraft[];
  referencesUtilisees: PedagogicalReference[];
  loadingGenerate: boolean;
  // Step 3
  elevesSelected: string[];
  creerCommeDevoir: boolean;
  loadingPublish: boolean;
}
