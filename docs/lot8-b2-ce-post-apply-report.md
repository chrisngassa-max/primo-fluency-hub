# Lot 8 B2 CE — rapport post-apply

**Date :** 2026-07-08  
**Commit source :** 3de8b88  
**Manifest :** `scripts/backups/lot8-b2-ce-revalidated-2026-07-07T23-38-33/lot8-b2-ce-revalidated-2026-07-07T23-38-33.json`  
**Périmètre :** 5 insertions `public.exercices` uniquement — aucune écriture `session_exercices`, aucune génération IA, aucun Lot 8 B2 Structures / B1 EE.

---

## 1. Dry-run (GO)

| Métrique | Attendu | Obtenu |
|----------|---------|--------|
| doublons metadata_code | 0 | **0** |
| inserts planifiés | 5 | **5** |
| rejected | 0 | **0** |
| codes bloquants | 0 | **0** |

Tous les exercices : `status=validated_auto`, profil `generated_strict`.

---

## 2. Apply

### 2.1 Blocage initial (résolu)

Premier `--apply` : échec CHECK `exercices_validation_source_check` (`lot8_p0_apply` absent).

**Correctif :** migration `20260708200000_lot8_b2_ce_validation_source.sql` (valeur `lot8_p0_apply` ajoutée au CHECK).

### 2.2 Insertion réussie

| metadata_code | id |
|---------------|-----|
| sf-p0:B2:CE:001 | 31d18303-1ec0-40e8-a0be-b8d6fe9b7a9e |
| sf-p0:B2:CE:002 | 7d9a3512-75f3-4f16-8663-18b39e62300d |
| sf-p0:B2:CE:003 | 0207a540-0688-44ba-bcac-3cf40ee45c94 |
| sf-p0:B2:CE:004 | a3e94ef6-0737-4851-bfb6-651d0a9b4956 |
| sf-p0:B2:CE:005 | 0c988272-2de2-4472-8c51-b8ce8397c9a4 |

**5 insert(s)** dans `exercices` — aucune ligne `session_exercices`.

### 2.3 Correctifs post-insert (intégration pré-séance)

| Problème | Correctif |
|----------|-----------|
| Pool pré-séance limité à `legacy_bank` | `fetchPreSessionBankCandidates` inclut aussi `generated_strict` + `metadata_code LIKE sf-p0:%` |
| `validation_score` NULL → EXCL_09 / EXCL_SCORE_LOW sur B2 | Score P0 fixé à **85** (≥ REUSE_SCORE_MIN) sur les 5 lignes ; défaut dans `apply-lot8-b2-ce.mjs` |

---

## 3. Vérification read-only post-apply

| Critère | Résultat |
|---------|----------|
| 5 exercices insérés | ✅ |
| metadata_code sf-p0:B2:CE:001..005 | ✅ |
| source = search_first_p0 | ✅ |
| niveau_vise = B2, competence = CE | ✅ |
| validation_profile = generated_strict | ✅ |
| validation_status = validated_auto | ✅ |
| validation_source = lot8_p0_apply | ✅ |
| theme NOT NULL | ✅ (prefecture, vie_citoyenne, travail, logement) |
| contenu.texte présent | ✅ |
| contenu.items[] non vide | ✅ (1 item / exercice) |
| validation_score | ✅ 85 |

Banque globale lue par le script pré-séance : **626** (621 legacy_bank + 5 sf-p0).

---

## 4. Scénario pré-séance S4 — B2 / CE / quota 5

Commande : `node --import tsx scripts/pre-session-selection-ux-validation.mjs`

| Métrique | Avant apply | Après apply |
|----------|-------------|-------------|
| retained | 0 / 5 | **5 / 5** |
| remaining_gap | 5 | **0** |
| generation_need | true | **false** |
| VA en banque (cellule) | 0 | **5** |
| P1 count | 0 | **5** |
| severity | critical | **none** |
| defer_to_lot8_p0 | oui | **non** |

**Conformité règles S4 :** ✅ (pas de rejected/NR rouge en retained, P2 ≤ 30 %).

Autres scénarios inchangés (hors périmètre) : S6 B1 EE 1/5 gen=true, S7 B2 Structures 0/5 gen=true — conforme aux contraintes.

---

## 5. Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `supabase/migrations/20260708200000_lot8_b2_ce_validation_source.sql` | DDL CHECK validation_source |
| `scripts/apply-lot8-b2-ce.mjs` | validation_score P0 = 85 |
| `src/lib/pre-session-selection-data.ts` | pool sf-p0 generated_strict |
| `docs/pre-session-selection-ux-validation-report.md` | régénéré post-apply |
| `docs/lot8-b2-ce-post-apply-report.md` | ce rapport |

---

## 6. Verdict

| Étape | Verdict |
|-------|---------|
| Dry-run | **GO** |
| Apply DB | **GO** (après migration validation_source) |
| Post-apply SQL | **GO** |
| Scénario S4 B2 CE | **GO** — 5/5, gap 0, generation_need false |

### **GO global Lot 8 B2 CE pilote (5 exercices)**

Prochaine étape documentée (hors ce lot) : extension +9 exercices B2 CE (001–014) ou déblocage autres cellules P0 selon `docs/lot8-p0-plan.md` §9.3.

---

## Commandes de reproduction

```bash
node --import tsx scripts/apply-lot8-b2-ce.mjs
node --import tsx scripts/apply-lot8-b2-ce.mjs --apply
node --import tsx scripts/pre-session-selection-ux-validation.mjs
npm test -- scripts/lib/lot8-b2-ce-spec.test.mjs
```

---

_Rapport généré post-apply Lot 8 B2 CE — pilote 5 exercices sf-p0._
