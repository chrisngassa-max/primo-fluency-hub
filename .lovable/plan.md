

# AUDIT FINAL AVANT LANCEMENT — TCF Pro

## Plan d'audit

J'ai inspecte les routes, composants, pages, edge functions, schema de base de donnees, requetes reseau et contextes d'authentification. Voici l'audit complet.

---

## 1. VERDICT GLOBAL

**NO GO TEMPORAIRE**

L'application presente une architecture solide et une vision pedagogique coherente, mais elle souffre d'un **bug bloquant critique** : les tables `bilan_tests` et `bilan_test_results` n'existent pas en base de donnees, ce qui provoque des erreurs 404 sur chaque chargement du dashboard eleve et rend toute la boucle pedagogique du test de bilan inoperante. Le code reference ces tables via `as any` (type casting), masquant l'erreur au build mais la revelant a l'execution. Au-dela de ce blocage, plusieurs maillons de la boucle pedagogique sont codes mais non connectes (pas de table = pas de donnees = fonctionnalite morte). Le test d'entree utilise un jeu de 80 questions statiques en dur dans le code sans audio reel pour la section CO, ce qui reduit la credibilite pedagogique du positionnement initial. L'espace formateur est riche mais dense, avec un dashboard de plus de 1100 lignes qui concentre trop de responsabilites. L'application est prometteuse mais ne peut pas etre lancee en l'etat sans corriger la base de donnees et tester le flux de bout en bout.

---

## 2. RESUME EXECUTIF

**Forces majeures**
- Architecture technique solide (React Query, Supabase, TypeScript, Tailwind)
- Vision pedagogique claire et ambitieuse : boucle complete formateur → test → devoirs → bilan
- Espace formateur riche : pilote de seance, monitoring, rapports IA, pacing tracker
- Systeme de parametres configurables (seuils, delais, devoirs max)
- Gestion des roles et RLS coherente
- Edge functions IA bien structurees avec Lovable AI gateway

**Faiblesses majeures**
- Tables `bilan_tests` et `bilan_test_results` absentes en base → erreurs 404 en boucle
- Test d'entree sans audio reel (section CO = texte lu, pas de fichier audio)
- Page Progression eleve pointe vers `/eleve/test` (route inexistante, devrait etre `/eleve/test-entree`)
- Pas de table `session_reports` (referencee dans la memoire mais absente)
- Code TypeScript utilise massivement `as any` pour contourner les types manquants
- Dashboard formateur = fichier monolithique de 1100+ lignes
- Aucun mecanisme de relance pour les devoirs en retard
- Pas de page admin fonctionnelle (route `/admin` redirige vers rien)

**Ce qui parait credible** : l'espace formateur (pilotage, groupes, exercices, monitoring), le flux d'inscription/connexion, le systeme de devoirs et la logique de remediation.

**Ce qui fragilise** : l'absence des tables critiques, le test d'entree sans audio, le manque de tests end-to-end, les pages qui s'appuient sur des donnees inexistantes.

---

## 3. NOTES /10 PAR DIMENSION

| Dimension | Note | Justification |
|---|---|---|
| Clarte de l'offre | 7/10 | Landing page claire, TCF IRN bien identifie. Manque une page "Comment ca marche" |
| Parcours apprenant | 5/10 | Flux logique mais casse par tables manquantes. Test d'entree sans audio = non credible pour CO |
| Parcours formateur | 7/10 | Riche et complet, mais trop dense. Manque d'onboarding formateur |
| Boucle pedagogique | 4/10 | Conçue dans le code mais non fonctionnelle (tables absentes) |
| UX / ergonomie | 6/10 | Composants soignes, navigation claire. Quelques pages surchargees |
| Logique IA | 6/10 | Edge functions bien pensees mais impossible a tester sans les tables. Risque d'effet boite noire |
| Robustesse fonctionnelle | 3/10 | Bug bloquant base de donnees. Plusieurs routes mortes |
| Credibilite pedagogique | 5/10 | Bonnes intentions mais test CO sans audio = redhibitoire pour FLE |
| Professionnalisme global | 6/10 | Bonne base, mais details inacheves visibles |
| Preparation au lancement | 3/10 | Non publiable en l'etat |

---

## 4. TEST SPECIFIQUE DE LA BOUCLE PEDAGOGIQUE

**La boucle pedagogique existe-t-elle reellement ?** Partiellement. Le code decrit le flux complet mais deux maillons critiques sont morts.

