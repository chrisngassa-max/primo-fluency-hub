# Lot 5B-C — Revue des faits et livraison de l'éditeur

## Reprise du 30 septembre 2026 — état courant

**Dernier état : livraison en attente de l'autorisation technique du push GitHub**, rejeté avant exécution par la revue automatique pour destination/contenu non explicitement autorisés. Commits SQL `40eb98f8`, UI/Edge `fb0034ea`, documentation `7fc3715b`, intégration main sans changement d'arbre `2f37b5b4`. Aucun push/PR/migration distante/déploiement ni fait corrigé.

Revue documentaire complémentaire effectuée : transcription corrigée distante, transcription RFI DOCX, fiches apprenant/corrigé PDF locales. Les références concordent pour l'attribution Charlotte Derouin des fact_01–04 et fact_17–18, la durée de masquage du Soleil (fact_02), et le sens de la déclaration actuelle de Queloz sur les connaissances du Soleil (fact_06). Les copies audio locales complètes ont le même SHA256 `855d46c4125c3ac5c4978dcd67659d1ed81b253492bb92f77aad197361b105ce` ; cela prouve leur identité binaire, **pas une écoute indépendante**, qui reste non attestée. Aucun découpage ni transcription supplémentaire.

Studio authentifié ouvert sur la source existante : 18 faits, hash refusé inchangé, case de confirmation décochée et bouton de confirmation désactivé. Le frontend de production n'a pas encore l'éditeur. Aucune action de traitement ou d'écriture exécutée. La reprise devra achever la livraison, vérifier l'audio et effectuer seulement les corrections via UI, puis s'arrêter avant confirmation.

Cette section remplace les états techniques historiques ci-dessous. Phase B déjà autorisée ; aucun renouvellement d'autorisation métier requis. Arrêt avant confirmation, génération/Gemini, validation/publication d'exercice, séance, devoir ou élève.

- Préflight distant : source `abddcf10-a426-4701-88eb-aaf05d9fc707`, A2 `a529ba06-2bf1-40e9-b7da-62bbb0142f91`, version 1, 18 faits, 6 items, draft, aucune confirmation ; hash refusé inchangé. Edge v27 et migration de révision absente.
- Éditeur existant finalisé ; Edge réconciliée avec v27, contrat borné testé. Fenêtre de concurrence révision/génération corrigée sous verrou source SQL ; archives de faits révisés refusées.
- 104 tests ciblés passent ; build Vite équivalent au script npm réussi ; diff check et lint ciblé passent. Migration, droits, hash, atomicité, rollback et cinq courses multi-connexions PostgreSQL 17 passent, claims JWT simulés. Rapport `.local-security-evidence/captcf-facts-test-71eac8e3d3c9/resultat.txt` ; conteneur supprimé.
- Commits SQL `40eb98f8`, UI/Edge `fb0034ea`, documentation séparée. Aucun déploiement à ce stade ; suite via PR/CI/preview/fusion, sans push main.
- Session navigateur Studio authentifiée disponible. Aucune correction distante effectuée ; vérification audio indépendante encore non attestée. Les pistes pédagogiques historiques restent à confronter aux trois sources avant saisie UI. Dérive +39,415 secondes : aucun découpage automatique.

Voir le [handoff technique courant](CAPTCF_LOT_05B_C_FACTS_EDITOR.md) pour preuves, limites et retour arrière. Les six groupes de fichiers non suivis préexistants restent intacts.

---

## Historique des reprises précédentes (affirmations datées, parfois obsolètes)
## Migration et éditeur locaux — 30 septembre 2026

Reprise autorisée réalisée sur `captcf-lot-05b-c-facts-editor`, HEAD `72df56e2` inchangé faute de permission Git (`.git/index.lock`). Migration `20260930072021_revise_differentiation_facts_atomically.sql` créée par la CLI officielle, rollback dans `supabase/secours`, tests SQL préparés. RPC basée sur `auth.uid()`, sans identité ni hash final client, garde des droits/concurrence/provenance/références, hash calculé SQL et confirmation invalidée atomiquement. Action Edge `revise_facts` sous JWT utilisateur, éditeur Studio local avec comparaison/annulation/sauvegarde distincte.

