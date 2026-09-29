# Lot 5B-C1 — Implémentation locale de la revue sécurisée des sources

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

## État courant — 29 septembre 2026

Implémentation locale terminée au commit **1823c50a** (`fix(studio): secure source usability review`). Branche `captcf-lot-05b-c-second-audio-pilot`, départ `7e3f7e3b` conservé dans l'historique, sans amend. Le commit documentaire suivant porte `docs(studio): document secure source review implementation`.

**Migration non appliquée. SQL contrôlé statiquement, tests SQL préparés mais non exécutés : Docker et psql ne sont pas disponibles sur ce portable.** Cette limite interdit de considérer la sécurité SQL comme validée en exécution ou la fonctionnalité comme livrée en production.

### Objets et contrat serveur

- Migration créée avec le CLI Supabase `migration new` : `supabase/migrations/20260929133719_secure_source_usability_review.sql`.
- RPC `public.mark_pedagogical_source_usable(p_source_id uuid, p_confirmed boolean, p_expected_updated_at timestamptz)` ; résultat minimal `(source_id, review_status, updated_at, changed)`.
- `auth.uid()` obligatoire ; `public.has_role(uid, 'formateur'/'admin')` canonique ; propriétaire obligatoire sauf exception admin déjà présente dans les policies.
- Source verrouillée `FOR UPDATE`, puis transcription courante verrouillée. Statuts acceptés : `brouillon` ou répétition `utilisable` seulement ; aucun paramètre de statut cible.
- Source audio, hash `sha256:` suivi de 64 caractères hexadécimaux minuscules, références de stockage non vides ; transcription `reviewed`, texte corrigé non vide, auteur/date de revue ; source `analyzed` et au moins un chunk ; droits non vides et `reusable_for_ai=true`.
- `rights_status` reste du texte libre selon le schéma existant : aucun nouvel enum inventé. La RPC exige une mention de droits et la permission IA ; elle ne prétend pas vérifier juridiquement cette mention ni télécharger le MP3 pour en recalculer le hash.
- Confirmation explicite et version `updated_at` concordante avant transition. Une répétition déjà utilisable revalide les prérequis puis renvoie `changed=false` sans écriture. Conflit de version, attente de verrou >5 s ou deadlock : refus intelligible, transaction atomique.
- Seule colonne métier écrite : `review_status='utilisable'`. Le trigger existant gère `updated_at`. Aucun backfill, table nouvelle, exercice, fait, policy ni privilège de table modifié.

### Protection de l'écriture directe

`guard_pedagogical_source_review_status` est un trigger `BEFORE INSERT OR UPDATE OF review_status`, avec fonction **SECURITY INVOKER**. Il refuse tout changement direct et toute insertion avec un statut autre que brouillon sous le rôle SQL client. Un UPDATE sans changement de statut et les autres colonnes conservent leurs permissions/RLS antérieures.

L'exception repose sur `current_user`, rôle SQL effectif `postgres` ou `service_role`, jamais sur une variable personnalisée ou un champ JWT. La RPC **SECURITY DEFINER**, propriétaire contrôlé `postgres`, exécute son UPDATE sous ce rôle après tous ses contrôles. Un client authenticated ne peut ni se transformer en postgres par un GUC/JWT, ni faire `SET ROLE postgres`. Les opérations administratives existantes et les RPC de relecture détenues par postgres restent possibles ; aucune permission supplémentaire accordée à service_role.

Les deux fonctions imposent `search_path=pg_catalog`, les tables et fonctions applicatives sont qualifiées. EXECUTE révoqué à PUBLIC/anon/authenticated/service_role puis accordé à **authenticated seulement pour la RPC**. Le trigger ne dépend pas d'un appel direct du client à sa fonction.

### Interface

- `src/components/studio-audio/StudioSourceReview.tsx` : quatre statuts séparés, bouton uniquement si prérequis UI satisfaits, dialogue volontaire, annulation sans appel, résultat et refus lisibles. Aucun lancement de génération ni publication.
- `src/lib/sourceUsabilityReview.ts` : appel RPC typé localement, confirmation et version, traduction des refus serveur/réseau.
- `src/pages/formateur/StudioAudioWizardPage.tsx` : intégration à l'étape 3 ; invalidation et relecture de la source après succès, erreur de rafraîchissement remontée.
- `src/lib/studioAudioWorkflow.ts` : génération bloquée sans transcription reviewed, source utilisable/valide et droits IA ; étape 3 non terminée tant que la revue manque.
- `src/lib/pedagogicalSources.ts` : retrait de review_status du patch générique de métadonnées. La vraie protection demeure serveur.