**Est-elle complete ?**
```text
Formateur coche exercices (SessionPilot)     ✅ Fonctionne
  → Formateur valide bilan (SessionBilan)    ✅ Code present
    → IA genere test bilan                   ⚠️  Edge function existe, mais table bilan_tests absente
      → Formateur envoie test                ❌ Insert dans table inexistante → echec silencieux
        → Eleve voit test sur dashboard      ❌ Requete 404 (table absente)
          → Eleve passe test                 ❌ Page existe mais pas de donnees
            → IA genere devoirs cibles       ⚠️  Code present mais jamais atteint
              → Eleve fait devoirs           ✅ Fonctionne (si devoir existe)
                → IA genere bilan post-devoir ✅ Edge function + table existent
                  → Formateur voit bilan     ✅ Page SuiviDevoirs fonctionne
```

**Ou casse-t-elle ?** Au maillon 2-3-4 : generation du test de bilan → envoi → passation. Les tables `bilan_tests` et `bilan_test_results` n'ont jamais ete creees via migration.

**Est-elle comprehensible pour l'apprenant ?** Le flux serait comprehensible si fonctionnel. Les cartes sur le dashboard sont claires.

**Est-elle exploitable par le formateur ?** Partiellement : le suivi des devoirs fonctionne, le monitoring est riche, mais le bilan de test est inaccessible.

**Corrections prioritaires :**
1. Creer les tables `bilan_tests` et `bilan_test_results` avec RLS
2. Verifier que la page BilanTestPassation fonctionne end-to-end
3. Ajouter des fichiers audio au test d'entree ou retirer la section CO du test statique

---

## 5. TABLEAU COMPLET DES PROBLEMES

| Zone | Probleme | Type | Impact | Gravite | Correction | Priorite |
|---|---|---|---|---|---|---|
| Dashboard eleve | Erreur 404 sur `bilan_tests` a chaque chargement | Technique | Page casse silencieusement | **Bloquant** | Creer migration pour tables `bilan_tests` et `bilan_test_results` | P0 |
| SessionBilan formateur | Insert dans `bilan_tests` echoue | Technique | Test de bilan jamais cree | **Bloquant** | Meme correction que ci-dessus | P0 |
| BilanTestPassation eleve | Query `bilan_tests as any` → 404 | Technique | Page inaccessible | **Bloquant** | Meme correction | P0 |
| Test d'entree | Section CO sans audio reel (texte seulement) | Pedagogie | Non credible pour evaluation CO | **Critique** | Ajouter fichiers audio ou redesign sans CO audio | P1 |
| Progression eleve | Lien vers `/eleve/test` (route inexistante) | Technique | Lien mort | **Important** | Remplacer par `/eleve/test-entree` | P1 |
| SuiviDevoirsPage | FK reference `bilan_post_devoirs_eleve_id_fkey` dans select | Technique | Potentiel echec de jointure | **Important** | Verifier FK et ajuster le select | P1 |
| Auth signup | Role stocke dans `user_metadata` mais assigne comment dans `user_roles` ? | Logique metier | Nouvel inscrit sans role → acces bloque | **Critique** | Ajouter trigger `on_auth_user_created` pour inserer dans `user_roles` | P0 |
| Admin login | Route `/admin/login` existe mais pas de page admin apres connexion | Technique | Route morte | **Important** | Retirer route admin ou creer page | P2 |
| Formateur login | Pas d'inscription possible (message "Contactez votre admin") | UX | Formateur bloque si pas d'admin | **Important** | Clarifier le flux de creation de compte formateur | P2 |
| Dashboard formateur | Fichier monolithique 1100+ lignes | Technique | Maintenabilite | **Secondaire** | Decomposer en sous-composants | P3 |
| SessionPilot | Fichier 1373 lignes | Technique | Maintenabilite | **Secondaire** | Decomposer | P3 |
| Landing page | "Inscription gratuite · Aucune carte bancaire requise" mais pas de pricing | UX | Confusion sur le modele | **Secondaire** | Retirer mention ou ajouter page pricing | P3 |
| Toutes pages eleve | Pas de skeleton pour le layout global, juste contenu | UX | Flash de contenu vide | **Secondaire** | Ajouter skeletons layout | P3 |
| EleveOnboarding | Stocke dans localStorage = perdu au changement d'appareil | UX | Onboarding re-affiche | **Secondaire** | Stocker dans profil Supabase | P3 |
| Test entree | 80 questions hardcodees, non configurables par le formateur | Pedagogie | Pas d'adaptation possible | **Important** | Migrer vers table `test_entree_items` (existe deja) | P2 |
| Monitoring | 1000 lignes, multi-vues complexes | UX | Surcharge cognitive pour le formateur | **Secondaire** | Simplifier la vue par defaut | P3 |

---

## 6. MICRO-DEFAUTS ET DETAILS

