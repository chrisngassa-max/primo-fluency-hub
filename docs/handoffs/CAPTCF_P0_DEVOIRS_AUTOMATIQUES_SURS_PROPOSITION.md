# Lot P0 — devoirs automatiques sûrs : point d'arrêt avant migration

Date : 1er octobre 2026. Dépôt : `D:\SITES\CAPTCF`.
Branche conservée : `captcf-lot-02b-assistant-help-packs`.
Base de cette mission : `ea3d9a463c631ac9488335ed3fd80ce81dff2861`.
Commit code de test : `5b15e74d`.

## État réel

**Spécification rouge réalisée ; correction fonctionnelle non implémentée.** La protection serveur complète exige une migration. Arrêt selon l'instruction propriétaire : « Si une migration devient indispensable, arrêter avant de la créer et présenter la proposition. » Aucun fichier de migration, SQL de déploiement, RPC ou Edge nouvelle n'a été créé.

Le premier commit ne contient que les tests reproduisant les défauts. Il n'est pas un correctif prêt à publier et rend volontairement la suite ciblée rouge jusqu'à implémentation. Le deuxième commit est documentaire. Aucun autre travail local de la branche n'a été modifié.

## Tests rouges exécutés avant correction

Fichier : `src/test/auto-homework-p0-contract.test.tsx`.

Le véritable dialogue React et le véritable chemin manuel sont montés avec React Query. Les accès Supabase sont remplacés par un double en mémoire : aucune connexion, écriture ou génération distante. Les fixtures ne représentent aucun élève réel. Les écritures demandées et les créations réussies sont enregistrées séparément ; une panne est injectée à la deuxième création.

| Cas | Résultat avant correction | Observation |
|---|---|---|
| Ouvrir avec mode automatique mémorisé | Rouge | Écritures sur groupe, exercices et devoirs sans confirmation |
| Contenu vide `{}` | Rouge | Écritures acceptées |
| Liste d'items vide | Rouge | Écritures acceptées |
| Item sans options ni correction | Rouge | Écritures acceptées |
| Exercice source complet : prévisualiser support et question | Rouge | Seules des cartes génériques apparaissent ; contenu non repris |
| Prévisualiser puis confirmer explicitement l'envoi | Rouge | Le premier clic envoie sans étape de confirmation après vérification |
| Échec de la deuxième création | Rouge | Première création conservée ; pas d'attribution dans ce cas simulé |
| Chemin manuel avec exercice existant | Vert | Sélection puis clic explicite ; pas de création d'exercice |

Résultat : **8 tests, 7 rouges, 1 vert**. Le cas d'échec partiel est volontairement plus strict que la seule absence d'une attribution sans exercice : il exige aussi de ne pas laisser de création isolée. Le double ne prouve pas l'atomicité PostgreSQL ; un test local de transaction sera nécessaire après autorisation.

Commande : `node node_modules/vitest/vitest.mjs run src/test/auto-homework-p0-contract.test.tsx`.

Build : `node node_modules/vite/bin/vite.js build` **réussi**. Avertissements : données Browserslist anciennes, imports dynamiques également statiques et taille du bundle. Aucun changement opportuniste. Un avertissement React préexistant de bouton imbriqué dans un bouton apparaît pendant le test du dialogue.

## Pourquoi une Edge seule ne suffit pas

1. `AutoHomeworkPreviewDialog.tsx` insère les exercices successivement puis les devoirs dans une autre requête. L'échec de la deuxième requête ne peut pas annuler la première. Une suppression compensatoire depuis le navigateur ne garantit pas le retour arrière après perte réseau ou fermeture de page.
2. Les insertions directes du formateur sont autorisées par la politique `Formateurs manage devoirs` dans `20260317202908_adbd594f-a88c-486f-b4d7-9264f4677053.sql`. La politique vérifie l'identité, pas l'exécutabilité du contenu.
3. Les migrations inspectées n'offrent pas de RPC de création de ce lot exercices + devoirs avec validation structurelle et transaction commune. `assign_live_session_exercises` distribue des exercices existants à une séance ; ce n'est pas une transaction de création de devoirs personnalisés.
4. `mirror_devoir_to_assignment` réplique les devoirs dans `exercise_assignments`. La protection doit précéder cette attribution et participer à la même transaction.
5. Ajouter une validation dans une Edge protégerait ses seuls appelants : le chemin REST direct resterait accessible. Ajouter un validateur TypeScript partagé serait utile mais ne constituerait pas la garantie serveur demandée.

