/** Taxonomie TCF IRN v1 — 16 types linguistiques (prompt classification IA). */
export const TAXONOMIE_COURTE = `
LEX_CONFUSION       — Faux ami, paronyme, mot dans le mauvais contexte (CO, CE, EE)
CONSIGNE_NC         — La réponse ne respecte pas la tâche demandée (toutes compétences)
GRAM_ACCORD         — Accord sujet-verbe ou nom-adjectif incorrect (EE, ST)
GRAM_TEMPS          — Temps verbal inadéquat (EE, EO, ST)
HORS_SUJET          — La production ne répond pas à la situation (EE, EO)
INTERPRETATION      — Contresens sur un document écrit ou audio (CE, CO)
JUSTIFICATION       — Absence d'arguments ou justification insuffisante (EE, EO)
PHONO               — Erreur de son qui gêne la compréhension (EO)
PRODUCTION_COURTE   — Nombre de mots ou durée insuffisants (EE, EO)
REGISTRE            — Tutoiement au lieu du vouvoiement, ton inadapté (EE, EO)
COHERENCE_ADMIN     — Incohérence formulaire (ex: date dans champ téléphone)
CO_DISCRIMINATION   — Distracteur phonologiquement proche de la bonne réponse (CO)
METHODO_REPERAGE    — Lecture non stratégique, repérage raté (CE)
STRUCT_CONJ         — Erreur de conjugaison en exercice Structures (ST)
STRUCT_MORPHO       — Erreur morphosyntaxique en exercice Structures (ST)
STRUCT_CONNECTEURS  — Connecteurs absents ou erronés (ST, CE, EE)
`.trim();