### Validation effectivement exécutée

- 50 tests réussis dans cinq fichiers : nouveau `studio-source-review.test.tsx`, existants `studio-audio-guided-workflow.test.tsx`, `studio-audio-session-link.test.ts`, `studio-audio-b2-mastery-migration.test.ts`, `pedagogical-source-guards.test.ts`.
- 3 tests statiques supplémentaires réussis : `studio-source-review-migration.test.ts`. Ce sont des assertions sur le contrat SQL écrit, pas une exécution PostgreSQL.
- Test bootstrap A2 existant actualisé : transcription `reviewed` exigée, ancien scénario `ready` devenu invalide conformément au contrat serveur.
- Build réussi : `node node_modules/vite/bin/vite.js build`, commande équivalente au script `npm run build` (`vite build`) ; npm absent du PATH. 3770 modules transformés. Avertissements non bloquants : base Browserslist ancienne, gros chunks, imports mixtes statiques/dynamiques.
- `git diff --check` et contrôle du diff indexé : réussis.

### Tests SQL préparés, non exécutés

- `supabase/tests/source_usability_review_test.sql` : fixtures fictives en transaction terminée par ROLLBACK ; anon/élève/autre formateur refusés, propriétaire et admin acceptés, transcription absente/non revue, analyse/chunks/droits/hash absents, refus UPDATE/INSERT directs y compris valide, tentative de GUC usurpé et SET ROLE, confirmation/version, idempotence, conservation des autres champs et UPDATE de titre autorisé.
- `supabase/tests/source_usability_review_concurrency.py` : deux connexions psql réelles, attente observable du détenteur du verrou ; deux confirmations avec un seul effet, droits devenus inadmissibles, statut concurrent a_remplacer et dialogue périmé. Fixtures committées uniquement sur base locale jetable puis nettoyées. Hôte imposé 127.0.0.1:54322 ; aucun secret embarqué, PGPASSWORD fourni par l'opérateur.
- Ces scripts supposent la migration déjà installée dans une base **locale jetable** par l'opérateur ; ils n'appliquent aucune migration eux-mêmes. Leur exécution et la vérification HTTP/PostgREST réelle restent des critères de Phase B, notamment le refus direct et la persistance après rechargement.

### Phase B — à autoriser séparément

1. Sur environnement local jetable équipé de PostgreSQL/Supabase, vérifier le schéma et exécuter migration, tests SQL et concurrence. Vérifier les ACL, le refus anon, le refus PATCH/INSERT PostgREST direct, les modifications metadata permises, l'exception admin et la RPC existante de relecture/transcription.
2. Examiner les résultats avant toute livraison. La migration serveur et le frontend sont nécessaires ; **aucune modification Edge n'est nécessaire pour cette transition**, le générateur possède déjà sa barrière de revue. Actualiser les types DB générés lors du workflow de livraison si requis.
3. Après autorisation de migration distante et livraison frontend, installer le contrat SQL avant de rendre le bouton disponible. Vérifier le statut après rechargement et l'absence d'écriture dans exercices/familles/liaisons ; un succès RPC seul ne remplace pas ces contrôles.
4. Reprendre la source existante `abddcf10-a426-4701-88eb-aaf05d9fc707` depuis Studio sous le formateur propriétaire. Aucun nouvel import, transcription ou analyse payante. Confirmer sa revue explicitement puis rafraîchir. Si un prérequis est refusé, arrêter et arbitrer sans relance automatique.
5. La suite pédagogique A2/A1/B1/B2 reste hors de ce lot et soumise à la reprise autorisée : faits audités avant confirmation, même facts_hash, six items maximum, variantes draft. Limite connue +39,415 s conservée ; horodatages non précis, aucun découpage automatique.

### Retour arrière

