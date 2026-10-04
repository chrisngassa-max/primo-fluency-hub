# CapTCF — Lot 2A.4 — Assistant global sur l’espace élève

**Date :** 2026-09-28  
**Branche :** `captcf-lot-02a4-assistant-global-eleve`  
**Base :** `origin/main` `1661a9f47bf9494ef05c3830a1d815c945420748` (PR #42)  
**Activation distante :** aucune (pas de push, PR, déploiement, migration, mutation Supabase)

## Objectif

Rendre l’assistant visible, utilisable et contextualisé sur **toutes** les pages de l’espace élève, même sans exercice ouvert. Réutiliser intégralement le Lot 2A.3 pour les exercices publiés.

## Montage global

| Emplacement | Rôle |
| --- | --- |
| `src/layouts/EleveLayout.tsx` | Montage **unique** de `AvatarAssistantPanel` + `AidePedagogiqueProvider` |
| `src/layouts/FormateurLayout.tsx` | **Aucun** assistant |

Garanties : bouton Aide sur chaque page élève ; fermeture claire ; contexte page via `location.pathname` ; reset d’échange sur changement de famille de route ou d’utilisateur ; réponses réseau tardives ignorées (`requestNumber`) ; aide disponible sur accès limité / page vide.

## Cartographie des routes élève (App.tsx)

| Route | Écran | Objectif | Questions rapides | Restrictions |
| --- | --- | --- | --- | --- |
| `/eleve` | Accueil | Travail du jour | Aujourd’hui / devoirs / séance | Pas d’invention |
| `/eleve/acces-limite` | Accès limité | Expliquer indisponibilité | Où / sert / pourquoi | Pas de contenu inventé |
| `/eleve/profil` | Mon profil | Infos personnelles | Orientation + devoirs | Pas de données formateur |
| `/eleve/ma-seance` | Ma séance | Séance courante | Objectif / activité / professeur | Pas d’invention de séance |
| `/eleve/mes-seances` | Mes séances | Historique | Orientation + prochaine séance | Idem |
| `/eleve/seances/:code` | Parcours séance | Exercices de séance | Idem séance + Lot 2A.3 | Banque d’indices optionnelle |
| `/eleve/exercices-interactifs/s01` | Redirection | Vers `/eleve/seances/S01` | Accueil | Jamais rendue seule |
| `/eleve/test-positionnement` | Accueil test | Préparer le test | Utiliser l’écran / technique | Pas d’indice |
| `/eleve/test-positionnement/passer/:token` | Passation | Passer le test | Technique seulement | Mode évaluation |
| `/eleve/test-positionnement/resultat/:id` | Résultat test | Lire le résultat | Signification / suite | Pas d’invention de score |
| `/eleve/devoirs` | Mes devoirs | Liste des devoirs | Orientation | Pas d’invention |
| `/eleve/devoirs/:id` | Passation devoir | Répondre | Consigne / indice / correction | Lot 2A.3 |
| `/eleve/carnet` | Carnet de mots | Lexique | Orientation / reprendre | Pas de correction d’exo |
| `/eleve/bilan/:sessionId` | Bilan séance | Relire un bilan | Résultats | Pas d’invention |
| `/eleve/exercices-seance/:sessionId` | Bilan / exercices | Revoir la séance | Résultats | Idem |
| `/eleve/bilan-test/:testId` | Bilan de test | Après test | Résultats | Hors passation active |
| `/eleve/bilan-devoirs/:bilanId` | Bilan devoirs | Après devoir | Résultats | Idem |
| `/eleve/progression` | Progression | Suivi compétences | Signification / suite | Pas d’invention de niveau |

**Absentes (non inventées) :** ressources élève, entraînement dédié, admin.  
**Hors layout :** `/eleve/login` (public).

Source de vérité code : `src/lib/avatar/eleveRouteCatalog.ts`.

## Comportement

### Pages sans exercice

Orientation déterministe (`answerPageOrientation`) : où suis-je, à quoi sert, que faire, devoirs, séance, résultats, reprise, indisponibilité, aide professeur. Aucune séance/devoir/résultat inventé ; faits optionnels seulement s’ils sont fournis (devoirs RLS côté client filtrés par `eleve_id`).

### Exercices (Lot 2A.3 inchangé)

Quand `context.pedagogical` est posé : chemin Edge/local pédagogique existant (consigne, compétence, indices banque Louise seulement, explication post-libération, Atelier, replay, navigation). Pas de duplication frontend de la logique serveur.

### Évaluation (passation)

`modeFromStudentPath` : évaluation uniquement sur `/eleve/test-positionnement/passer/…`.  
Aide : utilisation de l’écran + signal technique. Refus : indice, correction, conseil révélateur. Boutons rapides adaptés.

## Sécurité

- Liste blanche élève pour `open_route` élargie (`profil`, `acces-limite`, `test-positionnement`).
- Routes `/formateur` / `/admin` refusées par l’orchestrateur de questions.
- Cinq outils inchangés ; Gemini non invoqué (`aiInvoked: false`).
- Aucune conversation ordinaire stockée ; aucun nouvel agent.

## Tests

| Suite | Résultat |
| --- | --- |
| Lot 2A.4 (23 cas) | pass |
| Sélection Lot 2A / 2A.3 / accueil / préflight | 90 pass |
| **Total sélection** | **113 / 113** |
| `npm.cmd run build` | PASS |
| `git diff --check` | PASS |

## Fichiers principaux

- `src/lib/avatar/eleveRouteCatalog.ts`
- `src/lib/avatar/answerPageOrientation.ts`
- `src/lib/avatar/answerContextualQuestion.ts`
- `src/components/eleve/AvatarAssistantPanel.tsx`
- `src/layouts/EleveLayout.tsx`
- `supabase/functions/_shared/assistant-accueil/orchestrate.ts` (whitelist + mode passation)
- `src/test/lot-02a4-assistant-global-eleve.test.ts`

## Limites

- Pas de push / PR / déploiement / migration.
- Lot 2B non autorisé.
- Compteurs d’indices non persistants.
- Edge production reste v10 jusqu’à autorisation ultérieure (cette branche prépare le code partagé localement).
