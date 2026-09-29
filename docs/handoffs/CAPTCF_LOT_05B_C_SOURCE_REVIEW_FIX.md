# Lot 5B-C1 — Revue de source dans le Studio : arrêt d'architecture

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