`supabase/secours/20260929133719_secure_source_usability_review_rollback.sql` retire d'abord le trigger, puis les deux fonctions avec RESTRICT dans une transaction. Aucune donnée supprimée, aucun CASCADE, aucune ACL de table à restaurer car aucune n'a changé. Une dépendance inattendue fait échouer la transaction ; l'examiner, ne pas ajouter CASCADE. Les statuts déjà enregistrés resteraient inchangés. Retirer/masquer d'abord le frontend de revue et traiter le retour de l'ancien chemin d'écriture directe comme une régression de sécurité ; rollback uniquement sous contrôle explicite.

### Point d'arrêt respecté

Aucune migration appliquée, mutation distante, modification de la source pilote, transcription/analyse/génération, appel Gemini, push, PR, déploiement, publication, séance, devoir ou élève. Fichiers locaux préexistants non suivis préservés. Aucun fichier Classium concerné. Les deux commits sont locaux.

---

## Archive du constat d'architecture précédent (avant 1823c50a)

Le texte ci-dessous décrit l'état antérieur au correctif et reste conservé pour la traçabilité. Ses mentions « aucun bouton » et « aucune migration créée » ne décrivent plus l'état local courant.

Date : 29 septembre 2026. Mission locale uniquement.

**Verdict : mécanisme serveur sûr absent dans le code versionné inspecté. Aucun bouton ajouté. Une migration de sécurisation est nécessaire ; aucune migration créée ou appliquée.**

## Préflight

- Dépôt : D:\SITES\CAPTCF ; branche captcf-lot-05b-c-second-audio-pilot.
- HEAD initial : 45283204, après d32d85e0 et 0290d8b3. Ces commits sont conservés, sans amend.
- Fichiers suivis propres au départ ; aucun fichier non suivi touché : archive/dossier éclipse, MP3 à la racine, docs/fichiers oral/, audit Studio existant, supabase/.temp/linked-project.json.
- Dossier RFI conservé : MP3 principal, deux extraits, transcription DOCX/PDF, apprenant DOCX/PDF, corrigé DOC/PDF. Tailles concordantes avec le préflight précédent.
- MP3 principal : 1 334 156 octets ; SHA-256 855D46C4125C3AC5C4978DCD67659D1ED81B253492BB92F77AAD197361B105CE.
- main local : abe59f1480b037eda7628385fcc346606fb00f27 ; ne contient pas StudioAudioWizardPage.tsx. origin/main localement enregistré : c8b3752eea45009c953da88314ac7ab07d2fe5dc ; contient le Studio. Aucun fetch ni affirmation sur la tête distante actuelle.
- Source pilote abddcf10-a426-4701-88eb-aaf05d9fc707 non sollicitée ni modifiée pendant cette mission.
- Audit des migrations et du code locaux : pas de nouvelle inspection du schéma distant. La concordance du serveur avec ces migrations devra être vérifiée en Phase B.

## Cartographie des statuts

| Notion | Colonne | Type / valeurs |
| --- | --- | --- |
| Droits | pedagogical_sources.rights_status | text nullable ; internal_pilot est une classification de droits |
| Transcription | pedagogical_source_transcriptions.status | état distinct : pending, processing, ready, reviewed, error |
| Analyse | pedagogical_sources.status | text + CHECK : imported, analyzing, analyzed, error |
| Revue source | pedagogical_sources.review_status | text NOT NULL + CHECK : brouillon, utilisable, valide, a_remplacer ; défaut brouillon |
| Revue variantes | differentiation_families.review_status | état distinct, dont draft, validated, published, archived |

review_status n'est pas un enum SQL. Aucun second statut à introduire. La table source ne comporte pas de valeur archived dans ses deux CHECK d'état : ne pas inventer un champ d'archivage ; une source supprimée doit être refusée, a_remplacer et tout état hors brouillon également.

Référence du schéma : supabase/migrations/20260709200000_pedagogical_sources_lot_a.sql.

## Mutations et sécurité existantes

