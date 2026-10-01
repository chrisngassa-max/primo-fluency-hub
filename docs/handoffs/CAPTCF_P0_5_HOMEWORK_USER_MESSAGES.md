# CapTCF P0.5 — messages professeur des devoirs automatiques

Date : 2026-10-01. Branche `captcf-p0-5-homework-user-messages`, créée depuis `1add6f96` (rapport d’arrêt préservé), au-dessus du HEAD distant `fd453a16`. Aucun amend.

## Résultat

`AutoHomeworkPreviewDialog` utilise désormais `automaticHomeworkErrorMessage` pour l’erreur d’envoi et le toast d’échec de préparation. Aucune valeur brute du serveur n’est affichée. Le helper accepte une valeur inconnue, lit défensivement message/details/hint/code, refuse les correspondances partielles et renvoie exclusivement des chaînes françaises fixes. Un getter hostile, null, un objet inattendu, du SQL ou une stack aboutissent au fallback sans exception. Une raison métier précise prime sur le SQLSTATE générique.

Le changement ne touche pas à la préparation, la confirmation, la fermeture après succès, la conservation du request_id, sessionStorage, l’idempotence ou les appels réseau. Une erreur récupérable laisse le dialogue ouvert ; seule une nouvelle confirmation explicite peut réessayer.

## Inventaire de la migration, inchangée

| Codes reconnus exactement | Message fixe / traitement |
|---|---|
| homework_request_conflict, homework_request_required | La préparation a changé depuis votre dernière confirmation. Actualisez l’aperçu, puis confirmez de nouveau. |
| homework_group_forbidden, homework_session_forbidden, homework_student_forbidden | Vous ne pouvez pas envoyer ce devoir au groupe ou à l’élève sélectionné. Vérifiez le destinataire. |
| homework_inexecutable, homework_invalid_entries, homework_invalid_entry, homework_empty_batch | Au moins un exercice n’est pas prêt à être envoyé. Corrigez les éléments signalés, puis réessayez. |
| homework_exercise_busy, 55P03 | Cet exercice est en cours de modification ou d’attribution. Réessayez dans un instant. |
| homework_invalid_deadline | Choisissez une date limite valide située dans le futur. |
| homework_forbidden, 42501 | Vous n’avez pas l’autorisation d’effectuer cet envoi. |
| homework_original_audio_use_manual | Cet exercice audio doit être attribué depuis le parcours manuel. |
| homework_isolation_unsupported | Fallback inconnu, sans détail technique |

Le test d’inventaire compare les 14 codes métier levés/détaillés dans le SQL avec la liste couverte. Les erreurs PostgreSQL de cast/contrainte non reconnues et les erreurs réseau restent opaques via le fallback ; aucune interprétation générale du SQLSTATE ni restitution de message SQL.

Codes d’authentification reconnus : PGRST301/302/303, session_expired, refresh_token_not_found, refresh_token_already_used → « Votre session a expiré. Reconnectez-vous avant d’envoyer le devoir. » Un homework_forbidden seul ne permet pas de distinguer absence d’identité et absence de rôle ; il utilise le message de droits insuffisants.

Les trois messages locaux connus de reprise illisible, stockage indisponible et réponse non confirmée sont reconnus par égalité exacte et remplacés par leurs constantes françaises. Aucun objet ou texte reçu n’est renvoyé directement.

Fallback demandé : « Le devoir n’a pas pu être envoyé. Aucun contenu n’a été créé. Réessayez ou actualisez la page. » Limite : la phrase sur l’absence de création ne constitue pas une preuve lors d’une réponse réseau perdue après commit serveur. Le mécanisme existant de reprise du même request_id demeure la protection contre les doublons ; P0.5 ne change pas la transaction serveur.

## Validation

- Commit rouge `49dbcdf0` : neuf tests du composant réel échouent avant correction, dont les trois erreurs du rapport d’arrêt, busy/details, SQLSTATE 55P03, SQL/stack, null, objet inattendu et toast de préparation. Null produit aussi une exception non gérée dans l’ancien gestionnaire.
- Commit correctif `fb45d7e7` : helper central, deux intégrations dans le dialogue, tests unitaires du helper.
- 116 tests verts dans les trois fichiers applicatifs P0 : helper, contrat du dialogue et exécutabilité. Vérifications DOM des phrases françaises, absence de codes/SQLSTATE/stack, dialogue conservé et un seul appel RPC sans retry automatique. Les tests existants couvrent aussi une nouvelle confirmation après échec, la reprise, le changement d’utilisateur, le stockage indisponible et le chemin manuel.
- Trois reproductions originales du rapport d’arrêt relancées séparément : 3/3 vertes.
- Build Vite réussi ; avertissements existants de taille de chunks/imports dynamiques.
- `git diff --check` réussi ; diff de tout `supabase/` contre `fd453a16` vide. Suites SQL non relancées pour ce correctif exclusivement d’affichage ; aucune validation distante revendiquée.
- Preuves ignorées : `.local-security-evidence/p0-5/red.txt`, `green.txt`, `stop-reproductions-green.txt`, `build.txt`.

## Arrêt et publication

Troisième commit : documentation uniquement. Le rapport d’arrêt `1add6f96` reste dans l’historique. Tous les fichiers non suivis préexistants sont préservés. Aucun SQL, RLS ou verrou P0.4 modifié ; aucune requête Supabase, Edge ou Gemini ; aucun push, changement de PR #49, fusion, migration ou déploiement. Publication soumise à l’autorisation explicite demandée au propriétaire en fin de mission.
