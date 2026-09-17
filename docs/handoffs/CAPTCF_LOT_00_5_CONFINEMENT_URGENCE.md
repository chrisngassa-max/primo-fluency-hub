# CAPTCF — LOT 0.5 — Confinement d'urgence (production)

**Date UTC :** 2026-09-17T19:04Z → 2026-09-17T19:15Z  
**Opérateur :** Sofiane  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial :** `c3870caa891a9a78e73eebf04d6b96d199b39644`  
**Cible :** Supabase `gudcenhmzlcvhgbgklzw` (TCF PRO NEW / captcf.fr) — confirmé `ACTIVE_HEALTHY` avant chaque mutation  
**Autorisation :** propriétaire explicite Lot 0.5 (bootstrap + ban E2E + migration placement RLS)  
**Push distant :** non effectué  

Preuves locales non suivies Git : `.local-security-evidence/` (gitignored).

---

## 1. Avant (état capturé)

| Objet | État |
|---|---|
| `bootstrap-test-accounts` | ACTIVE v9, `verify_jwt=false`, création comptes via secret court |
| Comptes `*.e2e@tcfpro.fr` + `test.audit.eleve2@gmail.com` | existants, non bannis, last_sign_in août 2026 (E2E) / never (audit) |
| `placement_test_*` GRANT anon | SELECT/INSERT/UPDATE/DELETE/TRUNCATE… |
| Policies placement | nombreux `USING (true)` / `WITH CHECK (true)` rôles `{public}` |
| Attempts/results | 0 lignes ; 1 test + 20 items |
| Passation active | aucune |
| Utilisateurs / groupes | 61 users, 61 profiles, 4 groups, 29 memberships |

---

## 2. Sauvegardes / restauration

| Preuve | Détail |
|---|---|
| WAL archiving | `archive_mode=on`, `archive_command` wal-g (`admin-mgr wal-push`) |
| Branches Supabase | aucune |
| Données placement à risque | attempts/results = 0 |
| Rollback SQL | `supabase/secours/lot05_placement_rls_rollback_secours.sql` (hors chaîne auto ; **ne** réouvre **pas** anon) |
| Décision | migration appliquée (sauvegarde managée démontrable + surface placement vide attempts) |

---

## 3. Actions ordonnées exécutées

1. Contrôles préalables Git + projet `gudcenhmzlcvhgbgklzw`.
2. Capture preuves dans `.local-security-evidence/`.
3. **Désactivation fonction** : redeploy stub 410 + `verify_jwt=true` → v10.
4. **Ban** 4 comptes test via SQL Admin `auth.users.banned_until = 2099-12-31` (pas de suppression).
5. **Révocation** sessions/refresh : 94 sessions + 96 refresh tokens des 4 comptes.
6. Analyse parcours légitime positionnement (Edge `get-placement-test` / `generate-placement-test` en `service_role` ; UI formateur `authenticated`).
7. Migration `lot05_confine_placement_test_rls` appliquée (remote version `20260917190900`).
8. Tests refus anon + conservation compteurs + insert jetable rollback.
9. Durcissement local (stub + config.toml + assert script + test SQL).
10. Documentation + commits locaux séparés (pas de push).

---

## 4. Comptes (sans MDP)

| Email | id | Rôle | Action | Sessions |
|---|---|---|---|---|
| formateur.e2e@tcfpro.fr | cb5bd9a0-… | formateur | banned_until 2099-12-31 | révoquées |
| eleve.e2e@tcfpro.fr | 7afbf026-… | eleve | banned | révoquées |
| eleve2.e2e@tcfpro.fr | da768455-… | eleve | banned | révoquées |
| test.audit.eleve2@gmail.com | 87a3dff3-… | eleve (Groupe 3) | banned (compte seed/audit) | révoquées |

**Méthode :** `execute_sql` privilégié MCP sur `auth.users` + `DELETE` ciblé `auth.sessions` / `auth.refresh_tokens` (IDs filtrés).  
**Retour arrière ban :** `UPDATE auth.users SET banned_until = NULL WHERE email IN (…)`. **Ne jamais** réinjecter MDP hardcodés.

---

## 5. Fonction bootstrap

| Champ | Avant | Après |
|---|---|---|
| Version | 9 | **10** |
| verify_jwt | false | **true** |
| Corps | création comptes + MDP versionnés | stub HTTP **410 Gone** |
| Autres functions | — | inchangées (liste ACTIVE intacte) |

**Test refus :** `POST /functions/v1/bootstrap-test-accounts` sans JWT → **401** ; corps déployé = stub 410 ; `get-placement-test` / `daily-report` OPTIONS → **200** (autres functions disponibles).  
**RA temporaire (ne pas exécuter sans décision) :** redeploy ancienne révision git **avant** Lot 0.5 avec `verify_jwt=true` uniquement — jamais secrets dans le chat.

---

## 6. Migration RLS / GRANT

- Fichier local : `supabase/migrations/20260917190900_lot05_confine_placement_test_rls.sql`
- Remote : `20260917190900` / `lot05_confine_placement_test_rls`
- Historique `003_placement_tests.sql` / `202605*` : **non modifié**

### Avant → Après (synthèse)

