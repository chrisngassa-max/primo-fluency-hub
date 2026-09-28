# CapTCF — accueil assistant — clôture Phase B

Date : 27 septembre 2026. Phase 2 terminée après smoke authentifié et nettoyage.

## Références vérifiées

- Dépôt principal à préserver : `D:\sites\tcf pro` ; travail isolé dans `C:\Users\Sofiane\Documents\Codex\2026-09-17\files-pasted-by-the-user-mission\CAPTCF-ASSISTANT-PHASEB`.
- PR #38 fusionnée : https://github.com/chrisngassa-max/primo-fluency-hub/pull/38 ; tête `b44f06d35527367471b4b259d6aa59a5e290cd58`, merge et main `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`.
- Base précédente : `a20e49a702c3c120aef1d0c81ccecf5d7fce7bee` (référence de retour ; aucun rollback effectué).
- API Vercel : alias `captcf.fr` → `dpl_54BzYWPYP6t2D3LSftjyUr9Z22U7`, `READY`, `production`, SHA identique au merge. URL : https://primo-fluency-iru98osih-meme3.vercel.app.
- Supabase unique `gudcenhmzlcvhgbgklzw` : `captcf-assistant-qa` ACTIVE v6, `verify_jwt=true`, mise à jour 2026-09-27 16:25:31 UTC.
- Version observée avant intervention manuelle : v4 ; version après : v6. Aucun redéploiement par l'agent pendant cette reprise.
- Journaux de cette fonction du 16:25:31 au 16:43:00 UTC : 7 entrées `function_edge_logs`, 21 `function_logs`, zéro `WORKER_ERROR`.

## Validation fournie par le propriétaire

- Secret `CAPTCF_ASSISTANT_AI_ENABLED=false` appliqué manuellement avec confirmation CLI. Aucun secret modifié pendant cette reprise ; la valeur n'est pas exposée par la liste des secrets.
- Tests ciblés réels : **4 fichiers, 26/26 PASS**, pas 36.
- Build Vite PASS ; smoke anonyme HTTP 401.
- Aucun appel Gemini volontaire, aucune migration, aucune autre fonction déployée.

## Smoke réalisé

Compte synthétique minimal, email non distribuable, aucun groupe, devoir, séance ni donnée d'élève réel affecté. Authentification réelle par mot de passe, rôle élève et profil approuvé.

Sept appels authentifiés à `captcf-assistant-qa`, `kind=accueil` : tous HTTP 200.

| Cas | Résultat |
| --- | --- |
| Aujourd'hui | Orientation vers `/eleve/ma-seance` |
| Devoirs | Orientation vers `/eleve/devoirs` |
| Prochaine séance | Orientation vers Ma séance, aucune séance inventée |
| Ouvrir l'activité | Refus explicite faute d'activité courante ; `tool=null` |
| Route autorisée | `/eleve/devoirs`, `allowed=true` |
| Route interdite | `/formateur`, `allowed=false`, `reason=route_refusee` |
| Question hors contexte | `provider=faq_fallback`, `visibleFallback=true` |

Toutes les réponses : `aiInvoked=false`, `realAiBlocked=true`. Les réponses de navigation utilisent `server_context`, et non artificiellement `faq_fallback`.

Interface testée sur l'URL immuable du **même déploiement de production** : l'ancienne session formateur de `captcf.fr` ne quittait pas sa page immédiatement. Cette séparation d'origine a permis d'utiliser uniquement le compte synthétique. Les quatre questions ont été saisies, les navigations constatées, la FAQ affichait explicitement `FAQ locale — provider=faq_fallback`. Un accès direct à `/formateur` a redirigé vers `/eleve`.

Le consentement général IA/voix a été accepté uniquement parce que l'interface le bloquait. Le consentement spécifique Aide a été **refusé**, la FAQ restant disponible. Aucun exercice, enregistrement audio ou test de niveau lancé.

## Rétention et nettoyage vérifiés

- Un seul événement applicatif pour le compte : fonction `captcf-assistant-qa`, fournisseur `faq_fallback`, statut `ok` ; table `ai_processing_logs` ne contient aucun champ question/réponse. Inspection du chemin exécuté : pas d'écriture de conversation ordinaire. Le panneau conserve seulement son dernier échange en mémoire React.
- Après déconnexion UI, révocation globale via Admin API : session déjà absente (HTTP 400 `Auth session missing!`) ; vérification SQL : **0 session**, **0 refresh token actif**.
- Consentement IA/voix révoqué en base ; compte banni. Renouvellement : HTTP 400 `refresh_token_not_found`. Nouvelle connexion : HTTP 400 `user_banned`.
- Après clôture : **0 événement Gemini** pour le compte ; branche accueil sans appel modèle dans le code servi et les 7 réponses. Pas de prétention à auditer la facturation globale Google.
- Identifiants de connexion et jetons temporaires supprimés du fichier de travail. Onglets de test fermés ; aucune capture, conversation ordinaire, clé ou mot de passe inclus dans ce handoff. Le compte banni et sa preuve minimale de révocation restent en base.
- Aucun déploiement, modification de secret, migration ou push réalisé pendant cette reprise.

## Transmission autonome — Lot 2 local

Poursuivre CapTCF, assistant élève, Phase 3 Lot 2 uniquement en local. Phase 2 validée le 27/09/2026 ; production Vercel READY au merge PR #38 `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`, fonction Supabase `captcf-assistant-qa` ACTIVE v6 avec JWT requis. Smoke synthétique conclu, compte banni, sessions et consentement révoqués, zéro Gemini. Tests Phase B fournis par le propriétaire : 26/26 dans 4 fichiers, build PASS.

Conserver `D:\sites\tcf pro` et tous ses documents/audios non suivis intacts. Utiliser le worktree isolé indiqué ci-dessus, branche `captcf-lot-02-assistant-aide-pedagogique` créée depuis main à jour. Le fichier non suivi `supabase/.temp/linked-project.json` est un artefact préexistant à préserver et à ne pas committer.

Mission initiale : `C:\Users\Sofiane\.codex\attachments\6484f99d-ba97-4ade-a875-98ba18b2136c\Texte collé.txt`. La relire pour les critères complets. Pilote unique Louise — musique et ville, source `4a0e8321-9ece-42d7-bf76-8825b1e65e79`, A1/A2/B1/B2, facts_hash commun annoncé `sha256:4fd8d556…` à vérifier en lecture seule. Banque-first ; aucun changement/republish distant des exercices. Gemini OFF. Exactement cinq outils : open_route, deliver_validated_hint, replay_audio_segment, recommend_next_activity, flag_help_needed. Auth/RLS serveur, pas de confiance dans le contexte client ; pas de PII/UUID/réponses interdites dans le payload externe. Indices séquentiels 1→2→3 entraînement ; indice 1 seulement devoir ; aucune aide révélatrice ni replay en évaluation ; pas de fuite QCM. Explication après remise seulement, fondée sur source scellée. Réutiliser readiness/routing_decisions et le moteur Atelier existants, sans nouvelle file.

Prochain objectif : cartographie ciblée des données réelles et tests rouges avant implémentation ; fixtures expurgées. Si migration indispensable, STOP avec proposition uniquement. Réussite : 14 contrôles déterministes de la mission, quelques tests panneau, build PASS, commit code local puis documentation séparée dans `docs/handoffs/CAPTCF_LOT_02_ASSISTANT_AIDE_PEDAGOGIQUE.md`. **Aucune migration, aucun déploiement, aucun push ni PR Lot 2.**