1. src/lib/pedagogicalSources.ts, updatePedagogicalSourceFields : mutation directe .from('pedagogical_sources').update(patch).eq('id', sourceId), avec review_status autorisé par le type du patch. Aucun contrôle de transition ni revalidation serveur de prérequis dans cette fonction cliente.
2. Appels existants trouvés : StudioAudioWizardPage pour métadonnées/droits, StudioAudioFactsStep pour confirmation des faits en metadata. Aucun appel de passage à utilisable trouvé. PedagogicalSourcesPage affiche le badge de revue.
3. RLS staff_update_own_pedagogical_sources : USING et WITH CHECK autorisent created_by=auth.uid() OU has_role(auth.uid(),'admin'). Cela protège contre une source étrangère pour un propriétaire non administrateur, mais n'impose pas à elle seule le rôle formateur lors d'un UPDATE et ne vérifie ni transcription, analyse, droits, hash ni transition. Le CHECK SQL autorise directement valide autant que utilisable.
4. La politique SELECT exige formateur/admin, mais ne remplace pas un contrôle serveur explicite de toutes les conditions et transitions lors de la revue. Ne pas prétendre avoir démontré une exploitation par un élève : aucune tentative distante réalisée.
5. RPC validate_pedagogical_source_transcription_review(uuid,text,jsonb) : valide la transcription ; remet l'analyse à imported et peut marquer la source a_remplacer si des familles sont publiées. Ce n'est pas une action d'approbation de la source. Sa version SECURITY DEFINER et ses grants sont définis par les migrations 20260728114445, 20260728120210 et 20260728120257. Ne pas la détourner pour approuver.
6. Trigger touch_pedagogical_sources_updated_at : mise à jour de date uniquement. Aucun trigger versionné de validation brouillon → utilisable trouvé.
7. generate-differentiation-family : authentification, formateur/admin, accès propriétaire sauf exception admin, source audio, analyzed et review_status utilisable/valide, hash SHA-256, stockage, transcription courante reviewed, segments et chunks présents. Ces guards protègent la génération ; ils ne sécurisent pas une mutation de revue en amont.

## Décision imposée par la mission

Les options 1 et 2 ne satisfont pas les conditions serveur demandées. Un dialogue et des conditions React ne suffiraient pas : un client pourrait appeler directement la mutation existante avec review_status=valide ou contourner les prérequis de revue.

Application de l'option 3 : STOP, proposition uniquement. Aucun frontend, Edge, RPC, policy ou migration modifié. Aucun commit fix(studio) ne doit suggérer qu'un correctif fonctionnel est prêt.

## Plus petit mécanisme proposé pour une mission ultérieure

Une RPC transactionnelle dédiée mark_pedagogical_source_usable(source_id, confirmed, expected_updated_at), sans paramètre target_status et sans patch libre.

- Exiger auth.uid(), confirmation explicite et rôle formateur ; imposer created_by=auth.uid() pour cette action, sans étendre l'exception admin à une source étrangère.
- Verrouiller la source et sa transcription courante dans un ordre compatible avec les mutations de transcription/analyse ; vérifier la version attendue pour éviter une confirmation devenue obsolète.
- Revalider sur le serveur : source audio existante et brouillon, hash SHA-256 valide, fichier référencé, transcription courante reviewed et texte corrigé non vide, analyse analyzed avec chunks, droits non vides. Vérifier la fraîcheur de l'analyse par rapport à la dernière revue de transcription, plutôt que faire confiance à un booléen envoyé par le navigateur.
- Écrire uniquement review_status=utilisable et la traçabilité serveur minimale ; préserver droits, contenu et metadata métier. Ne publier, générer ou rattacher aucun exercice.
- Révoquer l'écriture directe de review_status pour les clients authentifiés, tout en conservant les colonnes nécessaires aux mutations existantes. Attention : révoquer un privilège de colonne ne neutralise pas un GRANT UPDATE global ; inventorier puis adapter les privilèges de table/colonnes et le rôle hérité PUBLIC.
- Bloquer aussi l'insertion cliente d'une source déjà utilisable/valide ; conserver la création brouillon. Tester les accès REST directs en plus de la RPC.
- Si SECURITY DEFINER est nécessaire pour cette écriture protégée : search_path fixe, noms qualifiés, vérifications d'identité/propriété dans la fonction, EXECUTE retiré à PUBLIC/anon et accordé uniquement au rôle voulu ; aucune clé service_role côté frontend.
- Maintenir le fonctionnement des RPC de transcription et mutations serveur existantes ; leur identité et leurs droits doivent faire partie des tests de non-régression.