**103 tests applicatifs ciblés verts et build réussi. Tests SQL réels non exécutés : Docker Desktop ouvert mais docker.exe interdit d'exécution dans cette session.** La migration n'est pas déclarée validée. La base locale du générateur reste à réconcilier avec le shared-facts déployé ; elle bloque explicitement la génération sur faits révisés pour éviter une réextraction. Aucun artefact déployé.

Voir [handoff complet et commandes des trois commits manuels](CAPTCF_LOT_05B_C_FACTS_EDITOR.md). Faits Éclipse et hash refusé inchangés ; zéro appel Gemini, zéro mutation distante, zéro génération/confirmation/validation/publication, aucun push/PR/déploiement. Les fichiers non suivis préexistants sont préservés. L'ancienne proposition SQL et les décisions ci-dessous sont conservées comme historique, non comme contrat courant.

## Éditeur local — arrêt au préalable SQL (29 septembre 2026)

Branche dédiée `captcf-lot-05b-c-facts-editor`, base préservée `5d63f8713ffeff8d59945283a9c46c6072cb333e`, sans fetch. Les JSON actuels suffisent, mais aucun mécanisme transactionnel existant ne réunit révision de famille et invalidation de confirmation sur la source. Une migration de fonctions/gardes est nécessaire dans l'architecture actuelle. Conformément à la clause STOP : **aucun éditeur, aucune extension Edge, aucune migration créée ou appliquée**.

Voir [cartographie, droits, tests à prévoir et suite autorisable](CAPTCF_LOT_05B_C_FACTS_EDITOR.md), [proposition SQL](facts-editor-proposal.sql) et [rollback proposé](facts-editor-rollback-proposal.sql), hors migrations et non exécutés. Aucun test applicatif ni build lancé à cet arrêt ; aucune implémentation déclarée testée. Les 18 faits distants et le hash refusé ci-dessous restent inchangés, sans confirmation. Gemini : 0 ; mutations distantes : 0 ; push/PR/déploiement : aucun. Les fichiers non suivis préexistants restent intacts.

## Refus propriétaire des faits — blocage produit avant correction (29 septembre 2026)

Source `abddcf10-a426-4701-88eb-aaf05d9fc707`, famille A2 draft `a529ba06-2bf1-40e9-b7da-62bbb0142f91`. Le propriétaire **refuse** l'ensemble de 18 faits et le hash `sha256:02b810eeb8288c090d8b18f938f923ca3ced1f25ad1d1d1dceadb00da217eb0d`. Ne pas confirmer ni réutiliser ce hash pour A1/B1/B2.

### Possibilités réelles du Studio : aucune édition

Inspection du panneau de production « Vérification des faits communs » : 18 lignes de texte et références de provenance, case de confirmation non cochée, bouton « Confirmer les faits » désactivé. Aucun champ modifiable ni commande modifier/supprimer/fusionner/reproposer les faits seuls. Lecture de `StudioAudioFactsStep.tsx` concordante : affichage par paragraphes, unique action d'écriture = confirmation dans les métadonnées de source. **STOP conformément à la mission**, sans utiliser la génération complète comme remplacement d'une édition.

Aucun nouvel ensemble constitué ou enregistré (0 fait corrigé en base), aucune suppression et aucune attribution modifiée en production. Aucune comparaison audio indépendante supplémentaire attestée : la mission est arrêtée au défaut produit, avant une revue complète audio/transcription/apprenant/corrigé. Les formulations ci-dessous sont des pistes documentaires issues des références déjà lues, pas un ensemble prêt à sceller.