- **Wording inconsistant** : "TCF Pro" vs "TCF IRN" utilises de maniere interchangeable. TCF Pro est le nom du produit, TCF IRN est l'examen → clarifier partout
- **Emoji dans le test d'entree** : les options utilisent des emoji (🕘, 💰, etc.) → inhabituel pour un test officiel, peut sembler peu serieux
- **Tutoiement/vouvoiement mixte** : le dashboard eleve vouvoie ("Votre espace"), l'onboarding tutoie → harmoniser
- **"Eleve" vs "Apprenant"** : le code utilise "eleve" partout, mais pour des adultes allophones, "apprenant" serait plus respectueux
- **Bouton "Commencer le test" sur le bilan de test** : le mot "test" peut angoisser un public allophone → preferer "Evaluation" ou "Bilan"
- **Page Profil eleve** : minimaliste (prenom + email + mot de passe). Manque : groupe, niveau, formateur
- **Footer "Mentions legales"** : present mais page Legal a verifier pour conformite RGPD reelle
- **Couleur du fond login eleve** (`bg-sky-50`) vs formateur (`bg-indigo-50`) : bonne differenciation mais pas de logo/branding
- **Pas de dark mode teste** : les classes dark: existent mais aucun toggle visible

---

## 7. TOP 15 DES CORRECTIONS AVANT LANCEMENT

1. **Creer migration tables `bilan_tests` et `bilan_test_results`** avec colonnes et RLS
2. **Verifier/creer le trigger d'assignation de role** apres inscription (user_metadata → user_roles)
3. **Corriger le lien mort** `/eleve/test` → `/eleve/test-entree` dans Progression.tsx
4. **Ajouter audio reel** au test d'entree CO ou adapter la section sans audio
5. **Tester le flux complet** : inscription → test entree → session → bilan → devoirs → bilan post-devoirs
6. **Retirer ou completer la route admin** (`/admin/login` → page vide)
7. **Harmoniser tutoiement/vouvoiement** dans l'espace eleve
8. **Remplacer les `as any`** par des types corrects une fois les tables creees
9. **Ajouter gestion des etats d'erreur** (actuellement les erreurs de requete sont silencieuses ou toast generiques)
10. **Ajouter un mecanisme de creation de compte formateur** (actuellement impossible sans admin)
11. **Verifier les FK** dans SuiviDevoirsPage (jointure `profiles!bilan_post_devoirs_eleve_id_fkey`)
12. **Ajouter indicateur de chargement global** sur les pages critiques
13. **Migrer le test d'entree** de donnees hardcodees vers la table `test_entree_items`
14. **Ajouter le footer** sur toutes les pages publiques
15. **Verifier la conformite RGPD** de la page Legal

---

## 8. QUICK WINS

- Corriger `/eleve/test` → `/eleve/test-entree` (1 ligne)
- Retirer la route `/admin/login` du menu si pas de page admin (3 lignes)
- Harmoniser "Votre espace" → "Ton espace" ou inversement (wording)
- Ajouter `aria-label` sur les boutons icone-only pour accessibilite
- Afficher le nom du groupe dans le profil eleve (1 query supplementaire)
- Ajouter une phrase d'aide sur la page vide "Aucun devoir" : "Les devoirs seront generes apres ta prochaine seance"

---

## 9. CE QU'IL FAUT SIMPLIFIER / RETIRER / FUSIONNER

**Supprimer** :
- Route `/admin/login` et page LoginAdmin (inutile sans espace admin)
- Emoji dans les options du test d'entree (pas credible pour un test officiel)

**Fusionner** :
- `BilanSeance` et `BilanTestPassation` partagent 80% de logique → extraire un composant commun `QuizPassation`
- `DevoirPassation` partage aussi la meme UI de quiz → meme composant

**Simplifier** :
- Dashboard formateur : extraire les onglets en sous-composants (`SessionTab`, `GroupesTab`, `AlertesTab`)
- SessionPilot : extraire l'editeur d'exercice en composant separe
- MonitoringPage : la vue Hub pourrait etre le dashboard par defaut, les vues detaillees en pages separees

**Mieux expliquer** :
- Le role de l'IA : ajouter un encart "Comment fonctionne l'IA ?" dans les parametres
- Les seuils de progression : afficher les seuils configures a cote des scores eleve

**Rendre plus visible** :
- Le lien "Rejoindre un groupe" sur le dashboard eleve (actuellement en bas de page)
- Le bouton "Suivi des devoirs" dans la sidebar (utilise la meme icone que "Exercices" → differencier)

---

## 10. PROMPTS D'IMPLEMENTATION

### PROMPT A — Correction base de donnees et boucle pedagogique

**Objectif** : Rendre la boucle pedagogique fonctionnelle de bout en bout.

**Probleme constate** : Les tables `bilan_tests` et `bilan_test_results` n'existent pas en base de donnees. Le code les reference via `as any`, causant des erreurs 404 sur le dashboard eleve et rendant impossible la generation, l'envoi et la passation des tests de bilan.

