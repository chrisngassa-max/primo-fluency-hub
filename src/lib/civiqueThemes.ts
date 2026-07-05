/** Thèmes officiels de l'examen civique (référentiel État, aligné plan-cadre S21+). */
export const CIVIQUE_THEMES = [
  {
    id: "principes_valeurs",
    titre: "Principes et valeurs de la République",
    description: "Devise, symboles, laïcité, Marianne, drapeau, hymne national.",
  },
  {
    id: "institutions",
    titre: "Système institutionnel et politique",
    description: "Constitution, séparation des pouvoirs, élections, démocratie.",
  },
  {
    id: "droits_devoirs",
    titre: "Droits et devoirs",
    description: "Droits fondamentaux, devoirs du citoyen, égalité femmes-hommes.",
  },
  {
    id: "histoire_culture",
    titre: "Histoire, géographie, culture",
    description: "Dates clés, territoires, patrimoine et identité culturelle.",
  },
  {
    id: "vivre_france",
    titre: "Vivre dans la société française",
    description: "Santé, emploi, école, services publics, vie quotidienne.",
  },
] as const;

export type CiviqueThemeId = (typeof CIVIQUE_THEMES)[number]["id"];
