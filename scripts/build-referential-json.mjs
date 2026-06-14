import fs from "fs";
import path from "path";

const extractedDir = "C:/Users/Sofiane/Projects/primo-fluency-hub/scripts/_extracted";
const outDir = "C:/Users/Sofiane/Projects/primo-fluency-hub/supabase/functions/_shared/referential";
fs.mkdirSync(outDir, { recursive: true });

function extractJsonBlocks(text) {
  const blocks = [];
  const marker = "JSON{";
  let idx = 0;
  while (true) {
    const start = text.indexOf(marker, idx);
    if (start === -1) break;
    const jsonStart = start + "JSON".length;
    let depth = 0;
    let end = -1;
    for (let i = jsonStart; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) throw new Error(`Unclosed JSON at ${start}`);
    const raw = text.slice(jsonStart, end);
    blocks.push(JSON.parse(raw));
    idx = end;
  }
  return blocks;
}

function writeJson(name, data) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("Wrote", name);
}

const line24 = fs.readFileSync(path.join(extractedDir, "line-24.txt"), "utf8");
const line36 = fs.readFileSync(path.join(extractedDir, "line-36.txt"), "utf8");
const line46 = fs.readFileSync(path.join(extractedDir, "line-46.txt"), "utf8");

const v0Blocks = extractJsonBlocks(line24);
const v1Blocks = extractJsonBlocks(line36);
const structuresBlocks = extractJsonBlocks(line46);

// v0: pedagogical_rules, error_remediation_map, session_block_rules, demarche_weights, format_alias_map, threshold_rules
const v0Rules = v0Blocks.find((b) => Array.isArray(b.pedagogical_rules));
const v0Error = v0Blocks.find((b) => Array.isArray(b.error_remediation_map));
const v0Session = v0Blocks.find((b) => b.session_block_rules);
const v0Demarche = v0Blocks.find((b) => b.demarche_weights);
const v0Format = v0Blocks.find((b) => b.format_alias_map);
const v0Threshold = v0Blocks.find((b) => b.threshold_rules);

// v1 additions
const v1Rules = v1Blocks.find((b) => Array.isArray(b.pedagogical_rules));
const v1Error = v1Blocks.find((b) => Array.isArray(b.error_remediation_map));

const mergedRules = {
  version: "1.0",
  rules: [...(v0Rules?.pedagogical_rules ?? []), ...(v1Rules?.pedagogical_rules ?? [])],
};

// Merge error maps: v1 has priorite_par_niveau, v0 has more detail - merge by type_erreur_id
const errorMap = new Map();
for (const entry of v0Error?.error_remediation_map ?? []) {
  errorMap.set(entry.type_erreur_id, { ...entry });
}
for (const entry of v1Error?.error_remediation_map ?? []) {
  const existing = errorMap.get(entry.type_erreur_id) ?? {};
  errorMap.set(entry.type_erreur_id, { ...existing, ...entry });
}

writeJson("pedagogical_rules.json", mergedRules);
writeJson("error_remediation_map.json", {
  version: "1.0",
  entries: Array.from(errorMap.values()),
});
const v1Session = v1Blocks.find((b) => b.session_block_rules);
writeJson("session_block_rules.json", {
  version: "1.0",
  ...(v1Session?.session_block_rules ?? v0Session?.session_block_rules),
  ...(v0Session?.session_block_rules && v1Session?.session_block_rules
    ? {
        ordre_competences_recommande: v0Session.session_block_rules.ordre_competences_recommande,
        ponderation_focus_maintenance: v0Session.session_block_rules.ponderation_focus_maintenance,
        regles_par_groupe_niveau: v0Session.session_block_rules.regles_par_groupe_niveau,
        volume_seance: v0Session.session_block_rules.volume_seance,
      }
    : {}),
});
const v1Demarche = v1Blocks.find((b) => b.demarche_weights);
const v1Format = v1Blocks.find((b) => b.format_alias_map);
const v1Threshold = v1Blocks.find((b) => b.threshold_rules);
writeJson("demarche_weights.json", {
  version: "1.0",
  ...(v1Demarche?.demarche_weights ?? v0Demarche?.demarche_weights),
});
writeJson("format_alias_map.json", {
  version: "1.0",
  ...(v1Format?.format_alias_map ?? v0Format?.format_alias_map),
  discrimination_audio: { generateur: "qcm", options: ["support_audio", "paires_minimales"] },
  repetition_guidee: { generateur: "production_orale", options: ["mode_repetition", "etayage_fort"] },
});
writeJson("threshold_rules.json", {
  version: "1.0",
  ...(v1Threshold?.threshold_rules ?? v0Threshold?.threshold_rules),
});

