# Lot 5B-C — Suite après autorisation explicite de revue

## Clôture Phase B — livraison et revue Éclipse réussies

29 septembre 2026. **Source Éclipse utilisable ; arrêt avant génération A2.**

- Après push manuel, HEAD local et distant identiques : `ec33f417292704e86526881797d8ee71909c8ce8`.
- [PR #46](https://github.com/chrisngassa-max/primo-fluency-hub/pull/46) ouverte vers main ; diff des 15 fichiers vérifié, blobs identiques au HEAD local, aucun fichier hors périmètre ni preuve privée ajoutée.
- [CI #36595125565](https://github.com/chrisngassa-max/primo-fluency-hub/actions/runs/36595125565) : tests, build et lint réussis avant fusion. Preview Vercel Ready `129V685SaZZAn3CFExsgr3eG8iaV`, page publique affichée dans le navigateur interne.
- Fusion par PR, sans push direct sur main, avec contrôle du HEAD attendu. SHA final main : `8e11677b494e148173155e52eff2f7de67587181`.
- Déploiement production [GPFd2GSNCdDGG2U8m4jEEDwKdvjc](https://vercel.com/meme3/primo-fluency-hub/GPFd2GSNCdDGG2U8m4jEEDwKdvjc) : contrôle Vercel success sur ce SHA ; nouveau dialogue réellement présent sur captcf.fr après rechargement.
- Session propriétaire Christian réutilisée, sans lecture de ses identifiants. Statuts affichés séparément : Pilote interne, transcription revue/corrigée, analyse terminée, revue brouillon. Génération initialement bloquée.
- Dialogue ouvert au clavier ; texte de confirmation explicite et mention « Cela ne publie aucun exercice » vérifiés. Confirmation volontaire via l'interface ; aucun UPDATE administratif de la source. Le composant livré appelle exclusivement la RPC dédiée.
- Succès UI : « Source utilisable. Aucun exercice n’a été publié par cette action. » Statut conservé après rafraîchissement ; étape de génération disponible, sans clic de génération.
- Lecture de contrôle : revue `utilisable`, date technique `2026-09-29T16:09:08.310003+00:00`. Comparaison des lignes avant/après : **seuls review_status et updated_at diffèrent**.
- Empreintes autres sources, transcription pilote, chunks pilote et exercices identiques avant/après. Familles pour Éclipse : **0** ; aucun fait ni facts_hash.
- Preuves hors Git : `.local-security-evidence/ui-before.json`, `ui-after.json` ; capture locale `outputs/eclipse-utilisable.png` dans l'espace de travail Codex. La réponse finale fournit la capture.
- Migration unique maintenue, RPC/trigger actifs et protocole HTTP/JWT validé (19 contrôles), nettoyage à zéro. Aucun besoin de réappliquer la migration lors de cette livraison ; aucune Edge déployée.
- Rollback SQL disponible dans `supabase/secours/20260929133719_secure_source_usability_review_rollback.sql` ; rollback frontend précédent : main `c8b3752eea45009c953da88314ac7ab07d2fe5dc`, déploiement `AhV5ky35kiJb87rjXwoMpriCiyDT`. Aucun rollback exécuté à cette clôture.
- Transcription et analyse non relancées ; Gemini **0** ; aucune génération A1/A2/B1/B2, validation, publication, séance, devoir ou élève. Horodatages +39,415 s conservés comme limite ; aucun découpage.
- **Prochaine étape sur nouvelle autorisation : A2 seul, audit des faits, puis A1/B1/B2 avec un seul facts_hash.**

---

## Reprise avec protocole HTTP/JWT — tests serveur validés

État au 29 septembre 2026 : la seule migration `20260929133719_secure_source_usability_review` est **réappliquée et validée par les contrôles HTTP**. SQL inchangé. Une seule entrée d'historique ; horodatage MCP d'application `20260929155908` aligné sur la version du fichier après application.

Le test administratif précédent était invalide : `SET LOCAL ROLE authenticated` ne change pas `session_user=postgres`. Les capacités de maintenance de postgres/supabase_admin sont hors modèle de menace client. Ce test a été retiré ; il ne signalait pas une vulnérabilité client.

Protocole corrigé au commit `b0591fec` :
- `supabase/tests/source_usability_review_http.py` utilise Auth /token (password grant) puis REST/PostgREST avec de vrais access tokens. Aucun JWT fabriqué, aucun service_role comme client.
- Quatre comptes fictifs non distribuables : propriétaire A, formateur B, élève C, administrateur D ; rôles en table canonique user_roles, huit sources temporaires. Création administrative de fixtures, mots de passe aléatoires et JWT uniquement en mémoire ; hashes salés transmis pour provisionnement sans fichier de credentials.
- 19 assertions HTTP réussies. Anon RPC/PATCH : 401/42501. Élève RPC : 403/42501 STAFF_ROLE_REQUIRED ; étranger RPC : 403/42501 SOURCE_FORBIDDEN. Leur PATCH est filtré par RLS : HTTP 200, zéro ligne retournée/modifiée, statut vérifié inchangé.
- Propriétaire PATCH vers utilisable ou valide : 403/42501 SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN. PATCH titre légitime : 200. RPC admissible : 200, changed=true ; répétition : 200, changed=false et même updated_at.
- Hash/transcription absente ou non revue/analyse/droits manquants : 400/P0001 avec code métier exact, statut inchangé.
- Administrateur applicatif non propriétaire avec son vrai JWT : 200, conforme à l'exception admin existante.
- Deux appels RPC parallèles avec JWT A : 200/200, exactement changed=false et changed=true ; source finale utilisable.
- Déconnexion globale des quatre comptes : 204. Comptes bannis puis supprimés, sessions/refresh tokens/consentements/fixtures supprimés. Tous compteurs à zéro ; mémoire du processus vidée. Aucune authentification du propriétaire réel consultée.
- Après nettoyage : empreintes sources `8dbcc7a3d5fadc3f63d2151fbaae3828` et exercices `044cd690b5c6cd4487368f8c5644d20f` inchangées. Éclipse toujours brouillon, aucune famille.
- Preuves expurgées hors Git : `.local-security-evidence/http-fixture-ids.json`, `http-results.json`, `http-cleanup.json`. Ne pas versionner ce dossier.
- Les 53 tests ciblés passent (6 fichiers), build Vite réussi, git diff --check réussi. Avertissements habituels Browserslist/chunks/imports, non bloquants. Aucun autre correctif.
- Livraison frontend et recette du dialogue : à compléter après CI/preview vertes. Production précédente pour rollback : main `c8b3752eea45009c953da88314ac7ab07d2fe5dc`, déploiement Vercel `AhV5ky35kiJb87rjXwoMpriCiyDT` (statut GitHub Vercel success).
- **Aucune génération dans cette mission corrigée** : Gemini 0, A2/A1/B1/B2 non générés, aucune publication/séance/devoir/élève réel. La reprise suivante nécessite l'autorisation de génération A2 puis A1/B1/B2.

---

## Phase B — arrêt après test SQL et rollback (29 septembre 2026)

**Verdict : migration appliquée puis annulée ; frontend non livré ; pilote non repris.**

- Préflight : branche `captcf-lot-05b-c-second-audio-pilot`, HEAD `33b32bee`, commits `1823c50a` et `33b32bee` présents. Non-suivis préexistants préservés. Fetch réussi avec `http.sslBackend=openssl` après échec Schannel ; véritable `origin/main=c8b3752eea45009c953da88314ac7ab07d2fe5dc`. Diff limité à la revue sécurisée et aux handoffs.
- `npx.cmd` absent du PATH ; CLI autonome contrôlée : 2.75.0, aide générale et `migration up --help` consultées. Documentation officielle consultée : [fonctions, SECURITY DEFINER et EXECUTE](https://supabase.com/docs/guides/database/functions), [triggers](https://supabase.com/docs/guides/database/postgres/triggers), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog). Le rendu changelog.md échoue ; version HTML consultée. Aucune modification de secret ni d'Edge.
- Sauvegarde hors Git, ignorée : `.local-security-evidence/source-review-before.json`, définitions/contraintes/ACL/policies/triggers/fonctions et source exacte ; `preflight-summary.json` conserve les empreintes. Aucun jeton, identifiant de connexion ou secret enregistré.
- Source pilote : `brouillon`, transcription courante `reviewed` avec texte corrigé, analyse `analyzed`, neuf chunks, droits `internal_pilot`, IA autorisée, réutilisation élèves désactivée ; zéro famille.
- Application du seul SQL autorisé via Supabase MCP au projet `gudcenhmzlcvhgbgklzw`. L'outil a enregistré la version d'exécution `20260929154025` ; cette unique entrée a été alignée sur `20260929133719 / secure_source_usability_review`. RPC et trigger présents, ACL RPC postgres/authenticated uniquement, garde postgres uniquement ; sources et exercices inchangés.
- Tests préparés adaptés au transport SQL MCP : remplacement des commandes psql `\\gset` par variables transactionnelles et blocs d'assertion. Copie exacte dans `.local-security-evidence/source-review-tests-mcp.sql`.
- **Échec bloquant : `Expected permission denied, got SUCCESS`.** Le test exige que `SET ROLE postgres` échoue après `SET LOCAL ROLE authenticated`, mais la connexion MCP conserve `session_user=postgres`. Un diagnostic séparé sans donnée métier confirme qu'elle peut reprendre `current_user=postgres`. Ce scénario ne représente donc pas une connexion client non privilégiée. Il s'agit d'un défaut du protocole de test ; aucun contournement client démontré, mais validation de sécurité non acquise.
- Arrêt immédiat conformément à la mission, sans corriger puis réappliquer la migration. Rollback séparé exécuté : deux fonctions supprimées, trigger supprimé, aucun CASCADE ni donnée métier supprimée. Entrée d'historique sauvegardée hors Git puis retirée pour marquer la migration non appliquée ; zéro entrée résiduelle.
- Vérification après rollback : source exacte, ACL de table, policies et triggers antérieurs identiques à la sauvegarde. Empreinte de toutes les sources `8dbcc7a3d5fadc3f63d2151fbaae3828` ; de tous les exercices `044cd690b5c6cd4487368f8c5644d20f`, identiques avant/après.
- Nettoyage : transaction de fixtures annulée. Compteurs comptes auth/profils/rôles/sessions/consentements/source/transcription/chunks temporaires tous à zéro. Aucun login ni jeton n'a été créé ; aucune session à révoquer ni compte persistant à bannir. Preuves `source-review-test-failure.json`, `rolled-back-migration-record.json`, `source-review-restored.json` hors Git.
- Les tests suivants, notamment concurrence et compatibilité complète, ne sont pas annoncés comme réussis. Les 53 tests applicatifs et le build n'ont pas été relancés pendant cette Phase B, leur exécution étant conditionnée au succès SQL.
- Aucun push, PR, merge ou déploiement Vercel. Aucun SHA main nouveau ni rollback frontend nécessaire : le frontend n'a pas changé.
- Éclipse reste `brouillon`. Transcription et analyse non relancées ; zéro appel Gemini et zéro retry ; aucun fait/facts_hash créé ; A1/A2/B1/B2 non générés, zéro famille. Aucune validation, publication, séance, devoir ou élève.
- Reprise nécessaire : corriger le test d'isolation pour utiliser une véritable identité non privilégiée ou vérifier les appartenances de rôles sans confondre `current_user` et `session_user`, puis recommencer la validation bloquante sous autorisation de reprise. La migration et son rollback restent disponibles localement. Horodatages +39,415 s toujours imprécis, aucun découpage automatique.

---

Les sections suivantes décrivent les étapes antérieures à cet arrêt Phase B.

**Date :** 29 septembre 2026. **Verdict : STOP UI — action de passage à utilisable absente du Studio.**

Le propriétaire a explicitement autorisé le passage de la source `abddcf10-a426-4701-88eb-aaf05d9fc707` de `brouillon` à `utilisable`, uniquement pour le pilote interne, via le Studio et sans contournement technique. Il a demandé l'arrêt si l'action était absente ou échouait.

## Vérification réelle du Studio

- Même onglet et session formateur Christian authentifiée.
- Source « Une éclipse visible en Europe » ; en-tête visible : `analyzed · brouillon`.
- Ouverture de l'étape 2 « Métadonnées et droits ».
- Formulaire complet exposé par l'interface : Titre, Origine, Statut des droits, Note de licence, Réutilisable pour les élèves, Réutilisable pour la génération IA, Enregistrer.
- Aucun contrôle de statut de revue, aucun bouton « utilisable » ou action d'approbation de la source.
- Le champ « Statut des droits » contient `internal_pilot` : il concerne les droits d'usage et ne doit pas être remplacé par `utilisable`.
- Les étapes 6 et 7 concernent les variantes, restent bloquées faute de famille et ne permettent pas cette revue de source.
- Corroboration en lecture seule dans `src/pages/formateur/StudioAudioWizardPage.tsx` : `MetadataRightsForm` enregistre seulement title, rights_status, license_note, source_origin, reusable_for_students et reusable_for_ai. Il ne modifie jamais review_status ; ce dernier est seulement affiché dans l'en-tête.

**Défaut exact : le Studio propose le parcours de génération mais ne fournit pas l'action de revue de source requise par son backend (`SOURCE_REVIEW_NOT_APPROVED` tant que review_status=brouillon).**

## Point d'arrêt et absence de mutation

- Aucun changement de statut réalisé, donc aucune persistance d'un passage à utilisable ne peut être certifiée.
- Aucun clic Enregistrer, aucune écriture SQL/RPC/Admin API/service_role, aucun recours à une autre interface pour contourner l'absence de l'action.
- Aucune nouvelle tentative A2 : l'autorisation de relance était conditionnée au passage effectif à utilisable.
- Faits, facts_hash et familles : aucun produit lors de cette suite ; aucun fait à confirmer ou arbitrer.
- A1/A2/B1/B2 : aucun nouvel item ou brouillon. Audit pédagogique des quatre variantes toujours impossible faute de génération.
- Nouveaux appels Gemini : 0 ; nouveaux retries : 0.
- Bilan cumulé de la recette précédente : une transcription réussie, une analyse réussie, une tentative A2 échouée avant création de famille ; coût fournisseur non disponible.
- Limite maintenue : horodatages non vérifiés, dérive +39 415 ms. Aucun découpage automatique. La transcription corrigée reste la référence textuelle ; la limite d'absence d'écoute indépendante attestée par l'agent demeure celle documentée précédemment.
- Droits `internal_pilot`, réutilisation élèves désactivée, aucune diffusion publique.
- Aucune validation de variante, publication, séance, devoir, élève, modification Louise, push, PR, migration ou déploiement.

## Suite nécessaire

Le Studio doit exposer une action explicite de revue de la source vers `utilisable`, distincte des droits d'usage et de la validation des variantes. Aucun correctif de code n'est réalisé dans cette mission. Reprendre ensuite la même source, vérifier le statut après rafraîchissement, puis effectuer l'unique relance A2 autorisée avant l'audit des faits.

## Traçabilité Git

- Branche : `captcf-lot-05b-c-second-audio-pilot`.
- Commit précédent conservé : `d32d85e03ff4a3f6983e8e52ee4fff789d9df84d`.
- Nouveau commit documentaire demandé : `docs(studio): complete second audio generation review`, sans amend, uniquement ce handoff.
- Fichiers non suivis préexistants conservés ; aucun audio ni document de référence modifié.

Le titre du commit demandé ne signifie pas que la génération a abouti : cette suite documente explicitement le blocage UI.


---

# Historique de la recette

# Lot 5B-C — Actualisation de la recette réelle du 29 septembre 2026

Cette actualisation remplace le verdict STOP AUTH du premier arrêt. La recette a réellement repris dans le navigateur interne après connexion manuelle du propriétaire. Le parcours demeure incomplet : arrêt à la première tentative de génération A2.

## Résultat actuel

- Session formateur : OK, Christian. Aucun identifiant ni mot de passe lu ou conservé.
- Source : `abddcf10-a426-4701-88eb-aaf05d9fc707`.
- Propriétaire de la source et relecteur de la transcription : `82acac8e-8add-4f62-9cfd-701989a82bd9` ; identité affichée dans la session : Christian.
- Statut source : `analyzed` ; revue source : `brouillon`.
- Droits : `internal_pilot` ; réutilisation élèves : false ; génération IA : true.
- Publication : non. Aucune séance, aucun devoir ni élève créé. Louise inchangée.
- Aucune modification de code, migration, policy, secret, déploiement, PR ou push.

## Préflight et import

- Dépôt `D:\SITES\CAPTCF`, branche `captcf-lot-05b-c-second-audio-pilot`, HEAD initial `0290d8b33a0fb1ff0049cb8f2b82186375f97a90`.
- Fichiers suivis propres au départ. Fichiers non suivis conservés : archive et dossier éclipse, MP3 voisin à la racine, `docs/fichiers oral/`, audit Studio existant et `supabase/.temp/linked-project.json`.
- MP3 unique : `20260812-b1-eclipse/20260812_b1_eclipse/rfi_b1_20260812_eclipse_audio.mp3`.
- Taille : 1 334 156 octets ; SHA-256 : `855D46C4125C3AC5C4978DCD67659D1ED81B253492BB92F77AAD197361B105CE`.
- Un import UI effectué, sans réimport. Hash enregistré : `sha256:855d46c4125c3ac5c4978dcd67659d1ed81b253492bb92f77aad197361b105ce`.
- Contrôle final normalisant le préfixe `sha256:` : exactement une source correspondante. Limite du préflight initial : sa recherche comparait le hash sans retirer ce préfixe ; le contrôle final corrige cette limite.
- Titre : Une éclipse visible en Europe. Note de licence interne RFI enregistrée, avec langue français, compréhension orale et niveau indicatif B1, faute de champs dédiés dans le formulaire d'import.
- Les cinq Edge Functions Studio contrôlées étaient ACTIVE et verify_jwt=true.

## Transcription et analyse

- Une transcription UI ; identifiant `d861a328-1d2a-4d0b-9c71-ed5829daf8e7`, tentative 1, Gemini 2.5 Flash, langue fr, 13 segments.
- Références locales consultées en lecture seule : transcription, fiche apprenant et corrigé PDF. Aucun de ces documents importé ou modifié.
- Texte complet comparé aux références. Corrections UI dans le texte global et les segments correspondants : Roquettes → Roquetes ; Elise Gazangel → Élise Gazengel ; Oui, ça devient → Voyez, ça devient ; qui vous regardez cet événement → qui vont regarder cet événement ; qu'un élément sociologique → qui est un élément sociologique.
- Relecture enregistrée via le bouton dédié ; statut persistant `reviewed`. Il s'agit de la transcription, aucune variante n'a été validée.
- Verdict textuel : contenu exploitable après corrections, négations, heure (vers 20 h), localisation et propos scientifiques conservés. Limite : aucune écoute indépendante effective par l'agent n'est attestée ; comparaison réalisée avec les documents de référence, et non certification acoustique.
- Durée MP3 mesurée par le pipeline : 113 976 ms. Dernier segment : 153 391 ms. Dérive : **+39 415 ms** ; `timestamp_status=unverified`. Ces repères ne sont pas précis et ne doivent pas servir à un découpage automatique. Aucun découpage effectué.
- Une analyse UI réalisée : 9 morceaux, modèle `text+google/gemini-2.5-flash`, niveau détecté B2 (référence RFI indicative B1).
- Morceaux consultés : résumé, description de l'éclipse, visibilité en Europe, Didier Queloz, émotion, vulgarisation scientifique, aspect sociologique, maximum vers 20 h, crédits. Pas de contradiction factuelle manifeste dans ces morceaux par rapport à la transcription corrigée ; ce ne sont pas des faits scellés.

## Génération A2 et blocage

Après autorisation explicite du propriétaire d'amorcer A2 avant la confirmation des faits :

1. A2 seul sélectionné ; A1/B1/B2 non sélectionnés.
2. Un clic sur « Générer les niveaux sélectionnés ».
3. Résultat UI : `A2 : error`.
4. Lecture seule de `differentiation_families` pour cette source : **zéro famille**.
5. Diagnostic du code Edge effectivement déployé (generate-differentiation-family v27) : le contrôle `getPedagogicalSourceReadinessError` précède toute génération/extraction ; source analyzed mais review_status=brouillon entraîne `SOURCE_REVIEW_NOT_APPROVED`.

Le code d'erreur détaillé n'a pas été capturé dans la réponse HTTP du navigateur ; le diagnostic est déduit du contrôle déployé et de l'état exact de la source en base. Les logs consultés n'ont pas fourni une réponse de génération détaillée exploitable.

**STOP avant confirmation ou extraction supplémentaire.** Aucun retry : blocage de prérequis déterministe, pas un échec transitoire justifiant une relance identique. Aucun passage automatique de la source à utilisable/valide.

| Niveau | Famille | Items | Statut |
| --- | --- | --- | --- |
| A1 | aucune | 0 | non lancé |
| A2 | aucune | 0 | tentative échouée avant création |
| B1 | aucune | 0 | non lancé |
| B2 | aucune | 0 | non lancé |

Faits extraits/scellés : aucun ; facts_hash : absent ; confirmation metadata : aucune. Aucun fait disponible à afficher ou à arbitrer. Audit item par item et comparaison inter-niveaux impossibles à ce stade ; aucune conclusion pédagogique sur des brouillons inexistants.

## Audit du parcours UI

- Session manuelle et accès direct Studio : OK.
- Menu formateur examiné : entrée Studio audio absente, malgré l'accès direct fonctionnel.
- Huit étapes visibles, états terminée/en cours/bloquée présents.
- Import, relecture et analyse persistants après rafraîchissement ; aucune perte de session constatée.
- Après analyse, l'écran restait imported et la génération bloquée jusqu'au rafraîchissement ; après rafraîchissement, analyzed et génération disponible.
- Étape faits : demande A2 seul avant de confirmer, contrairement à l'ordre initial de mission ; adaptation ensuite autorisée par le propriétaire.
- Génération proposée alors que la source est brouillon et sera refusée par le backend : prérequis de revue non expliqué dans ce parcours.
- Message d'échec persistant trop peu informatif : A2 : error.
- Mobile 390 px : texte et boutons lisibles, barre d'étapes défilant horizontalement ; contrôle partiel, pas une certification exhaustive.
- Clavier : fermeture de la fenêtre « Morceaux analysés » par Échap vérifiée. Parcours clavier complet non testé.
- Metadata conserve les informations d'import et d'analyse ; `transcription_review_requires_reanalysis=true` reste présent après analyse (anomalie à vérifier, non corrigée).

## Appels, coûts et décision

- 1 opération de transcription Gemini réussie ; 1 opération d'analyse Gemini réussie.
- 1 tentative UI de génération A2, refusée avant le chemin IA selon le contrôle déployé ; aucune extraction de faits ni génération de questions attestée.
- Aucun retry demandé par l'agent ; aucun nouvel appel pour A1/B1/B2.
- Nombre exact d'appels fournisseur internes et coût facturé non disponibles ; ne pas présenter un coût estimé inventé.
- Décision attendue du propriétaire : revue explicite de la source et éventuel passage à « utilisable » pour la recette interne, ou autorisation d'une correction du parcours dans une mission séparée. Aucun changement de statut ni correctif déployé dans ce lot.
- Prochaine reprise : même source, sans import/transcription/analyse supplémentaires ; contrôler d'abord le statut de revue et l'absence de famille pour éviter un doublon.

Le commit documentaire demandé conserve son intitulé prévu, mais ce compte rendu constate un **blocage**, pas une recette complète des quatre brouillons.


---

# Archive : premier arrêt avant connexion

# CapTCF — Lot 5B-C — Deuxième audio (éclipse) — revue brouillons

**Date :** 2026-09-29  
**Nature :** préflight + tentative de recette Studio E2E (arrêt avant import)  
**Dépôt :** `D:\SITES\CAPTCF`  
**Branche docs :** `captcf-lot-05b-c-second-audio-pilot`  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw`  
**App :** https://captcf.fr  

**Point d’arrêt :** aucune mutation Studio (pas d’import, transcription, analyse, génération, publication).  
**Cause :** aucun compte formateur de recette sûr authentifiable dans ce run.

---

## 1. Préflight Git / prod

| Contrôle | Résultat |
| --- | --- |
| Branche locale | `captcf-lot-05b-c-second-audio-pilot` |
| HEAD | `c8b3752eea45009c953da88314ac7ab07d2fe5dc` |
| `origin/main` | même SHA `c8b3752e` |
| Fichiers suivis / non suivis | **préservés** (aucun commit hors handoff prévu ; dossier éclipse et archives restent non suivis) |
| Studio dans `main` | merge PR #44 `9e571cc065d34778f4c8ae3fdc8046f171c5f747` est **ancêtre** de HEAD |
| Prod Vercel (dernier déploiement production) | `dpl_AhV5ky35kiJb87rjXwoMpriCiyDT` — READY — SHA **`c8b3752e`** (docs Phase B PR #45) |
| Prod Studio code | présent via ancêtre `9e571cc0` (déploiement Studio dédié `dpl_D9r8CasuMJjhLLkpC3G6ik1j6c8j` toujours READY) |
| Écart vs mission « prod = 9e571cc0 » | prod pointe désormais sur **docs** `c8b3752e` ; le code Studio n’a pas été retiré |

Aucun push, PR, migration, Edge deploy, secret ou changement RLS dans ce lot.

---

## 2. Fichier audio pilote

| Champ | Valeur |
| --- | --- |
| Chemin | `D:\SITES\CAPTCF\20260812-b1-eclipse\20260812_b1_eclipse\rfi_b1_20260812_eclipse_audio.mp3` |
| `Test-Path` | **True** |
| Taille | **1 334 156** octets |
| Format | MP3 (MPEG audio) |
| Durée (parse frames local) | **≈ 113,98 s** (~1 min 54 s) |
| SHA-256 | `855D46C4125C3AC5C4978DCD67659D1ED81B253492BB92F77AAD197361B105CE` |
| Titre pédagogique prévu | Une éclipse visible en Europe |
| Niveau indicatif origine | B1 |
| Classification | **pilote interne** — diffusion publique non autorisée tant que les droits RFI ne sont pas confirmés |

### Inventaire lecture seule du dossier (inchangé)

| Fichier | Taille (o) | Rôle |
| --- | --- | --- |
| `rfi_b1_20260812_eclipse_audio.mp3` | 1 334 156 | audio pilote (seul autorisé) |
| `rfi_b1_20260812_eclipse_extrait1.mp3` | 248 492 | extrait — **non traité** |
| `rfi_b1_20260812_eclipse_extrait2.mp3` | 245 564 | extrait — **non traité** |
| `…_transcription.docx` / `.pdf` | 202 000 / 57 987 | référence humaine uniquement |
| `…_apprenant.docx` / `.pdf` | 278 986 / 4 096 486 | fiche apprenant — non importée |
| `…_corrige.doc` / `.pdf` | 301 568 / 4 074 596 | corrigé — référence uniquement |

Aucun déplacement, renommage, suppression ni commit de ce dossier.

### Doublon distant (hash)

Requête lecture seule `pedagogical_sources` sur le SHA-256 ci-dessus : **aucune ligne** → pas de source existante à reprendre ; un import Studio créerait une nouvelle source **si** un formateur authentifié était disponible.

---

## 3. Edge Functions Studio

| Function | Status | verify_jwt |
| --- | --- | --- |
| `hash-pedagogical-source` | ACTIVE v6 | **true** |
| `transcribe-pedagogical-source` | ACTIVE v14 | **true** |
| `analyze-pedagogical-source` | ACTIVE v7 | **true** |
| `generate-differentiation-family` | ACTIVE v27 | **true** |
| `publish-differentiation-family` | ACTIVE v16 | **true** |

`create-formateur-account` / `bootstrap-test-accounts` : ACTIVE, JWT true, stubs **410** (pas de création de compte via Edge).

---

## 4. Compte formateur / auth Studio

| Contrôle | Résultat |
| --- | --- |
| URL ouverte | https://captcf.fr/#/formateur/login |
| Deep-link sans hash `/formateur/studio-audio` | 404 Vercel (attendu — app en HashRouter) |
| Session formateur | **absente** — formulaire Email / Mot de passe |
| Compte smoke connu | `smoke.lot05a.formateur…@captcf-smoke.test` — **banni** (run antérieur) ; non réutilisé |
| Création compte | Edge stub 410 — non autorisée / non fonctionnelle |
| Contournement SQL / service_role / scripts | **interdit** par la mission et non tenté pour contourner le Studio |
| Mot de passe / secret | **aucun** lu, affiché ou conservé dans ce handoff |

**STOP AUTH :** la recette E2E Studio (import → … → brouillons A1–B2) ne peut pas démarrer sans connexion formateur réelle fournie par le propriétaire (Take Control navigateur ou compte de recette sûr non banni).

---

## 5. Huit étapes Studio — état

| # | Étape | Résultat |
| --- | --- | --- |
| 1 | Import audio | **non exécuté** (STOP AUTH) |
| 2 | Droits | **non exécuté** |
| 3 | Transcription | **non exécuté** — 0 appel STT |
| 4 | Analyse | **non exécuté** — 0 appel analyse |
| 5 | Faits communs | **non exécuté** |
| 6 | Génération multilevel | **non exécuté** — 0 génération |
| 7 | Relecture pédagogique | **non exécuté** |
| 8 | Publication / séance | **non exécuté** (interdit de toute façon) |

Contrôles UI partiels possibles sans auth : page login formateur ; pas de menu « Studio audio » ni barre d’étapes visibles hors session.

---

## 6. Résultats métier (vides — arrêt)

| Élément | Valeur |
| --- | --- |
| `source_id` | *aucune* (pas d’import ; pas de reprise) |
| `rights_status` | *non posé* (prévu : `internal_pilot`) |
| Transcription | *n/a* |
| Nombre de faits / `facts_hash` | *n/a* |
| Familles A1 / A2 / B1 / B2 | *aucune* |
| Items par niveau | *n/a* |
| Statut exercices | *n/a* — publication **non** |
| `session_exercices` / devoir / élève | **aucun** créé |
| Exercices Louise | **inchangés** |

### Audit pédagogique items

Non applicable — aucune génération.

---

## 7. Gemini / retries / coûts

| Métrique | Valeur |
| --- | --- |
| Appels Gemini | **0** |
| Opérations Gemini | aucune |
| Retries | **0** |
| Autre MP3 traité | **non** |
| Appel après point d’arrêt | **aucun** |
| Coût estimé | **0** |

---

## 8. Anomalie / défaut applicatif

| Type | Détail |
| --- | --- |
| Bloquant recette | Absence de compte formateur de recette sûr utilisable (smoke banni ; création Edge 410) |
| Routing | Accès hors hash `#` → 404 (comportement connu HashRouter ; deep-link correct = `/#/formateur/studio-audio`) |
| Contournement | Non appliqué (SQL / RPC / service_role / scripts manuels refusés pour remplacer le Studio) |
| Correctif minimal proposé | (1) Fournir une session formateur propriétaire via Take Control, **ou** (2) autoriser explicitement un compte de recette temporaire non banni + mot de passe jetable communiqué hors chat ; puis relancer uniquement l’E2E Studio depuis l’UI |

Aucun correctif code ni déploiement proposé comme obligatoire : le Studio prod est déployé ; le blocage est **auth / disponibilité compte**, pas un défaut pipeline Studio démontré.

---

## 9. Décisions demandées au propriétaire

1. Se connecter sur https://captcf.fr/#/formateur/login avec un formateur de recette sûr (ou Take Control du navigateur agent déjà ouvert sur cette page).
2. Confirmer la reprise de la mission 5B-C **après** authentification (même MP3, droits `internal_pilot`, arrêt avant publication).
3. Relire ensuite les brouillons A1–B2 avant toute publication / rattachement séance.

---

## 10. Garanties de ce run

- Publication exercices : **non**
- Séance / devoir / élève : **aucun**
- Push / PR / migration / Edge / secret / RLS : **aucun**
- Import MP3 / Gemini / STT : **aucun**
- Dossier local éclipse : **intact**
- Commit documentaire local prévu : `docs(studio): record second audio draft review` (ce fichier uniquement)