**Migration nécessaire : oui**, pour la RPC et la fermeture des chemins d'écriture directe. Une nouvelle Edge seule ne fermerait pas ces chemins existants. **Edge à modifier : non dans la proposition privilégiée ; aucune modifiée dans ce lot.**

## Tests à fournir lors de l'implémentation autorisée

Ces cas constituent une spécification d'acceptation, pas des tests exécutés ou un faux succès sur des mocks.

| Cas | Couche et résultat attendu |
| --- | --- |
| Droits/revue distincts | UI : internal_pilot affiché séparément de brouillon ; droits inchangés après succès |
| Transcription non revue/absente | UI désactivée ; RPC refuse même en appel direct |
| Analyse absente ou obsolète | RPC refuse, aucun changement de source |
| Droits absents/espaces | RPC refuse |
| Source étrangère | Deux identités formateurs locales ; refus RPC et UPDATE REST direct |
| Élève ou anon | Refus RPC et mutations directes ; inclure ancien propriétaire ayant perdu son rôle |
| Propriétaire + prérequis | brouillon → utilisable exactement, une écriture atomique |
| Passage à valide/autre transition | Paramètre arbitraire impossible ; UPDATE/INSERT directs refusés ; a_remplacer refusé |
| Confirmation obligatoire | Annuler ne déclenche rien ; confirmed=false/missing refusé serveur |
| Persistance | Rechargement client puis lecture serveur retourne utilisable |
| Génération débloquée | Guard après succès et UI synchronisés ; aucun appel réel Gemini dans les tests |
| Aucune publication | Comptages/états exercices, familles et liaisons inchangés |
| Hash/fichier/source supprimée | Refus explicite, pas de mutation partielle |
| Concurrence | Transcription corrigée après ouverture du dialogue : conflit/version obsolète, refus |
| Metadata et droits | Valeurs conservées, notamment internal_pilot et limites temporelles |
| Non-régression | RPC de relecture invalide encore correctement l'analyse ; mises à jour metadata autorisées préservées |

Tests serveur sur une base locale jetable, sans source pilote ni secrets de production ; tests UI avec données fictives. Il faut valider le refus REST direct pour démontrer l'absence de contournement.

## Validation de ce lot

- Aucun nouveau test exécutable ni build lancé : arrêt d'architecture avant implémentation, conformément à l'option STOP. Un build du code inchangé ne validerait pas les conditions serveur manquantes.
- git diff --check requis sur le seul handoff avant commit.
- Lors de la future implémentation : nouveaux tests serveur et UI ; tests src/test/studio-audio-guided-workflow.test.tsx, studio-audio-session-link.test.ts, studio-audio-b2-mastery-migration.test.ts et pedagogical-source-guards.test.ts ; npm run build ; git diff --check. Pas de suite exhaustive.

## Phase B proposée, non autorisée dans ce lot

1. Autoriser séparément le mécanisme serveur et sa migration ; vérifier le schéma réel en lecture seule, implémenter et tester localement les privilèges et la transition atomique.
2. Ajouter le dialogue Studio, les quatre statuts distincts, les messages de refus et l'invalidation des données après succès ; vérifier build et tests ciblés.
3. Obtenir l'autorisation distincte de livraison serveur/frontend ; ne pas publier un bouton avant son contrat serveur sécurisé.
4. Après livraison, reprendre la source existante abddcf10-a426-4701-88eb-aaf05d9fc707 avec le formateur propriétaire. Confirmer explicitement utilisable et vérifier après rafraîchissement, sans nouvel import/transcription/analyse. Si les contrôles signalent une analyse obsolète, arrêter et arbitrer plutôt que la relancer automatiquement.
5. Effectuer ensuite la relance A2 autorisée, afficher/auditer les faits avant confirmation, réutiliser un seul facts_hash pour A1/B1/B2, six items maximum, toutes variantes draft. Horodatages +39,415 s non précis et inutilisables pour découpage automatique.

## Garanties

Seul ce document est créé. Aucun changement distant, appel Gemini, génération A2, push, PR, migration créée/appliquée, déploiement, publication, séance, devoir ou élève. Handoff de recette précédent conservé intact. Le commit documentaire décrit un blocage, pas un correctif prêt à livrer.