| ID concerné | Correction proposée, non appliquée | Passage de référence | Modification réalisée | Verdict |
| --- | --- | --- | --- | --- |
| fact_01–04, fact_17–18 | Corriger speaker/viewpoint en Charlotte Derouin | La transcription locale attribue introduction et conclusion à Charlotte Derouin | Aucune | Attribution à corriger ; conserver Élise Gazengel comme personne ayant recueilli les propos dans l'objet de fact_18 |
| fact_02 | La Lune cache le Soleil pendant quelques minutes lors de la phase décrite comme éclipse totale | « Pendant quelques minutes […] la Lune va cacher le Soleil », puis « éclipse totale » | Aucune | Ne pas attribuer cette durée à l'ensemble du phénomène ; formulation exacte à contrôler avec l'audio avant adoption |
| fact_06 | Selon Didier Queloz, une éclipse n'apporte actuellement pas vraiment d'information sérieuse sur la connaissance du Soleil | « aucune […] information sérieuse […] en termes de connaissances du Soleil d'une éclipse, actuellement » | Aucune | Retirer « ou d'une éclipse » ; conserver la restriction actuelle et l'attribution à Queloz |

### Doublons et éléments à réduire

Les IDs fact_05, fact_06, fact_13 et fact_14 apparaissent chacun **une seule fois** dans le DOM actuel et dans le payload A2 sauvegardé. fact_05 traite de l'émotion, fact_06 de l'apport de connaissances : faits distincts. fact_13 décrit l'attention du public et fact_14 l'exploitation de cette occasion : relation causale, pas doublon exact. Les répétitions signalées par le propriétaire ne sont donc pas reproduites dans cet état ; aucune suppression aveugle.

| Ancien ID | Motif de suppression/fusion envisagé, non exécuté |
| --- | --- |
| fact_09 | « partager quelque chose » trop vague ; retirer comme fait autonome ou intégrer à l'explication de vulgarisation, après contrôle des références |
| fact_14 | Métaphore « tirer toutes les ficelles » peu exploitable isolément ; reformuler/fusionner avec fact_12–13 sans perdre le lien avec l'attention du public |
| fact_15 | « élément sociologique fascinant » incomplet isolément ; fusionner avec fact_16, qui précise l'observation simultanée par des millions de personnes |
| fact_05 / fact_07 / fact_08 | Chevauchement sur émotion/expérience extraordinaire/transmission : envisager un énoncé attribué à Queloz ; « événement émotionnel » est bien dans le texte et n'est pas à supprimer comme invention |

**Suppressions réalisées : 0.** Aucun ensemble nouveau proposé comme complet pour A1–B2 ; la suffisance pédagogique B2 doit être évaluée et ne peut être fabriquée par ajout d'informations extérieures.

### Plus petit correctif proposé, non implémenté

1. Frontend : ajouter au panneau faits un mode brouillon avec édition du texte et de l'attribution, suppression/fusion, provenance visible et comparaison avant/après. Séparer « Enregistrer les corrections » de « Confirmer ». Aucun appel Gemini requis pour cette édition manuelle.
2. Serveur : une opération authentifiée de révision de l'ensemble non confirmé, vérifiant rôle et propriété, famille draft/non publiée, absence d'autres variantes réutilisant l'ensemble et version/hash attendu pour éviter les écritures concurrentes. Valider IDs/provenance/références, recalculer le hash côté serveur ; aucune empreinte cliente autoritaire. Persister atomiquement les corrections avec trace avant/après et retirer toute confirmation obsolète.
3. Cohérence A2 : signaler le brouillon comme à relire dès modification des faits ; bloquer confirmation/génération/publication si un item référence un fait supprimé ou devenu incompatible (notamment item_02). Ne pas changer silencieusement les réponses ni conserver une validation technique obsolète. La confirmation du nouvel ensemble doit rester une action distincte sous nouvelle autorisation propriétaire.

Proposition uniquement : aucune édition de code, SQL, RPC, service_role ou mutation distante utilisée. Aucun push, déploiement, migration, import, transcription ou analyse. **Gemini supplémentaire : 0 ; confirmation : non ; A1/B1/B2 supplémentaires : non ; validation/publication A2 : non ; séance/devoir/élève : aucun.** Dérive +39,415 s toujours connue, sans découpage ni preuve temporelle précise.

---

## Phase B C2 livrée — arrêt pédagogique après A2 (29 septembre 2026)

