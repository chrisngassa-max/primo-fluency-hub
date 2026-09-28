# CapTCF — Lot 2A.3 — Assistant sur exercices publiés autorisés

**Date :** 2026-09-28  
**Branche :** `captcf-lot-02a3-assistant-exercices-publies`  
**Base :** `origin/main` `5838c612d77aa213069c51508ebec9dc2bd92581` (PR #41)  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw`  
**Activation distante :** aucune (pas de push, PR, déploiement, migration)

## Diagnostic — verrouillage Louise (avant)

| Contrôle | Emplacement | Effet |
| --- | --- | --- |
| Liste blanche `PILOT` (4 UUID) | `load.ts` | Tout autre `exerciseId` → `invalid_context` |
| `SOURCE` / `FACTS` hardcodés Louise | `load.ts` | Seule la source Louise était acceptée |
| `factsHash` forcé Louise | `load.ts` | Empreinte d’exercice non générique |
| Banque branchée en dur | `deliver-hint.ts` | Recherche Louise uniquement |

### Carte d’autorisation (cible, inchangée dans l’esprit)

1. **Élève** : `auth.uid()` + JWT ; stores user sous RLS.  
2. **Rattachement** : devoir (`devoirs.eleve_id` + `exercice_id`) **ou** séance (`group_members` + `session_exercices` / liens document).  
3. **Exercice publié** : `differentiation_families.review_status = published` pour cet `published_exercise_id`.  
4. **Source / revue / hash** : `pedagogical_sources` de **cet** exercice ; cohérence meta / famille / audio (si présent) ; item scellé = variante publiée.  
5. **Banque d’indices** : registre optionnel ; absence ≠ blocage des autres outils.  
6. **Remise / libération** : `resultats` (devoir) ou `exercise_attempts` (séance) ; jamais déclarations client.

## Ce qui devient générique

- Accès pédagogique à **tout exercice publié** réellement rattaché à l’élève.
- Empreinte / source lues depuis la famille publiée de l’exercice (plus de hardcode Louise).
- Registre `HintBankRegistration` + `resolveHintBank` / `deliverValidatedHint(registry)`.
- Message unique si pas de banque : « Aucun indice validé n’est disponible pour cet exercice ».
- Consigne, compétence, explication post-libération, Atelier, replay, open_route / recommandation inchangés dans leur matrice.

## Ce qui reste propre à Louise

- Seule banque **active** dans `DEFAULT_HINT_BANKS` : `louise-hints-v1`.
- Validateur anti-fuite Louise (`validateHintEntry`) inchangé pour cette banque.
- Quatre `exercise_id` Louise + `LOUISE_FACTS_HASH` / `LOUISE_SOURCE_ID`.

Une seconde banque peut être ajoutée **via le registre** (démontré en test) sans modifier l’orchestrateur.

## Comportement sans banque

| Fonction | Sans banque validée |
| --- | --- |
| Consigne / compétence | Disponibles si exercice autorisé |
| Indice | Refus explicite (ci-dessus) |
| Explication | Après remise + libération uniquement |
| Évaluation | Indice / replay / explication refusés |
| Atelier | Selon matrice (séance + catégorie) |

## Tests

| Suite | Résultat |
| --- | --- |
| Lot 2A / 2A.1 / 2A.2 + panneau + accueil (26) + préflight | inclus |
| **Lot 2A.3** (15 cas) | pass |
| **Total sélection** | **90 / 90** |
| `npm.cmd run build` | PASS |
| `git diff --check` | PASS |

## Limites

- Compteurs d’indices non persistants.
- Lot 2B non autorisé.
- Aucune génération de nouveaux indices, aucun audio, aucune mutation d’exercice.
- Gemini désactivé ; chemin pédagogique sans modèle (`aiInvoked: false`).
- Exactement cinq outils.
- Aucun push / PR / déploiement / migration / secret.

## Fichiers principaux

- `banks/registry.ts` — registre générique  
- `banks/deliver-hint.ts` — résolution registre  
- `load.ts` — accès publié générique  
- `fixtures.ts` — exercice synthétique sans banque  
- `lot-02a3-published-exercises.test.ts` — 15 tests  
- panneau : motifs pédagogiques précis affichés tels quels
