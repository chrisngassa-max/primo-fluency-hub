// Constantes partagees par les schemas Zod et les scripts du pipeline curriculum v2.
// Source de verite : "CapTCF — Plan maitre de formation et d'implementation", section 8.

export const CURRICULUM_RESOURCE_STATUSES = [
  'planned',
  'preflight_passed',
  'generating',
  'generated',
  'deterministic_checked',
  'ai_reviewed',
  'publishable',
  'published',
  'quarantined',
  'superseded',
  'unpublished',
];

export const PALIERS = ['A2', 'B1', 'B2'];

export const CIVIC_MENTIONS = ['CSP', 'CR', 'NAT'];

export const NIVEAUX = ['A1', 'A2', 'B1', 'B2'];

export const COMPETENCES = ['CO', 'CE', 'EE', 'EO', 'ST', 'structures', 'civique'];

export const MODULES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const SESSION_KINDS = ['session', 'evaluation'];

export const GENERATION_MODES = [
  'deterministic',
  'ai_generated',
  'template',
  'reused',
  'tts',
  'raster_provider',
];

export const RIGHTS_STATUSES = [
  'public_domain',
  'licensed',
  'fictitious_pedagogical',
  'official_source',
  'cap_tcf_created',
];

// Section 3 : repartition horaire et paliers cumulatifs.
export const EXPECTED_HOURS = {
  A2: 80,
  B1: 100,
  B2: 120,
};

// Section 1.1 : bornes de code de seance par palier.
export const PALIER_SESSION_CODES = {
  A2: { sessions: ['S01', 'S25'], evaluations: ['E1', 'E2'] },
  B1: { sessions: ['S26', 'S31'], evaluations: ['E3'] },
  B2: { sessions: ['S32', 'S37'], evaluations: ['E4'] },
};

export const TOTAL_SESSION_COUNT = 37;
export const TOTAL_EVALUATION_COUNT = 4;
export const TOTAL_ENTRY_COUNT = TOTAL_SESSION_COUNT + TOTAL_EVALUATION_COUNT;
