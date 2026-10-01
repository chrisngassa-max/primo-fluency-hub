# CapTCF P0.3 — Phase B : STOP avant application

Date : 2026-10-01. Projet unique : `gudcenhmzlcvhgbgklzw`.

## Décision

Nouvelle incompatibilité RLS reproduite localement avec le SQL exact de la PR : les gardes d'attribution `guard_assignment` et `guard_independent_assignment` refusent un exercice publié, complet et lisible, appartenant à un autre formateur. Le même INSERT est accepté avant installation P0. L'autorisation impose STOP avant application et interdit de modifier le SQL pendant cette mission. Aucun SQL versionné ou distant modifié.

## Préflight Git

- Branche `captcf-p0-safe-automatic-homework`, HEAD de départ exact `ec2ad4b9030e580a97b4d833bee8a4187c89ca90`.
- PR #49 ouverte, non fusionnée et fusionnable ; HEAD distant identique.
- CI `36877297774` : completed/success ; statut Vercel success, preview `H6fanuDa9kF5FxY6Bc2BU4y4Y1jn` (READY attesté par la publication P0.3).
- Diff complet de 16 fichiers P0/P0.1/P0.2/P0.3 depuis main. Aucun Lot 2B, Classium, MP3, ZIP, .env, secret, preuve locale ou supabase/.temp ajouté. Les fichiers non suivis préexistants sont préservés.
- Main distant confirmé : `67c48e3e70872f895b926048067832bd767ce273`. Statut Vercel associé success : `BfmoNtgNFFGj1vHTYsQTrMuPas1F`. L'association actuelle du domaine captcf.fr au déploiement n'est pas revérifiée après l'arrêt.

## Préflight Supabase et limites

Catalogues exclusivement, sous BEGIN READ ONLY : colonnes/types/defaults/nullabilité des tables utilisées, contraintes, enums publics, politiques RLS, grants, définitions et état des triggers des trois tables d'exercices/attribution, helpers de rôle/propriété et fonctions miroir.

- Migration `20261001074826` : absente au début et à la vérification finale (0 entrée).
- `homework_private` et `send_automatic_homework(uuid,uuid,uuid,timestamptz,jsonb)` : absents.
- `source_devoir_id` : absente ; aucun trigger actif appelant les fonctions miroir.
- FK `resultats.devoir_id` vers `devoirs.id`, ON DELETE SET NULL, présente.
- Les quatre définitions BEFORE sur exercices et leurs fonctions sont identiques au fixture P0.3 après normalisation CRLF/LF. Aucun nouveau changement de modalité ou conversion int4 constaté. Les 49 fixtures et le build validés au HEAD source ne constituent pas une recette distante.
- Les grants authenticated autorisent SELECT/INSERT/UPDATE sur les tables concernées ; les RLS limitent séparément les lignes accessibles. La seule politique ALL/UPDATE de exercices exige `formateur_id = auth.uid()`, tandis que les politiques de lecture autorisent aussi les exercices partagés.
- Préflight global : STOP, pas GO. La compatibilité intégrale n'est pas certifiée. Les advisors et les étapes de sauvegarde de compteurs/empreintes métier et de planification d'identifiants distants n'ont pas été exécutés : aucune application n'est tentée.
- Aucune donnée personnelle ni contenu pédagogique réel consulté.

## Reproduction et cause

Reproduction dans un PostgreSQL 17 jetable, sans réseau ni ports exposés, avec le fixture ciblé existant, les quatre guards publics exacts et la migration P0.3 inchangée. Un QCM CE complet est créé par un formateur synthétique B et marqué published. Un formateur synthétique A possède son groupe/séance et attribue cet exercice à un élève synthétique. Tous les identifiants sont locaux.

| Observation | Avant P0 | Après P0 |
|---|---|---|
| SELECT simple de l'exercice partagé par A | 1 ligne | 1 ligne |
| INSERT devoir par A | Accepté | homework_inexecutable |
| INSERT exercise_assignments de groupe par A, learner_id NULL | Accepté | homework_inexecutable |
| SELECT de l'exercice avec FOR KEY SHARE par A | — | 0 ligne |

Les deux gardes exécutent `SELECT * FROM public.exercices WHERE id=... FOR KEY SHARE`. Le verrouillage de ligne soumet cette lecture aux restrictions RLS UPDATE. La politique d'édition n'autorise que le propriétaire B ; A ne retrouve donc plus la ligne et le garde lève `23514/homework_inexecutable`, malgré un contenu valide et visible. Les politiques pertinentes du fixture (lecture authenticated des statuts validated/published, écriture propriétaire, attribution par le formateur/assigned_by) correspondent aux politiques distantes observées. Les autres politiques distantes de exercices sont SELECT et ne donnent pas d'UPDATE supplémentaire.

Le constat porte sur les droits serveur d'attribution d'un exercice partagé. Il ne signifie pas que toutes les interfaces manuelles sont cassées : le sélecteur bancaire de EndOfSessionSection filtre les exercices du propriétaire, de même que certaines listes de ExercicesPage. Ces cas propriétaires sont couverts par les tests précédents. Les insertions d'attribution restent néanmoins des parcours serveur existants, et le durcissement implicite « lecture partagée ⇒ propriété requise pour attribuer » n'est pas une décision produit autorisée.

