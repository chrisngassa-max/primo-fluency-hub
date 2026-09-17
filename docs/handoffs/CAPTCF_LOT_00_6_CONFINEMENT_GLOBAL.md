# CAPTCF — LOT 0.6 — Confinement global privileges anon + create-formateur-account

**Date UTC :** 2026-09-17T19:24Z → 2026-09-17T19:55Z  
**Opérateur :** Sofiane  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD initial :** `f8a84e3ca7707cf0e4b7a620a9426ac4ed3d7bc1`  
**Cible :** Supabase `gudcenhmzlcvhgbgklzw` (TCF PRO NEW / captcf.fr) — `ACTIVE_HEALTHY`  
**Autorisation :** propriétaire explicite Lot 0.6  
**Push distant :** non effectué  

Preuves locales : `.local-security-evidence/` (gitignored).

---

## 1. Avant (état capturé)

| Objet | État |
|---|---|
| `create-formateur-account` | ACTIVE v9, `verify_jwt=false`, `createUser` + MDP défaut hardcodé, service_role, **aucune** auth admin |
| Appelants front/scripts | **0** dans le dépôt |
| GRANT anon tables public | 121/127 avec SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER |
| Policies dangereuses | `pedagogical_images_*_all` USING(true) ; inserts anon leads/dossiers/checklist/cohort ; `anon_play_token` ; catalogues `{public}` SELECT true |
| DEFAULT PRIVILEGES | postgres + supabase_admin accordent `arwdDxtm` à anon sur nouvelles tables |
| Passation active | aucune (sessions 24h = 0) |
| Compteurs | 61 users / 61 profiles / 4 groups / 29 memberships ; resultats 1148 ; devoirs 1900 |
| Lot 0.5 | bootstrap stub 410 + verify_jwt=true ; placement anon révoqué ; 4 E2E bannis |

---

## 2. Sauvegardes / restauration

| Preuve | Détail |
|---|---|
| WAL archiving | `archive_mode=on`, archive_command configuré |
| Branches Supabase | aucune |
| Migration | forward-only privileges/policies — **aucune** modification de lignes métier |
| Secours | `supabase/secours/lot06_anon_privileges_rollback_secours.sql` — **ne** restaure **jamais** TRUNCATE/DELETE anon global |
| Décision | migration appliquée (sauvegarde managée démontrable + surface non destructive) |

---

## 3. Actions ordonnées exécutées

1. Précontrôles Git/HEAD/cible + capture preuves.
2. Audit `create-formateur-account` (local + remote + appelants) → **non robuste**.
3. Matrice anon + allowlist publique (vide pour GRANT table : parcours publics via Edge).
4. Deploy stub create-formateur v10 + `verify_jwt=true`.
5. Migration `lot06_confine_global_anon_privileges` appliquée (remote `20260917195043`).
6. Tests refus SQL + conservation compteurs.
7. Artefacts locaux (tests, assert, config, secours, handoff) + commits locaux séparés.

---

## 4. create-formateur-account

| Champ | Avant | Après |
|---|---|---|
| Version | 9 | **10** |
| verify_jwt | false | **true** |
| Corps | création compte + défaut MDP | stub HTTP **410 Gone** |
| Auth robuste | non (aucun JWT/rôle admin) | N/A (neutralisé) |
| Test | — | sans JWT → **401** attendu (gateway) ; corps stub 410 si JWT présent |

**RA temporaire :** redeploy révision git pré-0.6 avec `verify_jwt=true` uniquement — jamais MDP hardcodés.

---

## 5. Migration RLS / GRANT

- Fichier local : `supabase/migrations/20260917195043_lot06_confine_global_anon_privileges.sql`
- Remote : `20260917195043` / `lot06_confine_global_anon_privileges`
- Historique / Lot 0.5 : **non modifié**

### Avant → Après

| Aspect | Avant | Après |
|---|---|---|
| TRUNCATE anon | 121 tables | **0** |
| DELETE anon | 121 | **0** |
| SELECT/INSERT/UPDATE anon | 121 | **0** |
| Tables sans RLS | 1 (backup) | **0** |
| Policies insert/write `{public}` true | actives | drop/replace TO authenticated |
| DEFAULT PRIVILEGES postgres→anon | oui | **révoqué** |
| DEFAULT PRIVILEGES supabase_admin→anon | oui | **inchangé** (permission denied) |

