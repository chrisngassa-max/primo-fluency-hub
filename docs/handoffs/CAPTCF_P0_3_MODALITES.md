# CapTCF P0.3 — alignement des modalités

Date : 2026-10-01. PR #49, branche `captcf-p0-safe-automatic-homework`. Supabase `gudcenhmzlcvhgbgklzw` consulté exclusivement en transactions READ ONLY : catalogues et littéraux synthétiques, aucune ligne élève ou exercice réel.

## Contrat retenu

CE : `contenu.texte` visible dans le lecteur P0, au moins 20 caractères Unicode (points de code, espaces ASCII de bord exclus comme btrim PostgreSQL). Une image complète le texte ; elle ne le remplace pas. Message : « Ajoutez un texte support d’au moins 20 caractères. » Aucun texte utilisateur complété ou inventé. Les autres alias textuels acceptés par l'ancien trigger ne sont pas activés dans P0 car le lecteur ne les affiche pas.

CO : le script préparé `script_audio` est requis également avec une référence audio. Celle-ci reste soumise à sa chaîne de publication pour une attribution manuelle ; sa copie par le dialogue automatique reste interdite. Ce durcissement local évite le rejet du trigger qui ne reconnaît pas `contenu.audio` seul. Les anciens alias audio non pris en charge par le lecteur ne sont pas activés.

EE/EO : formats de production correspondants, consignes préparées, EO une seule question. QCM/vrai-faux/appariement/texte lacunaire/transformation conservent leurs contrôles P0 sur les questions, réponses et options. Ces contrôles sont volontairement plus stricts que la seule fonction historique de modalité.

## Audit de tous les BEFORE INSERT/UPDATE actifs

Les définitions exactes de cinq fonctions et des quatre triggers (avec leurs événements et listes UPDATE OF) ont été copiées du catalogue dans `supabase/tests/homework_p0_existing_guards.sql`. Installation dans PostgreSQL local seulement, après les lignes historiques synthétiques et avant la migration P0.