Le fixture P0.3 protégeait déjà un exercice propriétaire avec une attribution existante invisible ; il ne testait pas une nouvelle attribution par un autre formateur d'un exercice partagé. Ce scénario manque à la validation précédente.

Aucune correction n'est réalisée. Une éventuelle reprise locale devra préserver la protection concurrente et les droits RLS, tester les deux chemins partagés dans les deux ordres concurrence édition/attribution, sans ouvrir les droits UPDATE ni introduire un SECURITY DEFINER par défaut. Ne pas simplement désactiver les gardes pour contourner le refus.

## Sauvegardes et preuves hors Git

Dossier `.local-security-evidence/p0-3-phase-b-ec2ad4b9/` :
`catalog-before.json`, `git-before.json`, `final-state.json`, copies SQL exactes, `check_shared.py`, `shared-result.txt`.

- Migration SHA-256 : `D321C0092AD00D41EEB74D1B3589DF202DA8B634FBE88B98DF3204C7B9A7D3E8`.
- Rollback SHA-256 : `625F747E61B559086ABAF907EE74FE395F9BFE4B321189B0E2B55B835DE291CB`.

Les catalogues incluent état des migrations, droits, RLS et définitions historiques. Aucun JWT, mot de passe, secret ou contenu élève réel enregistré. Le programme local lit seulement les fixtures du dépôt ; aucune connexion Supabase. Les conteneurs créés par cette reproduction ont été supprimés dans finally.

## Résultat individuel des 33 contrôles serveur

0/33 exécuté à distance ; aucun PASS serveur déclaré. La reproduction locale de préflight n'est pas comptée parmi les smokes distants.

| Nº | Contrôle | Résultat |
|---|---|---|
| 1 | Anonyme refusé | Non exécuté à distance |
| 2 | Élève refusé | Non exécuté à distance |
| 3 | Formateur tiers refusé | Non exécuté à distance |
| 4 | Membre hors groupe refusé | Non exécuté à distance |
| 5 | Séance étrangère refusée | Non exécuté à distance |
| 6 | Échéance passée refusée | Non exécuté à distance |
| 7 | Contenu vide refusé | Non exécuté à distance |
| 8 | QCM incomplet refusé | Non exécuté à distance |
| 9 | CE image seule refusée | Non exécuté à distance |
| 10 | CE texte court refusé | Non exécuté à distance |
| 11 | CE texte de 20 caractères accepté | Non exécuté à distance |
| 12 | CE texte avec image accepté | Non exécuté à distance |
| 13 | CO référence sans script refusée | Non exécuté à distance |
| 14 | CO script préparé accepté structurellement | Non exécuté à distance |
| 15 | Copie automatique d’audio publié refusée | Non exécuté à distance |
| 16 | EE correcte acceptée | Non exécuté à distance |
| 17 | EO correcte acceptée | Non exécuté à distance |
| 18 | Métadonnée int4 overflow refusée | Non exécuté à distance |
| 19 | Exercice complet accepté | Non exécuté à distance |
| 20 | Rejeu identique idempotent | Non exécuté à distance |
| 21 | Rejeu différent refusé | Non exécuté à distance |
| 22 | Concurrence : un seul lot | Non exécuté à distance |
| 23 | Panne deuxième exercice : transaction annulée | Non exécuté à distance |
| 24 | Zéro exercise_assignment créée par RPC | Non exécuté à distance |
| 25 | Attribution indépendante invalide refusée | Non exécuté à distance |
| 26 | Attribution individuelle valide acceptée | Non exécuté à distance |
| 27 | Attribution de groupe avec learner_id NULL acceptée | Non exécuté à distance |
| 28 | Édition invalidante refusée | Non exécuté à distance |
| 29 | Changement de destinataire/groupe revalidé | Non exécuté à distance |
| 30 | Échéance historique compatible | Non exécuté à distance |
| 31 | Résultat synthétique lié par resultats.devoir_id | Non exécuté à distance |
| 32 | Ancien devoir incomplet non réécrit | Non exécuté à distance |
| 33 | Chemin manuel existant fonctionnel | Non exécuté à distance ; régression locale sur exercice partagé |

## Recette, nettoyage, fusion et rollback

Recette professeur : non exécutée, bloquée avant installation. Aucun compte synthétique distant, groupe, séance, devoir, exercice, attribution, résultat ou reçu créé. Zéro reliquat distant produit par cette intervention ; aucune suppression distante nécessaire. Compteurs/empreintes métier avant/après non mesurés ; aucune requête de mutation distante exécutée.

Exercise_assignments créées par la RPC : 0 (RPC absente, aucun appel). Fonctions miroir inchangées et toujours non raccordées. Aucun objet public supprimé/désactivé. Aucun rollback utilisé : rien n'a été appliqué. Les tests locaux ont uniquement affecté des conteneurs jetables.

PR #49 non fusionnée, HEAD distant conservé à ec2ad4b9 ; aucun push durant cette Phase B. Pas de nouvelle production, pas de SHA de fusion. Un commit documentaire local séparé contient uniquement ce rapport, sans amend.

Migration distante : non. Mutation Supabase : 0. Edge : 0. Gemini : 0. Correction annexe : 0.
