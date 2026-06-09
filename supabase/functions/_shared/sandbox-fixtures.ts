import type { NiveauSandbox } from "./sandbox.types.ts";

export interface SandboxLearnerFixture {
  niveau: NiveauSandbox;
  prenom: string;
  nom: string;
  profile: Record<string, unknown>;
  scores: number[];
  devoirs: Array<{
    statut: "en_attente" | "fait" | "expire" | "arrete";
    raison: "remediation" | "consolidation";
    dueOffsetDays: number;
    successes: number;
  }>;
}

export const SANDBOX_LEARNER_FIXTURES: Record<NiveauSandbox, SandboxLearnerFixture> = {
  A1: {
    niveau: "A1",
    prenom: "Mina",
    nom: "Diallo",
    profile: {
      niveau_actuel: "A1",
      niveau_co: "A0",
      niveau_ce: "A1",
      niveau_ee: "A0",
      niveau_eo: "A1",
      score_risque: 68,
      taux_reussite_global: 48,
      taux_reussite_co: 38,
      taux_reussite_ce: 61,
      taux_reussite_ee: 41,
      taux_reussite_eo: 55,
      taux_reussite_structures: 47,
      priorites_pedagogiques: ["Comprendre les consignes orales", "Construire une phrase simple"],
      fragilite_principale: "CO",
      type_erreur_dominant: "linguistique",
      seances_consecutives_sous_60: { CO: 3, CE: 0, EE: 2, EO: 1 },
      langue_maternelle: "soninke",
      autres_langues: ["bambara"],
      niveau_scolarisation: "primaire",
      aisance_numerique: "faible",
      projet_personnel: "Gagner en autonomie dans les demarches quotidiennes.",
      objectif_tcf: "irn",
      preferences_apprentissage: ["images", "repetition", "audio lent"],
      besoins_accessibilite: ["consignes courtes"],
      disponibilite_hors_seance: "Deux fois 20 minutes par semaine",
      type_demarche: "titre_sejour",
      vitesse_lecture: "lente",
    },
    scores: [34, 42, 48, 55, 58, 64],
    devoirs: [
      { statut: "fait", raison: "remediation", dueOffsetDays: -18, successes: 0 },
      { statut: "fait", raison: "remediation", dueOffsetDays: -11, successes: 0 },
      { statut: "expire", raison: "remediation", dueOffsetDays: -2, successes: 0 },
      { statut: "en_attente", raison: "remediation", dueOffsetDays: 4, successes: 0 },
    ],
  },
  A2: {
    niveau: "A2",
    prenom: "Youssef",
    nom: "Benali",
    profile: {
      niveau_actuel: "A2",
      niveau_co: "A1",
      niveau_ce: "A2",
      niveau_ee: "A2",
      niveau_eo: "A1",
      score_risque: 39,
      taux_reussite_global: 66,
      taux_reussite_co: 54,
      taux_reussite_ce: 76,
      taux_reussite_ee: 70,
      taux_reussite_eo: 57,
      taux_reussite_structures: 69,
      priorites_pedagogiques: ["Prendre la parole sans preparer", "Reperer les informations a l'oral"],
      fragilite_principale: "EO",
      type_erreur_dominant: "strategique",
      seances_consecutives_sous_60: { CO: 1, CE: 0, EE: 0, EO: 2 },
      langue_maternelle: "arabe",
      autres_langues: ["anglais"],
      niveau_scolarisation: "lycee",
      aisance_numerique: "bonne",
      projet_personnel: "Valider le niveau A2 pour renouveler son titre de sejour.",
      objectif_tcf: "irn",
      preferences_apprentissage: ["dialogues", "quiz", "situations pratiques"],
      besoins_accessibilite: [],
      disponibilite_hors_seance: "30 minutes le soir, trois fois par semaine",
      type_demarche: "titre_sejour",
      vitesse_lecture: "fluide",
    },
    scores: [52, 61, 58, 68, 72, 76, 74, 81],
    devoirs: [
      { statut: "fait", raison: "remediation", dueOffsetDays: -24, successes: 0 },
      { statut: "fait", raison: "consolidation", dueOffsetDays: -15, successes: 1 },
      { statut: "arrete", raison: "consolidation", dueOffsetDays: -7, successes: 2 },
      { statut: "en_attente", raison: "remediation", dueOffsetDays: 5, successes: 0 },
    ],
  },
  B1: {
    niveau: "B1",
    prenom: "Olena",
    nom: "Kravchenko",
    profile: {
      niveau_actuel: "B1",
      niveau_co: "B1",
      niveau_ce: "B1",
      niveau_ee: "A2",
      niveau_eo: "B1",
      score_risque: 51,
      taux_reussite_global: 71,
      taux_reussite_co: 78,
      taux_reussite_ce: 82,
      taux_reussite_ee: 55,
      taux_reussite_eo: 73,
      taux_reussite_structures: 64,
      priorites_pedagogiques: ["Organiser un texte argumente", "Stabiliser les accords"],
      fragilite_principale: "EE",
      type_erreur_dominant: "discursif",
      seances_consecutives_sous_60: { CO: 0, CE: 0, EE: 3, EO: 0 },
      langue_maternelle: "ukrainien",
      autres_langues: ["russe", "anglais"],
      niveau_scolarisation: "superieur",
      aisance_numerique: "bonne",
      projet_personnel: "Preparer une demande de naturalisation et reprendre une formation.",
      objectif_tcf: "irn",
      preferences_apprentissage: ["ecriture guidee", "corrections detaillees", "travail autonome"],
      besoins_accessibilite: [],
      disponibilite_hors_seance: "Variable selon les semaines",
      type_demarche: "naturalisation",
      vitesse_lecture: "fluide",
    },
    scores: [76, 82, 69, 74, 58, 63, 79],
    devoirs: [
      { statut: "fait", raison: "consolidation", dueOffsetDays: -28, successes: 1 },
      { statut: "fait", raison: "remediation", dueOffsetDays: -17, successes: 0 },
      { statut: "expire", raison: "remediation", dueOffsetDays: -5, successes: 0 },
      { statut: "en_attente", raison: "remediation", dueOffsetDays: 3, successes: 0 },
      { statut: "en_attente", raison: "consolidation", dueOffsetDays: 8, successes: 1 },
    ],
  },
  B2: {
    niveau: "B2",
    prenom: "Lucas",
    nom: "Martins",
    profile: {
      niveau_actuel: "B2",
      niveau_co: "B2",
      niveau_ce: "B2",
      niveau_ee: "B1",
      niveau_eo: "B2",
      score_risque: 14,
      taux_reussite_global: 86,
      taux_reussite_co: 91,
      taux_reussite_ce: 89,
      taux_reussite_ee: 76,
      taux_reussite_eo: 88,
      taux_reussite_structures: 84,
      priorites_pedagogiques: ["Nuancer une argumentation", "Gerer le temps en production ecrite"],
      fragilite_principale: "EE",
      type_erreur_dominant: "discursif",
      seances_consecutives_sous_60: { CO: 0, CE: 0, EE: 0, EO: 0 },
      langue_maternelle: "portugais",
      autres_langues: ["espagnol", "anglais"],
      niveau_scolarisation: "superieur",
      aisance_numerique: "bonne",
      projet_personnel: "Finaliser son dossier de naturalisation.",
      objectif_tcf: "irn",
      preferences_apprentissage: ["simulation d'examen", "debats", "retour synthetique"],
      besoins_accessibilite: [],
      disponibilite_hors_seance: "Une heure le week-end",
      type_demarche: "naturalisation",
      vitesse_lecture: "fluide",
    },
    scores: [78, 84, 88, 82, 91, 86, 94, 89, 92, 90],
    devoirs: [
      { statut: "fait", raison: "consolidation", dueOffsetDays: -30, successes: 1 },
      { statut: "arrete", raison: "consolidation", dueOffsetDays: -20, successes: 2 },
      { statut: "arrete", raison: "consolidation", dueOffsetDays: -10, successes: 2 },
      { statut: "en_attente", raison: "consolidation", dueOffsetDays: 7, successes: 1 },
    ],
  },
};

export function sandboxDate(daysFromNow: number, hour = 10) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

export function buildSandboxHistory(
  fixture: SandboxLearnerFixture,
  exerciseIds: string[],
) {
  if (!exerciseIds.length) return { devoirs: [], resultats: [] };

  const devoirs = fixture.devoirs.map((devoir, index) => ({
    ...devoir,
    exercise_id: exerciseIds[index % exerciseIds.length],
    created_at: sandboxDate(devoir.dueOffsetDays - 7, 9),
    due_at: sandboxDate(devoir.dueOffsetDays, 18),
  }));
  const completed = devoirs.filter((devoir) => devoir.statut === "fait" || devoir.statut === "arrete");
  const resultats = fixture.scores.map((score, index) => ({
    score,
    exercise_id: exerciseIds[index % exerciseIds.length],
    devoir_index: completed.length ? index % completed.length : null,
    created_at: sandboxDate(-(fixture.scores.length - index) * 4, 17),
  }));

  return { devoirs, resultats };
}