- `trg_enforce_exercise_modality` → `enforce_exercise_modality` → `exercise_modality_issues` : divergences CE et CO reproduites, règles détaillées ci-dessus.
- `sync_exercise_structured_metadata_trigger` : copie des métadonnées et cast integer avant plafonnement. Deux dépassements int4 ont été reproduits par INSERT local avant installation P0, et les casts vérifiés par SELECT distant avec littéraux. P0 refuse désormais les dépassements sur la première valeur non vide selon la priorité exacte des champs du trigger (durée, nombre d'écoutes). Les valeurs int4 plafonnables restent autorisées ; une valeur prioritaire valide masque le fallback, comme le trigger. Cas numérique en notation exponentielle couvert aussi.
- `trg_check_civic_publishable` : les copies P0 utilisent les defaults existants `civic_content=false`, `pedagogical_status=draft`. Aucun passage de statut ni validation civique ajouté. Fonction inchangée.
- `trg_check_publishable_density` : defaults `needs_content_review=false`, statut draft ; aucune publication introduite. Fonction inchangée.

Les colonnes utilisées et leurs defaults réels sont ajoutés au fixture ciblé. Il ne prétend pas restaurer l'intégralité du schéma Supabase. Chaque fixture finale acceptée est réellement insérée sous le rôle authenticated avec ces quatre triggers actifs. Leurs définitions restent identiques après rollback.

## Matrice complète

« P0 avant » porte sur les 34 cas historiques inchangés, validés avant correction. TS et SQL sont les résultats finaux sur les mêmes fixtures ; « triggers existants » combine modalité et les refus int4 démontrés. Oui côté anciens triggers ne signifie pas qu'un contenu est exécutable : les règles P0 supplémentaires peuvent le refuser. Pour les types/enum inconnus, cette colonne ne couvre que les triggers, pas les contraintes de table. L'invariant vérifié est TS = SQL P0 et acceptation P0 ⇒ acceptation des triggers, pas un assouplissement P0 pour imiter les omissions historiques.

| Cas | P0 avant | TypeScript P0 | SQL P0 | Triggers existants | Décision finale |
|---|---|---|---|---|---|
| complete CE QCM | Oui | Oui | Oui | Oui | Accepté |
| empty content | Non | Non | Non | Non (modalité) | Refusé |
| empty items | Non | Non | Non | Non (modalité) | Refusé |
| incomplete item | Non | Non | Non | Oui | Refusé |
| unsupported format | Non | Non | Non | Oui | Refusé |
| missing title | Non | Non | Non | Non (modalité) | Refusé |
| missing instruction | Non | Non | Non | Non (modalité) | Refusé |
| unknown competence | Non | Non | Non | Oui | Refusé |
| numeric question | Non | Non | Non | Oui | Refusé |
| numeric answer | Non | Non | Non | Oui | Refusé |
| choice objects unsupported by player | Non | Non | Non | Oui | Refusé |
| answer not a choice | Non | Non | Non | Oui | Refusé |
| duplicate choices | Non | Non | Non | Oui | Refusé |
| no CE support | Non | Non | Non | Non (modalité) | Refusé |
| unsupported CE alias | Non | Non | Non | Non (modalité) | Refusé |
| CE image | Oui | Non | Non | Non (modalité) | Refusé |
| CE empty image fallback | Oui | Non | Non | Non (modalité) | Refusé |
| vrai_faux textual player contract | Oui | Non | Non | Non (modalité) | Refusé |
| appariement textual player contract | Oui | Non | Non | Non (modalité) | Refusé |
| texte_lacunaire textual player contract | Oui | Non | Non | Non (modalité) | Refusé |
| transformation textual player contract | Oui | Non | Non | Non (modalité) | Refusé |
| invalid true false | Non | Non | Non | Non (modalité) | Refusé |
| nested matching not supported | Non | Non | Non | Non (modalité) | Refusé |
| CO script | Oui | Oui | Oui | Oui | Accepté |
| CO missing support | Non | Non | Non | Non (modalité) | Refusé |
| CO unsupported audio_url alias | Non | Non | Non | Oui | Refusé |
| CO original reference structural | Oui | Non | Non | Non (modalité) | Refusé |
| CO invalid original despite script | Non | Non | Non | Oui | Refusé |
| EE open response | Oui | Oui | Oui | Oui | Accepté |
| EE no prepared task | Non | Non | Non | Oui | Refusé |
| EO open response | Oui | Oui | Oui | Oui | Accepté |
| EO no prepared task | Non | Non | Non | Oui | Refusé |
| EE cannot use QCM | Non | Non | Non | Non (modalité) | Refusé |
| EO two items unsupported | Non | Non | Non | Oui | Refusé |
| CE short text Bonjour | Ajout | Non | Non | Non (modalité) | Refusé |
| CE exactly 20 characters | Ajout | Oui | Oui | Oui | Accepté |
| CE text with image | Ajout | Oui | Oui | Oui | Accepté |
| CE unicode below 20 code points | Ajout | Non | Non | Non (modalité) | Refusé |
| CE trim spaces below 20 | Ajout | Non | Non | Non (modalité) | Refusé |
| CO original with script | Ajout | Oui | Oui | Oui | Accepté structurellement, manuel uniquement |
| vrai_faux textual player contract with sufficient support | Ajout | Oui | Oui | Oui | Accepté |
| appariement textual player contract with sufficient support | Ajout | Oui | Oui | Oui | Accepté |
| texte_lacunaire textual player contract with sufficient support | Ajout | Oui | Oui | Oui | Accepté |
| transformation textual player contract with sufficient support | Ajout | Oui | Oui | Oui | Accepté |
| metadata time overflow | Ajout | Non | Non | Non (int4) | Refusé |
| metadata listening overflow | Ajout | Non | Non | Non (int4) | Refusé |
| metadata numeric overflow | Ajout | Non | Non | Non (int4) | Refusé |
| metadata first value wins | Ajout | Oui | Oui | Oui | Accepté |
| metadata clamp within int4 | Ajout | Oui | Oui | Oui | Accepté |

Les quatre cas de formats textuels avec « Texte du document. » sont conservés comme refus (17 caractères) ; quatre cas distincts avec support synthétique suffisant vérifient ces formats. Aucun contenu réel n'est modifié. La liste initiale de 34 cas a été sondée intégralement à distance ; la liste finale aussi, avec exclusivement des SELECT et des littéraux synthétiques.

## Rouge puis vert et portée

Rouge TypeScript initial : 10 échecs / 45 tests. Rouge PostgreSQL avec l'ancienne migration et les triggers exacts : CE image, fallback image, quatre textes de formats courts, référence CO seule, Bonjour, Unicode court, espaces, et deux dépassements int4. Rouge métadonnées ciblé : 2 échecs / 47 tests. Les traces sont ignorées par Git dans `.local-security-evidence/p0-3/` ; les matrices SQL sont dans les répertoires `captcf-p0-local-*` de preuves locales.

Validation finale : 73 tests applicatifs (49 fixtures partagées + refus de copie audio + 23 tests de dialogue/reprise/manuel), build Vite et diff --check. Le banc SQL vérifie migration sans réécriture des lignes historiques, droits/RLS, supports, insertions réelles avec guards, panne au deuxième exercice, idempotence, concurrence même request_id, quatre courses édition/attribution, refus de rollback avec reçus puis rollback local sans altérer les données métier ou les guards historiques. Reprise P0.1 et architecture P0.2 conservées : exercices + devoirs + reçu ; zéro attribution indépendante créée par la RPC, pas de source_devoir_id ni miroir actif.

Migration existante `20261001074826_safe_automatic_homework.sql` corrigée localement. Aucun nouvel objet SQL par rapport à P0.2 : rollback inchangé, à nouveau testé. Aucun trigger public modifié dans la migration. Le dialogue affiche déjà les messages du validateur central ; sa présentation n'exige donc pas de modification supplémentaire.

## Publication et limites

Commits précédents `dea20421`, `30c74d5a` et `4112d53a` préservés sans amend. Code P0.3 : `7adb3b20` ; correction uniquement d'une ligne vide finale du fixture signalée au staging : `6b921090`, séparée pour respecter l'interdiction d'amend. Le commit documentaire distinct suit ces deux commits. CI et preview doivent être lus sur le HEAD documentaire final ; leurs identifiants sont rapportés dans la réponse de mission. Aucune fusion autorisée.

Le préflight distant complet de Phase B reste à refaire après validation de cette PR : les tests locaux ne valent pas application distante. Migration distante : non. Mutation Supabase : 0. Production : 0. Edge : 0. Secret modifié : 0. Gemini : 0. Aucun Lot 2B.