**Resultat attendu** :
- Tables `bilan_tests` et `bilan_test_results` creees avec les colonnes necessaires
- Politiques RLS correctes (eleves voient leurs resultats, formateurs voient ceux de leurs groupes)
- Le flux SessionBilan → generation test → envoi → passation eleve → devoirs auto fonctionne sans erreur
- Les types TypeScript sont corrects (plus de `as any` sur ces tables)

**Criteres d'acceptation** :
- Aucune erreur 404 sur le dashboard eleve
- Un formateur peut valider un bilan et envoyer un test
- Un eleve peut passer le test et voir ses resultats
- Les devoirs sont generes automatiquement apres le test

---

### PROMPT B — Assignation automatique des roles

**Objectif** : Garantir qu'un nouvel utilisateur inscrit obtient son role dans `user_roles`.

**Probleme constate** : L'inscription stocke le role dans `user_metadata` mais aucun trigger ou fonction ne l'insere dans `user_roles`. Un nouvel inscrit ne peut pas acceder a son espace.

**Resultat attendu** :
- Un trigger `on_auth_user_created` qui lit `raw_user_meta_data->role` et insere dans `user_roles`
- Si le role est `eleve`, creer aussi une entree dans `profiles` et `profils_eleves`
- L'utilisateur est redirige correctement apres sa premiere connexion

**Criteres d'acceptation** :
- Inscription eleve → connexion → acces direct au dashboard eleve
- Le role apparait dans `user_roles` immediatement apres creation du compte

---

### PROMPT C — Ergonomie et navigation

**Objectif** : Corriger les problemes de navigation et d'ergonomie fine.

**Probleme constate** : Lien mort `/eleve/test`, route admin fantome, icones identiques dans la sidebar, vouvoiement/tutoiement mixte, profil eleve incomplet.

**Resultat attendu** :
- Lien corrige vers `/eleve/test-entree`
- Route admin retiree ou remplacee par une page placeholder
- Icone "Suivi des devoirs" differenciee dans la sidebar (utiliser `ClipboardCheck` au lieu de `BookOpen`)
- Wording harmonise au tutoiement dans tout l'espace eleve
- Profil eleve enrichi : groupe, niveau, formateur

**Principes UX** : Coherence, simplicite, navigation sans impasse.

---

### PROMPT D — Logique IA et feedback pedagogique

**Objectif** : Rendre l'IA visible, utile et comprehensible.

**Probleme constate** : Les edge functions IA sont bien codees mais leur resultat n'est visible que si les tables existent. L'utilisateur ne sait pas ce que fait l'IA ni quand elle intervient.

**Resultat attendu** :
- Ajouter un indicateur visuel quand l'IA travaille (spinner + message explicatif)
- Afficher un encart "Genere par l'IA pedagogique" sur les devoirs auto-generes
- Ajouter une section "Comment fonctionne l'IA" dans la page Parametres
- Les feedbacks IA (bilan post-devoirs) sont affiches avec un format clair et un ton adapte

**Criteres d'acceptation** :
- L'utilisateur comprend quand et pourquoi l'IA intervient
- Les sorties IA sont lisibles et actionnables

---

### PROMPT E — Clarte de l'offre et onboarding

**Objectif** : Rendre l'application immediatement comprehensible pour un nouvel utilisateur.

**Probleme constate** : La landing page est correcte mais manque d'une section "Comment ca marche" en 3-4 etapes. L'onboarding eleve est basique et stocke en localStorage. Pas d'onboarding formateur.

**Resultat attendu** :
- Section "Comment ca marche" sur la landing page (4 etapes visuelles)
- Onboarding eleve persiste en base de donnees
- Onboarding formateur : 3 ecrans (creer un groupe, ajouter des eleves, lancer une seance)
- Retirer "Inscription gratuite · Aucune carte bancaire" si pas de pricing

**Criteres d'acceptation** :
- Un visiteur comprend le produit en moins de 10 secondes
- Un nouveau formateur sait quoi faire en 3 clics

---

### PROMPT F — Finitions pre-lancement

**Objectif** : Eliminer les details qui donnent une impression de produit inacheve.

**Probleme constate** : Emoji dans le test officiel, `as any` dans le code, etats d'erreur generiques, pas de page 404 personnalisee avec redirection, pas de gestion du mode hors-ligne.

**Resultat attendu** :
- Retirer les emoji des options du test d'entree
- Remplacer tous les `as any` sur les tables Supabase par des types corrects
- Page 404 avec bouton de retour contextuel (eleve → dashboard eleve, formateur → dashboard formateur)
- Messages d'erreur en français clair et non-technique
- Toast de confirmation sur chaque action importante

**Criteres d'acceptation** :
- Aucun `as any` dans les requetes Supabase
- Aucun message d'erreur en anglais visible par l'utilisateur
- Navigation sans impasse possible

