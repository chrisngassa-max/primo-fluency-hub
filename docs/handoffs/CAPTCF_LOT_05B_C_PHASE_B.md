# Lot 5B-C — Phase B, correctif du conflit de faits

## État au 30 septembre 2026, avant fusion

Correctif applicatif `736703fd6e65d4a5f3ba8ec9222da89c69cd618c` poussé sur la PR #48. CI [36758941835](https://github.com/chrisngassa-max/primo-fluency-hub/actions/runs/36758941835) verte, preview Vercel Ready. Backend corrigé et smoke complet réussi dès la première tentative. La fusion et la vérification Vercel Production suivent le commit documentaire et sa CI ; elles ne sont pas encore attestées dans ce fichier.

## Cause confirmée et correction limitée

La définition distante issue de be51330b levait `40001` pour le conflit métier `FACTS_REVISION_CONFLICT`. Ce code signifie serialization_failure. Les deux requêtes HTTP de hash obsolète de la première Phase B avaient expiré après 30 secondes chacune et les logs avaient compté 14 763 occurrences du conflit dans la fenêtre de diagnostic. Il s'agissait de deux appels logiques, avec des exécutions répétées côté service ; le nombre exact par appel n'est pas disponible.

La nouvelle migration `20260930182414_fix_facts_revision_conflict_status.sql`, créée avec la CLI officielle via npx, remplace uniquement la définition de cette RPC. Elle utilise `RAISE SQLSTATE 'PT409'`, le message métier inchangé et un détail constant non sensible. PostgREST documente le [mappage PTxyz vers HTTP xyz](https://docs.postgrest.org/en/stable/references/errors.html#raise-errors-with-http-status-codes).

La migration initiale 20260930072021 reste intacte. Signature, owner postgres, SECURITY DEFINER, search_path=pg_catalog, lock_timeout=5s, ACL, contrôles UID/rôle/propriété, hash, verrous et transaction sont conservés. Aucun changement de table, colonne, trigger, RLS ou donnée par la migration. EXECUTE : authenticated oui, PUBLIC/anon/service_role non, hors propriétaire.

L'Edge reconnaît PT409 et renvoie seulement HTTP409 + FACTS_REVISION_CONFLICT. Aucun retry ni timer pour PT409 ou HTTP400/401/403/409/422, ni pour l'ancien conflit métier 40001. Un seul retry technique immédiat est possible pour une vraie transaction annulée (40001/40P01), jamais pour un échec de transport ambigu. Le test injecte effectivement ces échecs et vérifie la borne de deux appels maximum.

## Preuves locales rouge puis vert

- Test Edge initial rouge : PT409 retournait500. Après correction : 34 tests ciblés passent, incluant 14 tests du contrat de conflit et de l'invariant de migration ; lint ciblé réussi.
- PostgreSQL17 isolé : un appel avec hash obsolète constate40001 avant, PT409 après, aucune écriture et réponse en environ2–3ms. Rôles, hash, sauvegarde, atomicité, cinq courses réelles multi-connexions et rollback correctif passent.
- Le rollback restaure la définition initiale à fins de ligne CR/LF normalisées, les ACL, le propriétaire et la configuration. Une première comparaison stricte avait uniquement rencontré cette différence Windows.
- Preuves ignorées : `.local-security-evidence/captcf-facts-test-3af58ebc5bb2/resultat.txt`. Aucun appel modèle.

## Application distante et smoke

Projet unique gudcenhmzlcvhgbgklzw. Sauvegardes RPC et Edge v28 avant mutation dans `.local-security-evidence/facts-pt409/` ; sauvegarde v27 également conservée. Application explicite du seul SQL correctif, sans db push/migration up. Diff de l'historique distant : une seule entrée ajoutée, 20260930182414. L'horodatage attribué par MCP, 20260930183118, a été aligné sur celui du fichier sans réexécuter le SQL.

Seule generate-differentiation-family redéployée : **v28 → v29 ACTIVE**, verify_jwt=true. Les 40 fichiers proviennent du commit correctif ; seul revise-facts.ts change par rapport à v28.

Recette HTTP/JWT réelle sur trois acteurs synthétiques, sans fichier audio, génération ou confirmation :

| Contrôle | Résultat |
| --- | --- |
| Hash obsolète, RPC directe | HTTP409, code PT409, 119,89ms |
| Hash obsolète, Edge | HTTP409, FACTS_REVISION_CONFLICT, 492,77ms |
| Sauvegarde autorisée | HTTP200, 444,35ms, version2 |
| Rejeu de l'ancien hash | HTTP409, 311,80ms |
| Deux sauvegardes concurrentes | un200 et un409, version finale3 |
| Anonyme Edge / RPC | 401 / 401 |
| Autre formateur et élève | 403, Edge et RPC |
| Identité ou provenance falsifiées | 400 |
| Suppression d'un fait référencé | 422 |
| PATCH direct des faits | 403 |
| Hash, provenance et items | hash recalculé vérifié ; preuves/items conservés |
| Refus | source et famille strictement inchangées |
| Confirmation / Gemini | aucune / zéro |

17 assertions HTTP passent, 27 requêtes logiques au total en incluant les lectures. Pour chaque conflit, un seul appel logique ; test unitaire : un seul appel RPC et aucun timer. Les logs distants contiennent exactement les quatre conflits attendus (RPC directe, Edge, rejeu, concurrent perdant), sans multiplication. Aucun WORKER_ERROR ni deadlock trouvé dans la fenêtre contrôlée.

Les trois acteurs ont été déconnectés (204), puis supprimés avec leurs identités, sessions, profils, rôles, source et famille. Vérification de zéro reliquat. Empreintes de toutes les sources/familles/exercices existants identiques avant/après ; Éclipse et sa famille A2 égales en JSON complet. Aucune invocation de la RPC sur Éclipse.

## Rollback correctif

Non utilisé à distance. En cas d'échec de correction après deux tentatives maximum, ne pas fusionner :
1. Redéployer uniquement generate-differentiation-family depuis la sauvegarde v27 validée, en conservant verify_jwt=true.
2. Appliquer uniquement `supabase/secours/20260930182414_fix_facts_revision_conflict_status_rollback.sql` pour restaurer la précédente définition RPC ; le défaut40001 revient, donc ne pas exposer la révision dans ce mode.
3. Vérifier la définition et les ACL ; consigner le rollback dans l'historique d'exploitation. Ne pas exécuter le rollback global20260930072021, supprimer les triggers ou restaurer des faits métier.

Les sauvegardes brutes et preuves complètes restent hors Git. Aucun secret, MP3, .env, supabase/.temp ou fichier privé n'est ajouté. Aucun autre lot, Edge ou migration n'est déployé.
