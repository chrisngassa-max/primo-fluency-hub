# Lot 0 - Etat de validation

## Perimetre implemente

- Migration d'automatisation rendue rejouable.
- Acquisition atomique des blocs avec reprise apres cinq minutes.
- Index uniques partiels pour les exercices collectifs et individuels.
- Affectation en direct idempotente, ciblee par `eleve_id`.
- Verification de la propriete des exercices avant affectation.
- RLS protegeant les associations et le contenu individuel.
- Logique testable extraite des trois Edge Functions.
- Rollback de production non destructif.
- Runners SQL, concurrence et generation des types proteges contre la production.

## Etat de la migration distante

La commande en lecture seule `supabase migration list --linked` a confirme le
7 juin 2026 que `20260606020000` n'est pas enregistree comme appliquee sur le
projet lie `gudcenhmzlcvhgbgklzw`.

La migration initiale peut donc encore etre corrigee avant son premier
deploiement. Aucun deploiement n'a ete effectue pendant cette validation.

L'historique distant contient par ailleurs des migrations absentes du depot local.
Cet ecart doit etre traite avant tout `db push`.

## Preuves actuelles

- Vitest : execute, 3 fichiers et 13 tests reussis.
- Build de production : reussi.
- ESLint cible sur la logique et les tests du lot 0 : reussi.
- `git diff --check` : reussi pour le lot 0.
- Migration et assertions SQL : runner prepare, non execute faute de Supabase local.
- Concurrence sur la fonction reelle : runner prepare, non execute faute de
  Supabase local ou de staging autorise.
- Types Supabase : alignes manuellement sur la migration. Une regeneration
  officielle reste a faire depuis local ou staging apres application du schema.

Le build conserve deux avertissements preexistants : import mixte de `jspdf` et
taille du bundle principal superieure a 500 kB. Ils ne bloquent pas le lot 0.

Les anciennes sorties issues de scripts de copie ou de tests sur la production ne
sont pas considerees comme preuves de validation du code actuel.

## Politique d'environnement

- Les tests SQL et de concurrence sont interdits sur la production.
- Les scripts refusent explicitement le projet `gudcenhmzlcvhgbgklzw`.
- Un projet staging exige en plus une variable d'autorisation explicite.
- La generation distante des types suit la meme politique.
- Les refus de production ont ete verifies localement le 7 juin 2026.

## Rollback

Le fichier `supabase/rollback_20260606020000_session_automation.sql` fournit par
defaut un rollback de production non destructif :

- desactivation de la generation automatique ;
- retrait des droits d'execution des RPC ;
- conservation des donnees, des RLS securisees et des index partiels.

Le rollback destructif reste commente et reserve au developpement avant toute
utilisation reelle.

## Avant deploiement

1. Reconciler les migrations distantes absentes du depot.
2. Demarrer Supabase local ou relier un staging dedie.
3. Executer le test SQL et le test de concurrence.
4. Regenerer officiellement les types depuis ce schema valide.
5. Examiner le SQL de deploiement avant toute application en production.