---

## 6. Allowlist publique

**GRANT table anon :** aucun (allowlist vide).

| Parcours public | Preuve | Remplacement |
|---|---|---|
| Play exercice `/play/:token` | `PlayExercise.tsx` → Edge `play-exercise` | service_role |
| Positionnement | Edge `get-placement-test` / `generate-placement-test` | service_role (Lot 0.5) |
| Marketing leads/dossiers/cohort/checklist | **aucun** consommateur in-repo | policies insert restreintes `TO authenticated` ; secours borné si landing externe prouvée |

---

## 7. Tests

| Test | Résultat |
|---|---|
| `has_table_privilege` anon TRUNCATE/DELETE/SELECT | **0** tables |
| Privileges A/B (profiles, resultats, group_members) | refus |
| Policies dangereuses listées | absentes |
| authenticated SELECT profiles/exercices/images | conservé |
| service_role SELECT profiles | conservé |
| Compteurs users/profiles/groups/members/resultats/devoirs | inchangés |
| Assert local | `node scripts/security/assert-no-insecure-account-bootstraps.mjs` |
| SQL reproductible | `supabase/tests/lot06_anon_privileges_refusal.sql` |

---

## 8. Non-perte de données

| Indicateur | Avant | Après |
|---|---:|---:|
| auth.users | 61 | 61 |
| profiles | 61 | 61 |
| groups | 4 | 4 |
| group_members | 29 | 29 |
| resultats | 1148 | 1148 |
| devoirs | 1900 | 1900 |
| leads | 1 | 1 |

---

## 9. Parcours légitimes

| Parcours | Impact |
|---|---|
| Formateur/élève authenticated | grants conservés ; catalogues TO authenticated |
| Play public | Edge inchangé |
| Placement public | Edge inchangé (Lot 0.5) |
| Insert marketing anon direct | **fermé** (volontaire ; pas de consommateur repo) |

---

## 10. Journaux create-formateur-account (prudent)

| Recherche | Fenêtre | Résultat | Classe |
|---|---|---|---|
| `create-formateur-account` logs unifiés | ~24h | **0** match | aucun indice récent |
| Compte `formateur@captcf.fr` | présent (1) | historique indéterminé | possible usage passé / seed |

**Conclusion :** absence d’indice ≠ absence d’abus. Rotation SERVICE_ROLE hors autorisation.

---

## 11. Résiduels / hors périmètre

1. `ALTER DEFAULT PRIVILEGES` pour **supabase_admin** encore `anon=arwdDxtm` — futures tables créées par ce rôle peuvent réhériter ; mitigation : revokes explicites + revue migrations.
2. Policies `{public}` avec `auth.uid()` sur tables authenticated — faux positif residual tant que GRANT anon = 0 ; Lot 2A pour clauses TO.
3. `has_role` bifide — non touché.
4. Mapping B2 naturalisation — non touché.
5. Autres Edge `verify_jwt=false` — hors Lot 0.6.

---

## 12. Retour arrière (décision explicite)

| Élément | Procédure |
|---|---|
| Fonction | Redeploy git pré-0.6 + `verify_jwt=true` |
| RLS/GRANT | nouvelle migration forward ; secours **borné** uniquement |
| Marketing anon | secours `lot06_*_secours.sql` pour **une** op précise prouvée |

---

## 13. Recommandations (non exécutées)

1. Corriger DEFAULT PRIVILEGES `supabase_admin` (rôle owner / support Supabase).
2. Lot 2A : clauses TO sur policies `{public}` restantes.
3. Unifier `has_role` ; hotfixes B2 ; inventaire rotation SERVICE_ROLE.
4. Si landing marketing externe existe : Edge bornée plutôt que GRANT anon.

---

## 14. Commits locaux

1. migration globale + tests privilèges + secours  
2. confinement create-formateur-account + config + assert  
3. documentation handoff Lot 0.6  

**Pas de push.**

---

## 15. État Git final

| Élément | Valeur |
|---|---|
| Branche | `codex-captcf-lot-00-protection-cartographie-20260917` |
| Push | **aucun** |
| Lot 0.5 commits | préservés (`9b904f00`, `1ecc36fd`, `f8a84e3c`) |

---

*Fin handoff Lot 0.6.*
