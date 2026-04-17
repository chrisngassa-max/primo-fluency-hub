// Mock data for "Suivi en direct de la classe" dashboard.
// Structure designed to be easily swapped for real backend data later.

export type LiveStudent = {
  id: string;
  nom: string;
  avatar?: string | null;
  groupe: string;
  lecon: string;
  exercice: string;
  progression: number; // 0-100
  taux_reussite: number; // 0-100
  tentatives_question: number;
  temps_inactif_s: number;
  question_actuelle: string;
  derniere_erreur?: string | null;
  alertes: string[];
};

export const mockGroupes = ["Groupe A1", "Groupe A2", "Groupe B1"];
export const mockLecons = [
  "Préfecture - vocabulaire",
  "CAF - documents",
  "Logement - dialogue",
  "Emploi - CV",
];

export const mockLiveStudents: LiveStudent[] = [
  {
    id: "s1",
    nom: "Aïcha Diallo",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "Préfecture - vocabulaire",
    exercice: "QCM Titres de séjour",
    progression: 78,
    taux_reussite: 82,
    tentatives_question: 1,
    temps_inactif_s: 12,
    question_actuelle: "Q7 — Quel document pour un renouvellement ?",
    derniere_erreur: null,
    alertes: [],
  },
  {
    id: "s2",
    nom: "Mohamed El Idrissi",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "Préfecture - vocabulaire",
    exercice: "QCM Titres de séjour",
    progression: 45,
    taux_reussite: 58,
    tentatives_question: 2,
    temps_inactif_s: 35,
    question_actuelle: "Q4 — Que signifie 'récépissé' ?",
    derniere_erreur: "A choisi 'reçu de paiement'",
    alertes: [],
  },
  {
    id: "s3",
    nom: "Fatou Sow",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "Préfecture - vocabulaire",
    exercice: "Texte lacunaire CAF",
    progression: 30,
    taux_reussite: 42,
    tentatives_question: 4,
    temps_inactif_s: 110,
    question_actuelle: "Q3 — Compléter : 'Je dois ___ une attestation'",
    derniere_erreur: "A écrit 'recevoir' au lieu de 'demander'",
    alertes: ["echecs_repetes", "inactivite"],
  },
  {
    id: "s4",
    nom: "Omar Benali",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "CAF - documents",
    exercice: "Compréhension orale CAF",
    progression: 92,
    taux_reussite: 88,
    tentatives_question: 1,
    temps_inactif_s: 5,
    question_actuelle: "Q9 — Audio : combien de pièces fournir ?",
    derniere_erreur: null,
    alertes: [],
  },
  {
    id: "s5",
    nom: "Lina Haddad",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "CAF - documents",
    exercice: "QCM Allocations",
    progression: 60,
    taux_reussite: 65,
    tentatives_question: 2,
    temps_inactif_s: 22,
    question_actuelle: "Q5 — Qui peut demander la prime d'activité ?",
    derniere_erreur: "Hésitation entre 2 réponses",
    alertes: [],
  },
  {
    id: "s6",
    nom: "Karim Touré",
    avatar: null,
    groupe: "Groupe B1",
    lecon: "Emploi - CV",
    exercice: "Production écrite : lettre de motivation",
    progression: 25,
    taux_reussite: 38,
    tentatives_question: 5,
    temps_inactif_s: 140,
    question_actuelle: "Q2 — Rédiger une phrase d'accroche",
    derniere_erreur: "Phrase incomplète, structure incorrecte",
    alertes: ["echecs_repetes", "inactivite"],
  },
  {
    id: "s7",
    nom: "Sara Mansouri",
    avatar: null,
    groupe: "Groupe B1",
    lecon: "Emploi - CV",
    exercice: "Production écrite : lettre de motivation",
    progression: 70,
    taux_reussite: 76,
    tentatives_question: 1,
    temps_inactif_s: 18,
    question_actuelle: "Q4 — Décrire son expérience",
    derniere_erreur: null,
    alertes: [],
  },
  {
    id: "s8",
    nom: "Yacine Bouzid",
    avatar: null,
    groupe: "Groupe A1",
    lecon: "Logement - dialogue",
    exercice: "Dialogue : visite d'appartement",
    progression: 50,
    taux_reussite: 55,
    tentatives_question: 2,
    temps_inactif_s: 95,
    question_actuelle: "Q6 — Compléter la réponse de l'agent",
    derniere_erreur: "A confondu 'loyer' et 'caution'",
    alertes: ["inactivite"],
  },
];

export const ALERT_THRESHOLDS = {
  ECHECS_QUESTION: 3, // > 3 échecs sur la même question
  INACTIVITE_S: 90, // > 90s sans action
};