// Structures pack
const pillars = structuresBlocks.find((b) => Array.isArray(b.structures_pillars));
const curriculum = structuresBlocks.find((b) => Array.isArray(b.structures_curriculum));
const measurement = structuresBlocks.find((b) => Array.isArray(b.structures_measurement_rules));
const switchRules = structuresBlocks.find((b) => Array.isArray(b.structures_switch_rules));
const errorMapStruct = structuresBlocks.find((b) => Array.isArray(b.structures_error_map));
const sessionMix = structuresBlocks.find((b) => Array.isArray(b.structures_session_mix));

writeJson("structures_pillars.json", { version: "1.0", pillars: pillars?.structures_pillars ?? [] });
writeJson("structures_curriculum.json", { version: "1.0", entries: curriculum?.structures_curriculum ?? [] });
writeJson("structures_measurement_rules.json", {
  version: "1.0",
  rules: measurement?.structures_measurement_rules ?? [],
});
writeJson("structures_switch_rules.json", { version: "1.0", rules: switchRules?.structures_switch_rules ?? [] });
const baseStructErrors = errorMapStruct?.structures_error_map ?? [];
const structErrorIds = new Set(baseStructErrors.map((e) => e.type_erreur_id));
const structErrorExtensions = [
  {
    type_erreur_id: "HORS_SUJET",
    pilier_principal: "vocabulaire",
    pilier_secondaire: "grammaire",
    contenu_cible: "Recadrage situation IRN, tri d'arguments pertinents",
    formats_recommandes: ["vrai_faux", "qcm", "selection_image"],
    priorite_par_niveau: { A0_A1: 3, A2_B1: 1, B2: 1 },
  },
  {
    type_erreur_id: "PRODUCTION_COURTE",
    pilier_principal: "grammaire",
    pilier_secondaire: "conjugaison",
    contenu_cible: "Connecteurs logiques, extension de phrase",
    formats_recommandes: ["transformation", "texte_lacunaire"],
    priorite_par_niveau: { A0_A1: 3, A2_B1: 1, B2: 2 },
  },
  {
    type_erreur_id: "REGISTRE",
    pilier_principal: "vocabulaire",
    pilier_secondaire: null,
    contenu_cible: "Formules de politesse, tu/vous, registre administratif",
    formats_recommandes: ["appariement", "vrai_faux"],
    priorite_par_niveau: { A0_A1: 3, A2_B1: 2, B2: 2 },
  },
  {
    type_erreur_id: "INTERPRETATION",
    pilier_principal: "vocabulaire",
    pilier_secondaire: "phonetique",
    contenu_cible: "Repérage d'indices, négation, mots-clés",
    formats_recommandes: ["qcm", "vrai_faux"],
    priorite_par_niveau: { A0_A1: 2, A2_B1: 2, B2: 3 },
  },
  {
    type_erreur_id: "JUSTIFICATION",
    pilier_principal: "grammaire",
    pilier_secondaire: null,
    contenu_cible: "Connecteurs argumentatifs (parce que, donc, puisque)",
    formats_recommandes: ["texte_lacunaire", "transformation", "qcm"],
    priorite_par_niveau: { A0_A1: 3, A2_B1: 3, B2: 1 },
  },
  {
    type_erreur_id: "COHERENCE_ADMIN",
    pilier_principal: "vocabulaire",
    pilier_secondaire: null,
    contenu_cible: "Lexique état civil, champs formulaire",
    formats_recommandes: ["appariement", "texte_lacunaire", "formulaire_cerfa_simplifie"],
    priorite_par_niveau: { A0_A1: 1, A2_B1: 3, B2: 3 },
  },
].filter((e) => !structErrorIds.has(e.type_erreur_id));

writeJson("structures_error_map.json", {
  version: "1.0",
  entries: [...baseStructErrors, ...structErrorExtensions],
});
writeJson("structures_session_mix.json", {
  version: "1.0",
  mixes: sessionMix?.structures_session_mix ?? [],
});

console.log("pedagogical_rules count:", mergedRules.rules.length);
console.log("error_remediation count:", errorMap.size);
console.log("structures_curriculum count:", curriculum?.structures_curriculum?.length ?? 0);
console.log("structures_switch_rules count:", switchRules?.structures_switch_rules?.length ?? 0);
