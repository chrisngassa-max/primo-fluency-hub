# CapTCF P0.4 — Phase B finale : STOP avant application

Date : 2026-10-01. Projet : `gudcenhmzlcvhgbgklzw`. HEAD autorisé : `fd453a16f0e6ba3ec820aa236f58800aa0fc6d18`.

## Décision et preuve ciblée

STOP : le contrat demandé interdit d’afficher une erreur technique au professeur. Le dialogue `AutoHomeworkPreviewDialog` transmet pourtant `error.message` directement à `sendError`, affiché dans un élément `role="alert"`. La RPC du HEAD autorisé lève notamment `homework_request_conflict`, `homework_group_forbidden` et `homework_inexecutable`. Ces refus peuvent survenir après la validation locale, notamment après un changement de droits ou lors d’un rejeu conflictuel.

Une reproduction locale sans réseau monte le composant réel, prépare un contenu valide, demande puis confirme explicitement l’envoi. Le double RPC retourne successivement ces trois erreurs réellement définies dans la migration. Les trois assertions exigeant leur absence de l’alerte échouent : chaque message technique est affiché tel quel. Résultat : **0/3 sur ce contrôle UI**, 23 tests non concernés ignorés. Il ne s’agit pas d’un smoke Supabase ni d’une recette authentifiée distante.

Le message `homework_exercise_busy` utilise déjà une phrase française côté SQL ; le blocage concerne les autres erreurs non traduites. Aucun échec nouveau du mécanisme de verrouillage partagé n’est établi par ce contrôle.

La consigne impose « Si une nouvelle incompatibilité réelle apparaît : STOP avant application, sans modifier le SQL ». Aucun correctif frontend ou SQL n’est réalisé pendant cette Phase B. La reprise nécessitera de traiter les messages techniques côté interface avec tests ciblés, puis de valider un nouveau HEAD avant application.

## Préflight effectué et limites

- PR #49 ouverte, non fusionnée, fusionnable, HEAD exact `fd453a16`.
- Main distant confirmé : `67c48e3e70872f895b926048067832bd767ce273`.
- [CI 36905775087](https://github.com/chrisngassa-max/primo-fluency-hub/actions/runs/36905775087) : success. Cette CI existante ne couvre pas les trois assertions ajoutées au banc de preuve hors Git.
- [Preview Vercel](https://vercel.com/meme3/primo-fluency-hub/8gw41Qx9gxpEinJpGtGDNHrAqMKJ) : statut success ; READY attesté à la publication. Aucun déploiement déclenché pendant cette intervention.
- Deux requêtes de catalogue Supabase, sous `BEGIN READ ONLY`, sans contenu réel consulté.
- Migration `20261001074826` : 0 entrée. Schéma `homework_private` absent ; RPC `send_automatic_homework` absente.
- Colonnes `source_devoir_id` : 0 ; triggers actifs `mirror_devoir%` : 0 ; triggers et colonnes publics `p0_%` : 0.
- SQL et rollback du répertoire de travail identiques au HEAD autorisé après normalisation CRLF/LF. Copies exactes des blobs Git conservées hors Git.
- L’arrêt UI précède la comparaison exhaustive des catalogues historiques, modalités, RLS, grants et migrations. Ces vérifications ne sont donc pas certifiées pour cette intervention. Pas de sauvegarde de compteurs métier, de plan d’identifiants synthétiques ni d’advisors : aucune application n’est tentée.

## Empreintes et preuves hors Git

Dossier `.local-security-evidence/p0-4-phase-b-fd453a16/` : copies exactes `migration.sql`, `rollback.sql`, `hashes.json`, reproduction `messages.test.tsx`, configuration locale `vitest.config.ts`, sortie `messages-red.txt`, état `final-state.json`.

- Migration SHA-256 (blob Git exact) : `bac2e727568553460431d46fa19b57eab1ca6f973e191fd0f6da69ac85f736d0`.
- Rollback SHA-256 (blob Git exact) : `a05104866331560b60b8c2c65ea35811e023505f058910790e859103531c4801`.

Aucun secret, JWT, mot de passe, email ou contenu élève réel enregistré. Les preuves locales restent ignorées par Git. Aucun fichier préexistant non suivi touché.

## État final

Migration non appliquée ; RPC non installée. Smokes serveur A–F : **0 exécuté**, aucun succès distant revendiqué. Attribution partagée, interdiction d’édition par autrui et concurrence restent validées uniquement par les tests locaux P0.4 antérieurs ; pas de nouvelle certification distante ni de mesure distante de deadlocks.

Recette professeur et élève non exécutée. Aucun compte, session, token, exercice, devoir, assignment, résultat ou reçu temporaire distant créé ; rien à nettoyer à distance. Aucun compteur métier avant/après mesuré. Les requêtes distantes étaient exclusivement en lecture seule.

PR #49 non fusionnée, HEAD distant inchangé. Main inchangé ; SHA effectivement servi sur captcf.fr non revérifié après cet arrêt. Aucun rollback nécessaire ou exécuté. Aucun push effectué ; rapport conservé dans un commit documentaire local séparé, sans amend, sur une branche locale issue de `fd453a16`.

Mutation Supabase : **0**. Edge : **0**. Gemini : **0**. Production : **0**. SQL et code applicatif modifiés : **0**.
