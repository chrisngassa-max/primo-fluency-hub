# Mini-lot récupération banque CO préfecture — Rapport post-application

**Généré :** 2026-07-08T01:22:00+02:00  
**Commit :** d7ba6cb (+ COMMIT migration)  
**Migration :** `supabase/migrations/20260708150000_bank_recovery_co_prefecture.sql`  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw`  
**Mode :** application contrôlée — **COMMIT appliqué via MCP `apply_migration`**

## Verdict post-apply : **GO**

| Contrôle | Attendu | Post-apply | Statut |
|----------|---------|------------|--------|
| Backfill `theme=prefecture` + `contexte_irn=prefecture` | 1 | 1 (`634e81c6`) | ✅ |
| Promotion `approved_human` / `human_recovery` | 21 | 21 | ✅ |
| NR ambigus inchangés (L7) | 4 | 4 `needs_review` | ✅ |
| Champs interdits non touchés | — | contenu, consigne, format, niveau_vise, competence | ✅ |
| Génération IA | 0 | 0 | ✅ |
| Autres exercices touchés | 0 | 0 (hors périmètre) | ✅ |

## 1. Dry-run pré-application

```bash
node --import tsx scripts/bank-recovery-co-prefecture-dry-run.mjs
```

| Métrique | Résultat |
|----------|----------|
| Backfill éligible | 1/1 |
| Promotions éligibles | 21/21 |
| Ambigus inchangés | 4/4 |
| Verdict | **GO** |

Artefact : `docs/bank-recovery-co-prefecture-dry-run.json` (pré-apply, verdict GO)

## 2. Application migration

- `ROLLBACK` remplacé par `COMMIT` dans `supabase/migrations/20260708150000_bank_recovery_co_prefecture.sql`
- Appliqué via MCP Supabase `apply_migration` (projet `gudcenhmzlcvhgbgklzw`)
- Résultat : `success: true`

### Vérifications SQL post-apply

| Requête | Attendu | Obtenu |
|---------|---------|--------|
| `634e81c6` theme/contexte_irn | `prefecture` / `prefecture` | ✅ |
| `approved_human` + `human_recovery` (21 IDs) | 21 | 21 |
| Ambigus `needs_review` (4 IDs) | 4 | 4 |
| Ambigus promus `approved_human` | 0 | 0 |

**Détail backfill :**

| ID | theme | contexte_irn | validation_status |
|----|-------|--------------|-------------------|
| `634e81c6-fbd1-4c96-afb9-8d122e4f5610` | prefecture | prefecture | validated_auto |

**Ambigus inchangés :**

| ID (préfixe) | validation_status |
|--------------|-------------------|
| `16ea8cbd` | needs_review |
| `73fa072e` | needs_review |
| `5e1834e3` | needs_review |
| `c27c0b88` | needs_review |

## 3. Dry-run post-application

```bash
node --import tsx scripts/bank-recovery-co-prefecture-dry-run.mjs
```

| Métrique | Résultat | Interprétation |
|----------|----------|----------------|
| Backfill éligible | 0/1 | ✅ Attendu — déjà backfillé |
| Promotions éligibles | 0/21 | ✅ Attendu — déjà promus |
| Ambigus inchangés | 4/4 | ✅ |
| Verdict script | NO-GO | Normal post-apply (script = préconditions, pas état cible) |

Le script dry-run vérifie les **préconditions d'application** ; un verdict NO-GO post-apply confirme que la migration a bien été exécutée.

## 4. Scénarios pré-session S2 / S3

```bash
node --import tsx scripts/pre-session-selection-ux-validation.mjs
```

Artefact : `docs/pre-session-selection-ux-validation-report.md`

### S2 — A2 / CO / prefecture / quota 5

| Métrique | Baseline (avant) | Post-apply | Attendu |
|----------|------------------|------------|---------|
| Retenus | 4/5 | **5/5** | 5/5 |
| P1 count | 4 | **5** | 5 |
| P2 count | — | 0 | 0 |
| Gap | 1 | **0** | 0 |
| P1 pool | 4 | **26** | 26 |
| generation_need | oui | **non** | non |
| Conformité | — | **OK** | OK |

### S3 — B1 / CO / prefecture / quota 5

| Métrique | Baseline (avant) | Post-apply | Attendu |
|----------|------------------|------------|---------|
| Retenus | 0/5 | **5/5** | 5/5 |
| P1 count | 0 | **5** | 5 |
| P2 count | — | 0 | 0 |
| Gap | 5 | **0** | 0 |
| P1 pool | 0 | **22** | 22 |
| generation_need | oui | **non** | non |
| Conformité | — | **OK** | OK |

**Impact confirmé :** S2 passe de 4/5 → 5/5, S3 de 0/5 → 5/5. Aucune génération résiduelle sur les deux scénarios CO préfecture.

## 5. Hors périmètre (non modifié)

- ❌ Génération IA : 0 déclenchée
- ❌ `pedagogical_activities` : non touché
- ❌ B2 CE (S4 : 0/5, gen=true) — inchangé
- ❌ B2 Structures (S7 : 0/5, gen=true) — inchangé
- ❌ B1 EE (S6 : 1/5, gen=true) — inchangé
- ❌ Modification `contenu`, `consigne`, `format`, `niveau_vise`, `competence`

## 6. GO / NO-GO final

| Décision | **GO** |
|----------|--------|
| Migration appliquée | ✅ COMMIT persisté |
| Compteurs cibles | ✅ 1 backfill + 21 promotions + 4 ambigus |
| S2 A2 CO préfecture | ✅ 5/5 retenus, gap=0 |
| S3 B1 CO préfecture | ✅ 5/5 retenus, gap=0 |
| Régression | ❌ Aucune détectée |

## 7. Rollback (si nécessaire)

Procédure DOWN documentée en commentaire dans la migration :

```sql
-- Revert promotions :
UPDATE public.exercices SET validation_status='needs_review', validation_source='backfill', reviewed_at=NULL
WHERE id = ANY(<21 ids>) AND validation_source = 'human_recovery';

-- Revert backfill :
UPDATE public.exercices SET theme=NULL, contexte_irn=NULL
WHERE id = '634e81c6-fbd1-4c96-afb9-8d122e4f5610' AND theme = 'prefecture';
```

---

_Rapport généré après application contrôlée du mini-lot CO préfecture — audit source : `docs/bank-recovery-mini-lot-report.md`._