- HEAD local, référence origin et HEAD GitHub identiques : `a5fc54862c5da04af902c98a1aab499c4121ebca`. Les commits manuels `6a6b358f` et `a5fc5486` résolvent le blocage de commits décrit plus bas (historique conservé).
- [PR #47](https://github.com/chrisngassa-max/primo-fluency-hub/pull/47) : quatre fichiers, helper de génération, test et deux handoffs ; blobs distants identiques au checkout. Aucun fichier Edge/migration. L'ancienne référence locale origin/main était périmée ; contrôle effectué contre le main GitHub réel `8e11677b`.
- [CI 36602152036](https://github.com/chrisngassa-max/primo-fluency-hub/actions/runs/36602152036) : tests, build et lint success. Preview Vercel Ready `86wE19g1m4Fffyp9D4NEuWmYVbCT`, page publique affichée.
- Fusion autorisée après contrôles verts, expected head contrôlé, sans push direct main. Nouveau main `60c688338f6d9c22731f2383455119ffcee74096`. Production Vercel success `G7cEgfsqDxjWjJKnichDUPb2jzqQ`.
- Vérification publique captcf.fr : bundle `/assets/index-OMa-BJb-.js`, appel effectif compilé `generate-differentiation-family` avec `body:{sourceId:e,force_regenerate:n,target_level:r,correctif_05a_c:!0}`. Pas d'interception de requête authentifiée ni lecture de token ; preuve par code servi et métadonnées serveur après génération.
- Source `abddcf10-a426-4701-88eb-aaf05d9fc707`, projet `gudcenhmzlcvhgbgklzw` : utilisable/analyzed, zéro famille avant appel ; empreintes transcription `fab3d0c9df3b0c2fb5a487c53bcba6b2` et chunks `95b19efdcd194954731d0b000435f383` inchangées.
- Après rechargement du Studio authentifié : A2 seul sélectionné, bouton activé une seule fois. Famille `a529ba06-2bf1-40e9-b7da-62bbb0142f91` / `A2CO-8F51801D54B0`, six QCM, generation_status generated, review_status draft, payload.status draft, published_exercise_id null. Métadonnées `lot_05a_c:true,max_items:6` : correctif actif en production.
- Un seul appel Studio, deux appels Gemini selon le chemin serveur réussi (extraction puis items), zéro retry ; tokens/coût non exposés, coût monétaire non déterminable. Le rapport technique interne produit des warnings ; aucune action de validation pédagogique effectuée.
- **STOP avant confirmation : 18 faits extraits, ensemble non approuvé. A1/B1/B2 non générés.** Hash calculé serveur mais non confirmé : `sha256:02b810eeb8288c090d8b18f938f923ca3ced1f25ad1d1d1dceadb00da217eb0d`.
- Référence locale lue : `20260812-b1-eclipse/20260812_b1_eclipse/rfi_b1_20260812_une_eclipse_visible_en_europe_transcription.docx`, comparée à la transcription corrigée. Pas de nouvelle écoute indépendante attestée ; aucune affirmation de validation audio complète. Les contradictions textuelles suffisent à refuser la confirmation.
- Défauts bloquants : fact_01–04 et fact_17–18 attribuent speaker/viewpoint à Élise Gazengel alors que la référence nomme Charlotte Derouin ; Élise recueille les propos. fact_06 ajoute « ou d'une éclipse », altérant le sens : proposition de correction « Selon Didier Queloz, observer une éclipse n'apporte actuellement pas vraiment de nouvelles connaissances sérieuses sur le Soleil ». fact_02/item_02 demandent une durée globale alors que le passage décrit le masquage du Soleil ; préciser la phase décrite.
- Le panneau faits affiche les 18 faits, case non cochée et confirmation désactivée. Pas de contrôle d'édition/suppression individuelle dans ce panneau ; aucune correction directe en base et aucune nouvelle extraction.
- Audit transversal supplémentaire : omissions de l'Espagne, de Roquetes/Catalogne et de la présentation de Queloz dans les faits ; réponses QCM B/B/B/C/B/C (position répétitive). Ne pas considérer la capacité B2 déduite automatiquement comme une validation pédagogique.

### Liste complète des faits affichés, avant toute confirmation

1. **fact_01** — La lune va cacher le soleil. Attribution speaker/viewpoint erronée : Charlotte Derouin, et non Élise Gazengel.
2. **fact_02** — Cela (l'éclipse) va durer quelques minutes. Attribution speaker/viewpoint erronée : Charlotte Derouin, et non Élise Gazengel.
3. **fact_03** — Il va faire nuit en plein jour. Attribution speaker/viewpoint erronée : Charlotte Derouin, et non Élise Gazengel.
4. **fact_04** — On parle alors d' éclipse totale. Attribution speaker/viewpoint erronée : Charlotte Derouin, et non Élise Gazengel.
5. **fact_05** — Une éclipse totale est un événement émotionnel. Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
6. **fact_06** — Il n'y a aucune information sérieuse qui sort en terme de connaissance du soleil ou d'une éclipse actuellement. À corriger : ajout de « ou » qui change le sens ; Queloz parle de ce qu'une éclipse apporte actuellement à la connaissance du Soleil.
7. **fact_07** — Une éclipse (totale) est un événement tellement extraordinaire à vivre. Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
8. **fact_08** — On peut transmettre l'émotion de la science. Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
9. **fact_09** — Il y a un intérêt de partager quelque chose (via l'éclipse). Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
10. **fact_10** — L'éclipse donne l'occasion de parler du développement de la connaissance. Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
11. **fact_11** — L'éclipse donne l'occasion de parler des outils qui permettent actuellement d'étudier le soleil et des grandes questions (comme le futur du soleil ou son fonctionnement). Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
12. **fact_12** — L'éclipse (ou l'événement) devient un prétexte pour parler de science. Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
13. **fact_13** — Les gens vous regardent à ce moment-là (quand on utilise un événement spécifique). Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
14. **fact_14** — On peut en tirer toutes les ficelles d'un événement spécifique (comme l'éclipse). Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
15. **fact_15** — Il y a un élément sociologique assez fascinant. Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
16. **fact_16** — des millions de personnes vont regarder cet événement en même temps. Texte compatible avec la transcription de référence ; pas une validation audio indépendante.
17. **fact_17** — Cette éclipse aura lieu à son maximum autour de 20h. Attribution speaker/viewpoint erronée : Charlotte Derouin, et non Élise Gazengel.
18. **fact_18** — Les propos ont été recueillis par Élise Gazengel. Attribution speaker/viewpoint erronée : Charlotte Derouin, et non Élise Gazengel.

### Audit des six brouillons A2

| Niveau | N° | Question | Compétence | Faits | Options | Réponse | Justification | Distracteurs | Difficulté réelle | Défaut et décision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A2 | 1 | Qu'est-ce qui va cacher le soleil pendant l'éclipse ? | Repérer l’agent d’une action | fact_01 | A: La Terre<br>B: La Lune<br>C: Une étoile<br>D: Un nuage | B : La Lune | Explicite, fact_01. | Terre/étoile plausibles ; nuage non entendu, catégorie erronée. | A1/A2 facile | À corriger : métadonnées du fait et du distracteur. |
| A2 | 2 | Combien de temps l'éclipse va-t-elle durer ? | Repérer une durée | fact_02 | A: Quelques secondes<br>B: Quelques minutes<br>C: Quelques heures<br>D: Toute la journée | B : Quelques minutes | Le masquage du Soleil dure quelques minutes. | Unités de durée accessibles. | A2 | À corriger : demander la durée du masquage total, pas celle de toute l’éclipse. |
| A2 | 3 | Que va-t-il se passer pendant l'éclipse totale, en plein jour ? | Repérer une conséquence | fact_03 | A: Il va faire très chaud.<br>B: Il va faire nuit.<br>C: Il va pleuvoir.<br>D: Le soleil va briller plus fort. | B : Il va faire nuit. | Explicite, fact_03. | Pluie/chaleur absentes du support ; dernier choix faible. | A1/A2 facile | À corriger : distracteurs et attribution du fait. |
| A2 | 4 | Comment Didier Queloz décrit-il une éclipse totale ? | Repérer une appréciation | fact_05, fact_07 | A: C'est un événement ennuyeux.<br>B: C'est un événement dangereux.<br>C: C'est un événement émotionnel et extraordinaire.<br>D: C'est un événement commun. | C : événement émotionnel et extraordinaire. | Deux qualificatifs de Queloz, fact_05/07. | Oppositions faibles ; bonne réponse plus longue. | A2/B1 lexical | À corriger : équilibrer et renforcer les distracteurs. |
| A2 | 5 | Selon Didier Queloz, pourquoi l'éclipse est-elle un 'prétexte' intéressant ? | Comprendre l’intention de vulgarisation | fact_12, fact_10, fact_11 | A: Pour faire la fête.<br>B: Pour parler de science et de connaissance.<br>C: Pour rester à la maison.<br>D: Pour voyager. | B : parler de science et de connaissance. | fact_10/11/12. | Rester à la maison très faible ; voyage peu pertinent. | A2 haut/B1 | À corriger : mot prétexte et distracteurs trop faciles. |
| A2 | 6 | À quelle heure l'éclipse sera-t-elle à son maximum ? | Repérer une heure | fact_17 | A: Autour de 8h du matin.<br>B: Autour de 14h.<br>C: Autour de 20h.<br>D: À minuit. | C : autour de 20h. | Heure énoncée, fact_17, pas un timestamp technique. | Heures accessibles, certains choix éliminables avec ce soir. | A2 facile | Acceptable pour le texte ; corriger l’attribution du fait. |

Les décisions sont une revue documentaire, pas une validation dans l'application. Audit A1/B1/B2 et comparaison multilevel impossibles à ce stade : génération bloquée par les faits. Hash commun non applicable, une seule famille.

Aucune importation, transcription ou analyse relancée. Dérive **+39,415 s** conservée ; aucun découpage automatique ni question basée sur ces timestamps. Aucune validation/publication, séance, liaison, devoir ou élève. Aucune Edge ni migration modifiée. Arrêt en attente d'arbitrage sur les faits et d'un chemin d'édition sûr avant scellement ; ne pas régénérer A2 pour masquer le défaut.

Preuves hors Git : `outputs/eclipse-a2-review.json` (payload complet) et `outputs/eclipse-facts-unconfirmed.png` (capture Studio) dans l'espace Codex.

---

## Lot 5B-C2 — correctif local du payload de génération

29 septembre 2026. Branche `captcf-lot-05b-c-second-audio-pilot`, départ `3dec873b`, ancêtre `bea631b2` conservé. Non-suivis préexistants préservés. Préflight distant en lecture seule : Éclipse `abddcf10-a426-4701-88eb-aaf05d9fc707` toujours `utilisable`, `analyzed`, zéro famille dans le seul projet `gudcenhmzlcvhgbgklzw`.

- Cause : le helper frontend omettait le booléen strict `correctif_05a_c`, activant le mode historique de l'Edge version 27. Contrat déployé relu : réutilisation des faits et plafond de six seulement en mode `lot05a_c`.
- Chaîne Studio : `StudioAudioWizardPage` → `SourceDifferentiationFamilyActions` → `generateDifferentiationFamiliesForLevels` → `generateDifferentiationFamily`. Un seul appel direct frontend à l'endpoint, dans `src/lib/differentiationFamilies.ts`.
- Correctif dans ce dernier helper, volontairement partagé et testé avec la banque des sources (`PedagogicalSourcesPage`). Le comportement borné s'applique donc aux deux interfaces, sur A1/A2/B1/B2 et sur la régénération explicite.
- Avant : `{ sourceId, force_regenerate: forceRegenerate, target_level: targetLevel }`.
- Après : `{ sourceId, force_regenerate: forceRegenerate, target_level: targetLevel, correctif_05a_c: true }`. `force_regenerate` préexistant conservé, false par défaut. Aucun champ libre, source Louise, facts_hash ni ensemble de faits client ajouté ; les extras non typés sont ignorés.
- A2 initial, confirmation des faits puis autres niveaux : guards inchangés et testés. Génération et publication restent indépendantes.
- Retry : aucun retry automatique. Test d'un échec puis d'un seul retry explicitement piloté : exactement deux appels mockés au total par niveau. **La limite d'un retry reste une règle opérationnelle de la recette, pas un compteur persistant dans l'UI** ; les clics manuels successifs ne sont pas limités par ce correctif strictement consacré au payload.

### Validation locale

- Nouveau `src/test/studio-generation-payload.test.ts` : 14 cas, dont quatre niveaux, défaut A2/régénération, orchestration sans publication, erreurs sans boucle, retry piloté, blocage des trois autres niveaux avant confirmation, inventaire des appels frontend. Après correction de la fixture de droits du test, rouge attendu : 6 échecs pour le drapeau absent / 8 réussites ; après correctif : 14 réussites.
- 91 tests réussis dans 11 fichiers : nouveau payload ; Studio guided workflow, source review, source review migration, session link, B2 mastery migration ; differentiationFamilies multilevel, differentiation-family multilevel validation, referential versioning multilevel ; source guards et generation idempotence. Aucune suite exhaustive.
- Tests Lot 5A-C nommés absents de ce checkout et du bundle déployé. À la place, 7 assertions locales sur le module pur `lot05a-c.ts` récupéré exactement dans l'Edge version 27 : mode true/absent, borne de prompt, plafond persistant six, extraction initiale, réutilisation, divergence. Tous réussis, sans réseau ni modèle. Harnais et copie hors Git dans `work/test-lot05a-c.cjs` et `work/lot05a-c-deployed.json` de l'espace Codex ; aucune Edge locale ou distante modifiée.
- `npm run build` exécuté via le CLI npm local (absent du PATH) : premier essai bloqué par EPERM au nettoyage de `dist/assets`. Réexécution du même script avec `--outDir` vers `work/build-c2` de l'espace Codex : réussie, 3770 modules. Avertissements existants Browserslist, imports dynamiques et taille des chunks. Aucun déploiement.
- `git diff --check` réussi. Documentation Supabase invoke et changelog consultés ; aucune modification SDK/API.

### Phase B ultérieure — publication frontend uniquement

Sous autorisation de livraison : pousser la branche, ouvrir une PR vers main, contrôler précisément le diff frontend/tests/documentation, attendre CI et preview vertes, puis fusion et vérification du frontend livré. Ne pas redéployer les fichiers Edge locaux : le correctif serveur est déjà présent dans la version 27 et le checkout n'en contient pas le module Lot 5A-C.

Reprendre ensuite **la source existante**, sans import, transcription ou analyse. Vérifier utilisable, zéro famille et payload avec drapeau ; lancer A2 seul sous autorisation de génération, auditer les faits et afficher leur liste avant confirmation, conserver le hash puis générer A1/B1/B2 avec le même hash. Six items maximum ; au plus un retry piloté par niveau uniquement pour une cause technique identifiée. Stop sur divergence ou arbitrage. Toutes les variantes restent draft. Dérive +39,415 s conservée, aucun découpage automatique.

Cette mission : **zéro appel Gemini, aucune génération, aucune mutation distante**. Aucun push, PR, publication, migration, déploiement, séance, devoir ou élève. Source préservée ; seule documentation et code/test locaux modifiés.

### Blocage des commits locaux

Les deux commits demandés n'ont pas pu être créés : `git add` échoue avec `Unable to create 'D:/SITES/CAPTCF/.git/index.lock': Permission denied`, y compris après autorisation explicite d'écriture sur le dépôt puis `.git`. Aucun fichier index.lock existant détecté. Aucun changement d'ACL ni contournement effectué. HEAD reste `3dec873b`, commits antérieurs conservés. Modifications non commitées prêtes : d'abord les deux fichiers code/test pour `fix(studio): enable bounded shared-facts generation`, puis ce handoff seul pour `docs(studio): document bounded generation fix`. Aucun amend.

---

## Lot 5B-C — arrêt préventif avant génération : contrat Studio/Edge incompatible

29 septembre 2026. **BLOQUÉ avant tout appel Gemini.** Source unique `abddcf10-a426-4701-88eb-aaf05d9fc707`, projet unique `gudcenhmzlcvhgbgklzw`.

### Préflight et preuves

- Source toujours `utilisable`, `analyzed`, droits `internal_pilot`, réutilisation élèves désactivée. Session formateur authentifiée reprise dans le Studio, aucun identifiant de connexion lu ou conservé.
- Transcription et analyse inchangées depuis la clôture Phase B : empreinte transcription `fab3d0c9df3b0c2fb5a487c53bcba6b2`, chunks `95b19efdcd194954731d0b000435f383`, neuf chunks ; source updated_at inchangé `2026-09-29T16:09:08.310003+00:00`.
- Zéro famille existante, y compris familles archivées. Aucun doublon créé.
- Contrôle Vercel toujours success pour `8e11677b494e148173155e52eff2f7de67587181`, déploiement `GPFd2GSNCdDGG2U8m4jEEDwKdvjc` ; interface Studio accessible sur captcf.fr. Preuve de livraison héritée de Phase B, sans prétendre disposer d'un nouveau SHA affiché dans le DOM.
- Étape 5 ouverte : A2 seul coché ; bouton de génération **non activé**. Capture hors dépôt : `outputs/eclipse-generation-preflight.png` dans l'espace de travail Codex.

### Défaut exact empêchant la mission

Vérification en lecture seule du fichier frontend au SHA de production via GitHub et de la fonction Edge réellement déployée (version 27, empreinte de bundle `f02ffd2e1079d57676ee0fc9dd2eaef2c0e59254bbba92b19b4be470bfe926fd`) :

1. `src/lib/differentiationFamilies.ts`, fonction `generateDifferentiationFamily`, envoie uniquement `{ sourceId, force_regenerate, target_level }` ; **aucun `correctif_05a_c: true`**.
2. Dans l'Edge déployée, `resolveCorrectifMode(body.correctif_05a_c)` retourne `rollback` sauf si la valeur est strictement `true`.
3. La recherche et réutilisation des faits des familles précédentes n'existent que dans le bloc `correctifMode === "lot05a_c"`. En mode effectif `rollback`, `facts` reste null puis `geminiJson` extrait des faits à chaque nouvelle famille, même après confirmation frontend.
4. Dans ce même mode, `resolveCorrectifPromptItemBounds` conserve les volumes du contrat et `finalizeVariantItemsForPersist` ne plafonne pas à six. Contrats déployés : A1 3–4, A2 4–6, B1 5–7, B2 5–8 items. Le plafond strict demandé n'est donc pas assuré.

Ce défaut est établi par lecture du chemin d'exécution, **pas par un appel de génération**. Le bouton ne propose aucune option permettant d'activer le correctif. Lancer A2 seul serait possible avec une consigne de 4–6 items, mais ne permettrait pas de poursuivre la mission multilevel sans nouvelle extraction interdite : arrêt avant dépense et création d'un brouillon partiel. Aucun appel direct, contournement de l'interface, changement de code, migration ou déploiement effectué.

### Résultats et audit

| Niveau | family_id | Items | Statut |
| --- | --- | --- | --- |
| A2 | Aucun | 0 | Non généré |
| A1 | Aucun | 0 | Non généré |
| B1 | Aucun | 0 | Non généré |
| B2 | Aucun | 0 | Non généré |

- Faits extraits : 0 ; liste vide ; aucun fait confirmé. `facts_hash` : absent. Hash commun : non applicable, aucune famille.
- Audit pédagogique par item : non réalisable, aucun item créé. Aucun verdict pédagogique inventé ; aucun arbitrage de fait soumis.
- Gemini : **0 appel** ; retries : **0** ; coût de génération de cette tentative : **0**.
- Aucune transcription ni analyse relancée ; aucune écoute nouvelle attestée dans cette tentative. La transcription corrigée reste la référence textuelle.
- Dérive de **+39,415 secondes** maintenue comme limite connue ; aucun timestamp présenté comme précis, aucun découpage automatique.
- Aucune validation, publication, liaison `session_exercices`, séance, devoir ou élève créé. Aucun push, PR, migration, déploiement ou changement de secret.
- Reprise nécessaire : corriger et livrer sous autorisation distincte l'intégration Studio/Edge afin de garantir la réutilisation du même ensemble et le plafond de six, puis reprendre le préflight et A2 via l'interface. Ne pas relancer simplement le bouton actuel.
- Commit antérieur `bea631b2e0bb990db783895aec7e204b699d9bc2` conservé ; nouveau commit documentaire sans amend : `docs(studio): record eclipse multilevel draft review`.

---
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