| Aspect | Avant | Après |
|---|---|---|
| GRANT anon | ALL incl. TRUNCATE/DELETE | **aucun** |
| GRANT authenticated | ALL | SELECT, INSERT, UPDATE only |
| Policies | public + USING(true) | TO authenticated (has_role / ownership) + service_role |
| DELETE anon | possible (grant) | **refusé** |
| TRUNCATE anon | possible (grant) | **refusé** |

---

## 7. Tests

| Test | Commande / méthode | Résultat |
|---|---|---|
| Privileges anon | `has_table_privilege('anon',…)` | SELECT/INSERT/UPDATE/DELETE/TRUNCATE = **false** |
| Policies anon/public | `pg_policies` count | **0** |
| Insert jetable | INSERT attempt + `ROLLBACK` | OK |
| Compteurs | COUNT tables | inchangés (1/20/0/0/0 ; users 61 ; members 29) |
| Assert local | `node scripts/security/assert-no-prod-bootstrap.mjs` | **OK** |
| SQL reproductible | `supabase/tests/lot05_placement_rls_refusal.sql` | fourni |

---

## 8. Non-perte de données

| Table | Avant | Après |
|---|---:|---:|
| placement_tests | 1 | 1 |
| placement_test_items | 20 | 20 |
| placement_test_attempts | 0 | 0 |
| auth.users | 61 | 61 (ban ≠ delete) |
| profiles | 61 | 61 |
| group_members | 29 | 29 |

---

## 9. Parcours légitime positionnement

| Opération | Rôle | Preuve code | Impact confinement |
|---|---|---|---|
| Lecture publique passation | Edge `get-placement-test` + service_role | `PositionnementPassation.tsx`, function | **OK** (bypass RLS) |
| Génération formateur | Edge `generate-placement-test` + service_role | `PositionnementPage.tsx` | **OK** |
| Liste/publish formateur | authenticated client | `PositionnementPage.tsx` | policies has_role/owner |
| Résultat élève | authenticated own attempt | `PositionnementResultat.tsx` | student_id = auth.uid() |
| Accès anon direct tables | — | — | **fermé** (volontaire) |

Note : `score-placement-test` absente du dépôt ; soumission publique dépend déjà d’Edge/service — hors correctif Lot 0.5.

---

## 10. Journaux (prudent)

| Recherche | Fenêtre | Résultat | Classe |
|---|---|---|---|
| `bootstrap-test-accounts` dans logs unifiés | ~24h | **0** match | aucun indice récent |
| Connexions E2E historiques | Lot 00 | last_sign_in août 2026 | légitime probable / tests |
| Accès anon atypiques placement | non exhaustif PostgREST | incomplete | **inexpliqué possible** |

**Conclusion :** absence d’indice ≠ absence d’abus. Journaux incomplets / fenêtre limitée. Rotation `SERVICE_ROLE` **non** faite (hors autorisation) — recommandée après inventaire consommateurs.

---

## 11. Incident critique additionnel (Lot 2A)

**Découvert pendant Lot 0.5 :** GRANT `TRUNCATE` (et souvent `DELETE`) à `anon` sur **la quasi-totalité** des tables `public` (profiles, resultats, group_members, devoirs, …).  
PostgREST n’expose pas TRUNCATE, mais la surface SQL reste critique. **Hors périmètre** de ce lot (pas de migration globale). À traiter en urgence Lot 2A.

---

## 12. Inconnues / risques ouverts

1. `create-formateur-account` toujours ACTIVE `verify_jwt=false` + défaut MDP (non traité).
2. Contrat `has_role` bifide (Lot suivant) — policies SQL positionnelles OK.
3. Mapping naturalisation B1 vs B2 (Lot pédagogique) — non touché.
4. Dérive migrations local↔remote préexistante.
5. Compte audit banni était membre de « Groupe 3 » (trace conservée).
6. Pas de preuve logs d’abus, mais secret court bootstrap a existé longtemps.

---

## 13. Retour arrière (décision explicite)

| Élément | Procédure |
|---|---|
| Fonction | Redeploy révision git pré-0.5 + `verify_jwt=true` |
| Comptes | `banned_until = NULL` ; nouveaux MDP vault ; **pas** MDP repo |
| RLS | `supabase/secours/lot05_placement_rls_rollback_secours.sql` (élargit authenticated si besoin UI ; **garde anon fermé**) |
| Migration forward | ne pas éditer `20260917190900_*` ; nouvelle migration si ajustement |

---

## 14. Recommandations (non exécutées)

1. Lot 2A : `REVOKE TRUNCATE, DELETE FROM anon` global + revue policies.
2. Unifier `has_role` + tests Edge.
3. Hotfix B2 naturalisation IPE.
4. Rotation `SUPABASE_SERVICE_ROLE_KEY` après inventaire (functions, Vercel, Lovable, CI).
5. Auditer / confiner `create-formateur-account`.
6. Compléter journaux Auth/Edge août–septembre si besoin forensique.

---

## 15. Commits locaux prévus (ce lot)

1. migration + tests RLS + secours  
2. prévention bootstrap prod (function stub, config.toml, assert script, gitignore evidence)  
3. documentation handoff Lot 0.5  

**Pas de push.**

---

*Fin handoff Lot 0.5.*
