# Mini-lot récupération banque CO préfecture — Rapport d'application

**Généré :** 2026-07-07T23:17:14Z  
**Commit :** 5e5683d  
**Migration :** `supabase/migrations/20260708150000_bank_recovery_co_prefecture.sql`  
**Dry-run :** `scripts/bank-recovery-co-prefecture-dry-run.mjs`  
**Mode :** préparation contrôlée — **0 écriture Supabase appliquée** (ROLLBACK par défaut)

## Verdict pré-COMMIT : **GO**

| Contrôle | Attendu | Dry-run | Statut |
|----------|---------|---------|--------|
| Backfill `theme=prefecture` | 1 | 1 éligible | ✅ |
| Promotion `approved_human` | 21 | 21 éligibles | ✅ |
| NR ambigus inchangés (L7) | 4 | 4 `needs_review` | ✅ |
| Champs interdits non touchés | — | contenu, consigne, format, niveau_vise, competence | ✅ |

## 1. Backfill métadonnées (1 exercice)

| ID complet | Titre | Action |
|------------|-------|--------|
| `634e81c6-fbd1-4c96-afb9-8d122e4f5610` | QCM : Démarches administratives en France | `theme='prefecture'`, `contexte_irn='prefecture'` (contexte_irn null → cohérent) |

**Préconditions vérifiées :** CO, B1, `validated_auto`, theme vide.

## 2. Promotion `approved_human` — 21 IDs exacts

Critères : `needs_review` → `approved_human`, `validation_profile` préservé (`legacy_bank`), `validation_source='human_recovery'`, `validation_issues` inchangés, `reviewed_at=now()`.

| # | ID complet | Préfixe |
|---|------------|---------|
| 1 | `fb7f5239-449d-4814-8600-6b17f3236017` | fb7f5239 |
| 2 | `12ede1af-823b-4284-a22b-777572c9e900` | 12ede1af |
| 3 | `3136af07-6d8a-41ea-8c34-7be16c843df8` | 3136af07 |
| 4 | `5448c46f-27cb-4add-8c67-9b3e4953d05c` | 5448c46f |
| 5 | `06be5180-3260-43bd-9b97-b908a11f6a68` | 06be5180 |
| 6 | `1b4d279d-6552-4e01-8d9b-5c5d426ddc36` | 1b4d279d |
| 7 | `1e3ff1eb-0028-4284-97c8-357669d73a9c` | 1e3ff1eb |
| 8 | `33382dd4-67d1-4435-8d69-890ac3e0ced8` | 33382dd4 |
| 9 | `3ea5f382-39ec-40eb-b2df-594f582e3eec` | 3ea5f382 |
| 10 | `556cba0c-d037-4684-8ada-a5c2e97f6e52` | 556cba0c |
| 11 | `8c4a82ee-81c2-46db-af6f-415ed6d08d08` | 8c4a82ee |
| 12 | `913a5b72-73ff-43f0-a7dd-a149d4e73050` | 913a5b72 |
| 13 | `9469de1a-f470-4e11-9b46-d5102d302a73` | 9469de1a |
| 14 | `91cefa80-42ec-4166-a41e-df5915b1c451` | 91cefa80 |
| 15 | `d88de779-5bd1-4981-9d7b-6f1cd37b9484` | d88de779 |
| 16 | `ad0f1e82-f166-4322-a237-ec4921f1fd6a` | ad0f1e82 |
| 17 | `c255174e-a56e-4f52-99d2-b652a5a84e50` | c255174e |
| 18 | `c5e62f1c-c187-4d90-bcfd-4ac281a7d730` | c5e62f1c |
| 19 | `d41f46b7-dbe3-4dce-b717-076debcfb022` | d41f46b7 |
| 20 | `de62e8d3-2561-4b58-883f-93d3391b9809` | de62e8d3 |
| 21 | `e64b08bc-c725-4eb5-b6a2-55c0d10f19f5` | e64b08bc |

## 3. Exclus — 4 NR ambigus (non modifiés)

| ID complet | Raison |
|------------|--------|
| `16ea8cbd-36a7-4131-90d1-a07f131e8541` | `ambiguous_correction` (L7) — reste `needs_review` |
| `73fa072e-8136-4552-ab8e-9f38de873464` | `ambiguous_correction` (L7) — reste `needs_review` |
| `5e1834e3-b2d9-472e-977c-42774a8437d9` | `ambiguous_correction` (L7) — reste `needs_review` |
| `c27c0b88-fd75-4b0e-bced-057a7055a480` | `ambiguous_correction` (L7) — reste `needs_review` |

## 4. Résultats dry-run Supabase (read-only)

```bash
node --import tsx scripts/bank-recovery-co-prefecture-dry-run.mjs
```

```
Backfill éligible: 1/1
Promotions éligibles: 21/21
Ambigus inchangés: 4/4
Verdict: GO
```

Artefact JSON : `docs/bank-recovery-co-prefecture-dry-run.json`

## 5. Vérifications SQL (dans la transaction, avant COMMIT)

La migration exécute en fin de transaction :

| Requête | Attendu |
|---------|---------|
| `theme_backfill_ok` | 1 |
| `approved_human_promoted` | 21 |
| `ambiguous_unchanged` | 4 |
| `forbidden_touched` | 0 |

**État actuel :** `ROLLBACK` actif — aucune persistance.

## 6. Procédure d'application (post-GO humain)

1. Relancer dry-run : `node --import tsx scripts/bank-recovery-co-prefecture-dry-run.mjs`
2. Exécuter migration en remplaçant `ROLLBACK` par `COMMIT` (ligne finale)
3. Contrôles post-apply :
   - S2 A2 CO préfecture : 5/5 retenus
   - S3 B1 CO préfecture : 5/5 retenus
4. Rollback manuel documenté en commentaire DOWN si erreur

## 7. Hors périmètre (confirmé)

- ❌ Génération IA
- ❌ `pedagogical_activities`
- ❌ B2 CE, B2 Structures, B1 EE
- ❌ Modification `contenu`, `consigne`, `format`, `niveau_vise`, `competence`

## 8. GO / NO-GO final

| Décision | **GO** — prêt pour COMMIT après validation humaine |
|----------|-----------------------------------------------------|
| Bloquant | Aucun — dry-run 1/1 + 21/21 + 4/4 conforme |
| Action requise | Remplacer `ROLLBACK` → `COMMIT` dans la migration puis appliquer |

---

_Rapport généré en préparation du mini-lot CO préfecture — audit source : `scripts/pre-session-bank-recovery-audit.mjs` (Backfill=1, approved_rec=21)._