Conclusion fondée sur le dépôt local, sans introspection de la production. Un contrôle de contenu à la frontière base et une opération atomique sont nécessaires pour la garantie complète. Référence consultée : [fonctions PostgreSQL Supabase](https://supabase.com/docs/guides/database/functions). Le chargelog Markdown n'a pas pu être lu par l'outil web (type de contenu non supporté) ; aucune nouvelle API Supabase n'a été implémentée.

## Proposition de migration locale unique — non créée

Périmètre proposé, à autoriser avant rédaction SQL :

### 1. Validation structurelle de l'exercice de devoir

- Validateur SQL interne, sans IA, sans jugement pédagogique ni calcul de quantité/durée.
- Objet JSON attendu ; titre, consigne, compétence et format reconnus. Rejeter les types invalides proprement plutôt que laisser une conversion provoquer une erreur opaque.
- Pour les formats interactifs, items non vides et complets selon le contrat réel du lecteur/correcteur : question, options et réponse valide pour QCM ; réponses admises pour vrai/faux ; structures spécifiques pour appariement, texte lacunaire et transformation.
- Vérifier les supports nécessaires CE/CO selon les champs réellement consommés par la passation. Ne pas accepter un champ dont le lecteur ne sait pas se servir.
- EE/EO : valider leur propre contrat de consigne, support/critères requis et zone de production ; ne pas imposer artificiellement un QCM. Format inconnu refusé sur ce chemin.
- Réutiliser les règles pertinentes de `exercise-validator.ts` et du correcteur pour définir les fixtures de parité ; ne pas importer le module de régénération IA dans le navigateur et ne jamais appeler sa fonction de régénération.

### 2. Garde-fou sur les écritures directes

- Vérifier les créations d'exercices destinés aux devoirs (`is_devoir`) et les attributions nouvelles/modifiées dans `devoirs`, avant le miroir d'attribution.
- Vérifier également une modification du contenu/format/support d'un exercice déjà attribué afin qu'un devoir valide ne devienne pas vide après l'envoi.
- Valider uniquement les opérations nouvelles ou les changements pédagogiques pertinents : pas de nettoyage rétroactif, pas d'interdiction de changer le statut d'un ancien devoir simplement parce que son contenu historique est incomplet.
- Préserver les brouillons incomplets non attribués de la banque ; ils ne doivent pas devenir distribuables pour autant.
- Verrouillage cohérent de l'exercice lors d'une attribution et d'une modification pour éviter « validé puis vidé avant attribution ». Test de concurrence local indispensable.
- Conserver la voie manuelle pour les exercices complets. Le rejet d'un exercice incomplet doit être compréhensible, quelle que soit la voie d'écriture autorisée.

### 3. RPC atomique pour ce dialogue uniquement

- Créer les exercices préparés et tous les devoirs dans une seule transaction ; une seule erreur annule l'ensemble, y compris les attributions du miroir.
- `auth.uid()` obligatoire, rôle formateur et propriété séance/groupe vérifiés côté serveur ; destinataires membres du groupe ; aucun `formateur_id` faisant autorité fourni par le client.
- Préférer `SECURITY INVOKER`, objets qualifiés et `search_path` fixe. Retirer EXECUTE à PUBLIC/anon et l'accorder strictement aux rôles nécessaires. Justifier toute exception avant implementation.
- Revalider chaque exercice serveur, la date et la correspondance séance/groupe/destinataires avant les insertions.
- Un identifiant de requête stable et une trace minimale de succès permettraient une reprise idempotente après réponse réseau perdue. Si cette trace nécessite une petite table dédiée, elle doit être incluse explicitement dans la même proposition de migration, sans réutiliser un historique métier incompatible.
- Pas de commande qui génère, confirme les faits d'une source ou appelle Gemini. Aucune modification des secrets ou des modes généraux de quantité.

### 4. Tests SQL locaux et retour arrière

- Refus anonyme, rôle inadéquat, groupe tiers, élève hors groupe, contenu invalide et tentative REST directe.
- Exercice complet accepté, voie manuelle valide préservée, erreur au milieu du lot : zéro création/attribution conservée, y compris miroir.
- Édition concurrente du contenu, requête répétée et perte de réponse : aucun devoir invalide ni doublon.
- Pas de modification des anciennes données lors de l'installation de la migration.
- Rollback SQL à préparer avec la migration, sans supprimer des devoirs existants. Retirer la protection serveur ferait perdre la garantie : l'interface automatique devrait alors rester désactivée, pas revenir à l'ancien envoi implicite.

## Corrections frontend prévues après décision

- Supprimer l'effet qui appelle l'envoi à l'ouverture et l'option permettant cette ouverture mutante ; ne pas réécrire les préférences distantes simplement en consultant/fermant.
- Afficher le contenu réellement préparé et les erreurs d'exécutabilité avant toute confirmation. Les objets `{}` actuellement fabriqués doivent rester non envoyables ; ne pas les remplacer silencieusement par des questions inventées ou une duplication maquillée en différenciation.
- Confirmation explicite du lot affiché, invalidée si contenu, sélection ou échéance changent ; blocage du double clic, de l'envoi pendant préparation et des réponses tardives d'une ancienne ouverture.
- Appeler la RPC atomique au lieu des écritures successives ; aucun fallback vers les insertions directes en cas d'absence/erreur de RPC.
- Préserver le chemin manuel existant et les réglages de quantité. Carnet et assistant hors périmètre.

## Décision attendue

Autoriser, ou non, la **création d'une unique migration locale avec son rollback et ses tests locaux**, pour ce garde-fou et cette transaction. L'autorisation distante resterait absente : aucun push, PR, déploiement, migration distante, mutation Supabase ou appel Gemini.

Tous les fichiers non suivis préexistants sont préservés. Aucun secret ou MP3 n'est inclus dans les deux commits. Aucun correctif fonctionnel n'est présenté comme terminé avant cette décision et le passage au vert des tests.
