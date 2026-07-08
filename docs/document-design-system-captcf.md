# Guide du Design System Documentaire — CapTCF

**Version 1.0 — 8 juillet 2026**  
**Statut : Spécification visuelle de référence**  
**Périmètre : Fiches et supports d'animation imprimables (Word/PDF) et numériques (HTML)**  

---

## 1. Introduction et Philosophie

Le projet **CapTCF** produit des ressources pédagogiques pour un public adulte de primo-arrivants préparant le TCF et l'examen civique. Notre design system documentaire repose sur quatre piliers fondamentaux :
1. **Sobriété et Respect (Public Adulte)** : Pas de graphismes infantiles, pas de mascottes ludiques déplacées. Le design doit être épuré, digne et académique/professionnel.
2. **Faible Consommation d'Encre (Print-Friendly)** : Les documents sont majoritairement imprimés par les centres de formation. Le taux de couverture d'encre doit être inférieur à **5%**. Aucun aplat de couleur grand format, pas de fonds perdus, des bordures fines, et un noir adouci pour le texte.
3. **Scannabilité (Trainer-Focused)** : Le formateur doit pouvoir balayer le document du regard en quelques secondes pendant une séance active de 3 heures. Les phases temporelles, niveaux visés et compétences clés doivent sauter aux yeux.
4. **Clarté Structurelle (Student-Focused)** : Des espaces d'écriture évidents (lignes pointillées claires), des contrastes élevés pour la lecture, et une structure récurrente d'une séance à l'autre pour créer des repères rassurants.

---

## 2. Socle Commun Visuel

Tous les documents pédagogiques CapTCF partagent les mêmes fondations géométriques, typographiques et structurelles.

### A. Format et Marges
- **Format** : A4 standard (210 x 297 mm).
- **Marges** : 15 mm sur les 4 côtés (haut, bas, gauche, droite). Ce compromis protège les zones d'impression des photocopieurs standard tout en optimisant la quantité de texte par page.

### B. Typographie Universelle
Afin de garantir un rendu strictement identique sous **Word** (génération XML), **PDF** (rendu via Chromium/Puppeteer) et **HTML** (application React), le système utilise uniquement des polices système standard et hautement lisibles :
- **Famille de police** : `system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif` (sans empattement, hautement lisible pour les apprenants en cours d'alphabétisation ou FLE).
- **Échelle de tailles et graisses** :
  - **Titre principal (Page)** : 22pt / 28px — Gras — Couleur Navy Blue (`#1e3a8a`)
  - **Titre de Section (H1)** : 14pt / 18px — Gras — Couleur Slate 800 (`#1e293b`)
  - **Sous-titre / Consigne (H2)** : 11pt / 15px — Gras — Couleur Slate 700 (`#334155`)
  - **Corps de texte / Questions** : 10.5pt / 14px — Régulier — Couleur Slate 800 (`#1e293b`)
  - **Notes / Métadonnées** : 9pt / 12px — Régulier — Couleur Slate 500 (`#64748b`)
  - **Hauteur de ligne (Line-height)** : `1.3` pour les textes formateurs (densité moyenne) et `1.5` pour les fiches apprenant (confort de lecture).

### C. Palette de Couleurs (Standard d'Impression)
Pour préserver les cartouches d'encre des centres de formation, les aplats de fond sont interdits. Les couleurs sont utilisées uniquement sur les lignes fines, les icônes vectorielles et les badges de métadonnées.

- **Couleurs Générales** :
  - **Fond de page** : Blanc Pur (`#ffffff`) — Aucun fond teinté global.
  - **Texte principal** : Slate 800 (`#1e293b`) — Moins agressif que le noir pur à l'écran, imprimé en noir haute densité sur papier.
  - **Lignes de séparation et grilles** : Slate 300 (`#cbd5e1`) — Épaisseur fixe de `0.75pt` ou `1px`.
  - **Gris de surbrillance (Corrigés)** : Slate 100 (`#f1f5f9`) — Utilisé uniquement pour les fonds d'encadrés de correction (max 10% de couverture).

- **Couleur d'Accent CapTCF** :
  - **Bleu Marine / Navy** (`#1e3a8a` / HSL 224, 64%, 33%) : Couleur institutionnelle présente sur tous les en-têtes communs.

---

### D. Structure de l'En-tête Commun
Chaque page (ou début de document d'une seule page) comporte un en-tête horizontal standardisé :

```text
+-------------------------------------------------------------------------+
|  CapTCF                                S01 | A2 | 180 min | CO/EO | APP |
|  [Titre du Document pédagogique]                                        |
+-------------------------------------------------------------------------+
```
- **Ligne supérieure** : 
  - À gauche : Texte `CapTCF` (Gras, Navy Blue, 12pt).
  - À droite : Une rangée de badges rectangulaires fins, séparés par des bordures légères :
    - `Séance` (ex: `S01`)
    - `Niveau` (ex: `A2` ou `A1-B2` pour le multi-niveau)
    - `Durée` (ex: `180 min` ou `N/A`)
    - `Compétence` (ex: `CO`, `CE`, `EO`, `EE`, `CIV`)
    - `Statut` (`FOR` pour Formateur, `APP` pour Apprenant, `COR` pour Corrigé)
- **Ligne inférieure** : Titre descriptif du document (ex: *Fiche Apprenant - Activités de Compréhension Écrite*) en 18pt Gras.
- **Séparateur** : Une ligne horizontale de `1.5pt` d'épaisseur en Navy Blue (`#1e3a8a`) pour sceller l'en-tête.

---

## 3. Nomenclature Stricte des Fichiers

Afin d'éviter toute confusion lors de la génération automatisée, du stockage ou de la consultation par le formateur, la nomenclature suivante est **obligatoire** pour tous les fichiers finaux générés (Word, PDF, HTML) :

```text
[Session]_[Statut]_[Type]_[Niveau]_[Nom-Ressource].[extension]
```

### A. Définition des Jetons (Tokens)
1. **`[Session]`** : Code de la séance sur 3 caractères (`S01` à `S37`), ou code de l'évaluation (`E1` à `E4`).
2. **`[Statut]`** : Cible du document :
   - `FOR` : Formateur (guide, déroulé, règles)
   - `APP` : Apprenant (fiches d'exercices, devoirs)
   - `COR` : Corrigé (destiné au formateur ou à l'auto-correction)
3. **`[Type]`** : Code du type de document sur 2 caractères :
   - `FI` : Fiche d'activité globale
   - `CO` : Compréhension Orale / Dialogue
   - `TR` : Transcription textuelle d'un audio
   - `CE` : Compréhension Écrite
   - `EO` : Expression Orale
   - `EE` : Expression Écrite
   - `GR` : Grammaire / Structures
   - `LX` : Lexique / Vocabulaire
   - `QC` : QCM Civique
   - `DV` : Devoir / Prolongement
   - `SV` : Support Visuel
   - `DG` : Diagnostic / Évaluation
4. **`[Niveau]`** : Niveau CECRL visé par le document :
   - `A1`, `A2`, `B1`, `B2`
   - `ALL` : Si le document couvre tous les niveaux (ex: Lexique global, Fiche formateur).
5. **`[Nom-Ressource]`** : Description succincte en kebab-case, maximum 3 mots (ex: `deroule-180min`, `fiche-reponses`, `dialogue-awa-rossi`).
6. **`[extension]`** : `.docx`, `.pdf` ou `.html`.

### B. Exemples Concrets
- `S01_FOR_FI_ALL_deroule-180min.pdf` (Fiche formateur de la séance 1, multi-niveaux)
- `S01_APP_CO_A2_exercices-comprehension.pdf` (Fiche apprenant A2 pour l'activité CO de la S01)
- `S01_COR_QC_ALL_corrige-civique.docx` (Version Word du corrigé du QCM civique de la séance 1)
- `S01_APP_LX_ALL_lexique-seance.pdf` (Lexique imprimable de la séance 1 pour tous les niveaux)
- `E1_APP_DG_ALL_evaluation-intermediaire.pdf` (Cahier apprenant pour l'évaluation intermédiaire E1)

---

## 4. Système d'Icônes Vectorielles (SVG Sobres)

Conformément aux consignes de sobriété, aucun émoji n'est utilisé dans la mise en page principale des fiches officielles. Le système s'appuie sur des icônes SVG en tracé linéaire fin (stroke de `1.5px` ou `2px`), de couleur unie (la couleur secondaire du type de document).

Voici la spécification technique des tracés de référence pour les icônes clés du Design System :

### 1. Formateur / Fiche Guide (`#065f46` - Book Open)
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
</svg>
```

### 2. Apprenant / Activité (`#2563eb` - Pencil/Edit)
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 20h9"/>
  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
</svg>
```

### 3. Compréhension Orale / Dialogue (`#6b21a8` - Headphones)
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b21a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/>
  <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3Z"/>
</svg>
```

### 4. QCM Civique / Citoyenneté (`#d97706` - Scale of Justice)
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="12" y1="2" x2="12" y2="22"/>
  <line x1="5" y1="7" x2="19" y2="7"/>
  <path d="M5 7c0 5 2.5 7 5 7s5-2 5-7"/>
  <path d="M14 7c0 5 2.5 7 5 7s5-2 5-7"/>
  <path d="M9 22h6"/>
</svg>
```

### 5. Corrigé / Validation (`#991b1b` - Shield Check)
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#991b1b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  <path d="m9 11 2 2 4-4"/>
</svg>
```

---

## 5. Spécifications Détaillées des 15 Types de Documents

Pour chaque type de document pédagogique nécessaire à la formation CapTCF, nous définissons ses contraintes techniques et pédagogiques strictes.

### 1. Dialogue CO (Support de script audio)
*   **Description** : Retranscription textuelle de la situation audio de la séance pour le travail de décodage.
*   **Couleur Secondaire** : Violet royal (`#6b21a8`) | **Icône** : Headphones
*   **Statut** : Apprenant (en phase de décodage) & Formateur (support d'accompagnement).
*   **Contraintes Temporelles** : Dialogue audio de **2 min 30 s** maximum. Lecture/écoute répétée en classe sur **50 minutes** (phase d'exploitation).
*   **Contraintes de Contenu** : Dialogue contenant au moins 2 personnages (ex: Mme Rossi et Awa Diallo). Rythme ralenti de 10% (speaking_rate 0.90 à 0.95). Invariants stricts (faits civiques, chiffres et dates conformes au brief de séance).
*   **Mise en page** : Police large (11pt / line-height 1.5). Noms des personnages alignés à gauche en gras. Filet vertical de couleur violette à gauche de chaque réplique pour guider les yeux des faibles lecteurs.

### 2. Transcription CO
*   **Description** : Document brut intégrant le texte intégral de l'audio avec annotations temporelles de pauses pour le formateur, ou version imprimée d'aide pour les apprenants en atelier.
*   **Couleur Secondaire** : Violet foncé (`#581c87`) | **Icône** : Text File
*   **Statut** : Principalement Formateur (Read-Only) et Apprenants A1 (Aides visuelles).
*   **Contraintes de Contenu** : Contient le script textuel exact, sans modification d'un seul mot par rapport à l'audio généré par le TTS.
*   **Mise en page** : Présentation linéaire compacte avec indication des pauses significatives (ex: `[Pause 500ms]`) pour le formateur.

### 3. Fiche Compréhension Orale (Questions de CO)
*   **Description** : Fiche de questions associées à l'écoute de l'audio invariant.
*   **Couleur Secondaire** : Bleu cobalt (`#2563eb`) | **Icône** : Activity/Pencil
*   **Statut** : Apprenant (Remplissable) | Formateur (Support de guidage).
*   **Contraintes de Questions** :
    *   **Niveau A1** : 2 questions (1 QCM simple à 3 options + 1 Vrai/Faux).
    *   **Niveau A2** : 2 questions (1 QCM à 3 options + 1 Réponse courte de repérage).
    *   **Niveau B1** : 2 questions complexes (Réponses rédigées courtes/moyennes).
    *   **Niveau B2** : 2 questions d'analyse fine (Réponses rédigées longues).
*   **Espaces de réponse** : 
    *   QCM / Vrai-faux : Cases à cocher alignées verticalement avec interligne de 15px.
    *   Réponses rédigées : Lignes pointillées (`............................................`) avec espacement vertical de **8mm** par ligne (2 lignes pour A2, 4 pour B1, 6 pour B2).
*   **Correction** : Correction collective menée par le formateur.

### 4. Fiche Compréhension Écrite (CE)
*   **Description** : Document d'évaluation de la lecture de textes courts (courriels, formulaires, affiches).
*   **Couleur Secondaire** : Cyan foncé (`#0369a1`) | **Icône** : FileText
*   **Statut** : Apprenant (Remplissable).
*   **Contraintes de Contenu** : Texte de **150 à 250 mots** maximum au niveau cible A2/B1.
*   **Contraintes de Questions** : 2 à 3 questions de compréhension (Repérage d'informations explicites pour A2 ; Analyse et déduction de l'implicite pour B1/B2).
*   **Espaces de réponse** : Lignes pointillées (3 lignes par question ouverte).
*   **Correction** : Clé de réponse univoque fournie dans le corrigé.

### 5. Fiche Expression Orale (EO)
*   **Description** : Cartes de rôles, situations de simulation de communication orale (ex: guichet de préfecture, dialogue de voisinage).
*   **Couleur Secondaire** : Turquoise (`#0f766e`) | **Icône** : MessageCircle
*   **Statut** : Apprenant (Support d'interaction) & Formateur (Évaluation formative).
*   **Contraintes Temporelles** : Passation individuelle ou en binôme de **2 à 5 minutes** par apprenant.
*   **Mise en page** : Cartes de rôles découpables (format A6) imprimées sur papier cartonné ou encadrées par une bordure pointillée noire de `1px` avec icône d'action claire.

### 6. Fiche Expression Écrite (EE)
*   **Description** : Consignes de production écrite (compléter un formulaire, écrire un mail de justification, raconter une démarche).
*   **Couleur Secondaire** : Bleu ardoise (`#0369a1`) | **Icône** : PenTool
*   **Statut** : Apprenant (Remplissable).
*   **Contraintes de Questions** : 1 tâche d'écriture guidée avec amorce de texte (A1/A2) ou 2 tâches progressives (B1/B2).
*   **Espaces de réponse** : Un grand cadre rectangulaire à bords fins (`#cbd5e1`), de hauteur variable selon le niveau :
    *   A1/A2 : 6 lignes pointillées intégrées dans le cadre.
    *   B1/B2 : 12 lignes pointillées intégrées dans le cadre (cible de 80 à 120 mots).
*   **Correction** : Grille de critères d'évaluation simplifiée (lexique, grammaire, adéquation communicative) fournie en note de bas de page.

### 7. Structures / Grammaire
*   **Description** : Fiche d'explication simplifiée et d'exercices d'application sur une structure grammaticale ou de conjugaison.
*   **Couleur Secondaire** : Émeraude (`#047857`) | **Icône** : Puzzle/Grid
*   **Statut** : Apprenant (Remplissable).
*   **Contraintes de Questions** : 3 à 5 exercices courts de type "trous à boucher" (cloze tests), substitution ou transformation de phrases.
*   **Espaces de réponse** : Mots à insérer directement sur de petites zones pointillées (`...........`) au sein de phrases existantes.
*   **Correction** : Autocorrection possible via affichage ou corrigé distribué en fin de phase de fixation.

### 8. Lexique
*   **Description** : Glossaire de la séance contenant les mots-clés invariants requis pour l'autonomie communicative et civique.
*   **Couleur Secondaire** : Slate Gray (`#475569`) | **Icône** : Alphabet/Glossary
*   **Statut** : Apprenant & Formateur (Outil de référence permanent).
*   **Contraintes de Contenu** : Limité strictement à **10 mots clés** par séance.
*   **Structure de Page** : Tableau à 3 colonnes fixes :
    1.  **Mot** (Slate 800, Gras, 11pt, bordure droite légère)
    2.  **Définition simple** (10pt, français simplifié sans jargon technique)
    3.  **Exemple en situation** (10pt, Italique, encadré par des guillemets français « ... »)
*   **Mise en page** : Espacement aéré (hauteur de ligne `1.4`). Pas de colonne de traduction (FLE pur).

### 9. QCM Civique
*   **Description** : Fiche d'évaluation des connaissances civiques et des mises en situation associées à la thématique de la séance.
*   **Couleur Secondaire** : Ambre (`#b45309`) | **Icône** : Scale/Justice
*   **Statut** : Apprenant (Remplissable) & Formateur (Preuve IPE Civique).
*   **Contraintes Temporelles** : 5 à 10 minutes d'auto-évaluation individuelle.
*   **Contraintes de Questions** :
    *   **Séance standard** : 5 questions à choix multiples (3 options par question, 1 seule réponse exacte).
    *   **Répartition** : 3 questions de pure connaissance répertoriée (CSP/CR/NAT) + 2 questions de mise en situation civique.
*   **Mise en page** : Cases à cocher standardisées de `16px` de côté. Espacement minimal de `10px` entre les options pour garantir la clarté de lecture sur papier.
*   **Mention Légale Obligatoire** : *"Simulation pédagogique CapTCF. Les questions présentées ne préjugent pas des questions officielles de l'examen d'État."* (En note de bas de page, 8pt Italique).

### 10. Fiche Formateur (Guide de déroulement)
*   **Description** : Feuille de route chronométrée indispensable à la gestion de la séance de 180 minutes.
*   **Couleur Secondaire** : Vert forêt (`#065f46`) | **Icône** : Guide/BookOpen
*   **Statut** : Formateur uniquement (Read-Only).
*   **Contraintes Temporelles** : Couvre **180 minutes** réelles, divisées en 6 phases clés :
    1.  Rituel civique (10 min)
    2.  Activation + Lexique (20 min)
    3.  Support Invariant CO/CE (50 min)
    4.  Ateliers différenciés (60 min)
    5.  Production EE/EO (30 min)
    6.  Fixation (10 min)
*   **Mise en page** : Structure en 2 colonnes asymétriques :
    *   **Colonne Gauche (35%)** : Chronométrage de la phase, objectifs opérationnels et matériel nécessaire.
    *   **Colonne Droite (65%)** : Consignes pas-à-pas à énoncer, scripts d'accompagnement, règles d'adaptation pédagogique (ex: *"Si le groupe confond droit et devoir..."*).

### 11. Fiche Apprenant (Cahier d'activités principal)
*   **Description** : Document central regroupant le parcours d'activités de l'élève pour la séance.
*   **Couleur Secondaire** : Bleu cobalt (`#2563eb`) | **Icône** : Pencil/Edit
*   **Statut** : Apprenant (Remplissable).
*   **Contraintes de Questions** : Regroupe les activités de CO, de lecture, et les tâches d'écriture dans une progression logique.
*   **Mise en page** : Très aérée. Utilisation de titres H1 et H2 clairs. Consignes isolées visuellement par une police légèrement plus grasse. Zones d'écriture larges (`8mm` d'interligne pointillé).

### 12. Corrigé Formateur (Fiche Réponses)
*   **Description** : Document récapitulatif des réponses attendues pour toutes les activités de la séance.
*   **Couleur Secondaire** : Rouge brique (`#991b1b`) | **Icône** : Checkmark/ShieldCheck
*   **Statut** : Formateur (Read-Only) / Apprenant (dans les cas d'auto-correction guidée).
*   **Contraintes de Contenu** : Contient les réponses exactes aux questions de CO/CE par niveau (A1, A2, B1, B2) ainsi que les clés du QCM civique.
*   **Mise en page** : Format ultra-compact pour tenir sur une seule page recto. Réponses correctes surlignées avec un fond Slate 100 (`#f1f5f9`) ou encadrées par une fine ligne rouge de `0.75pt`. Intègre des "Points de vigilance" pédagogiques pour aider le formateur à évaluer les réponses ouvertes complexes.

### 13. Devoir / Prolongement (Travail à la maison)
*   **Description** : Exercices courts à réaliser de manière autonome en dehors de la classe pour fixer les notions.
*   **Couleur Secondaire** : Indigo (`#4338ca`) | **Icône** : Home
*   **Statut** : Apprenant (Remplissable).
*   **Contraintes de Questions** : 1 à 2 tâches simples adaptées au niveau (A1 : association mot-image ; A2 : 5 phrases écrites ; B1/B2 : paragraphe d'argumentation).
*   **Espaces de réponse** : Cadre pointillé de 5 à 8 lignes pour la production écrite.

### 14. Support Visuel (Infographie / Illustration)
*   **Description** : Carte mentale, schéma, frise chronologique ou illustration de contexte (ex: les 5 thèmes civiques SVG de S01).
*   **Couleur Secondaire** : Teal (`#0f766e`) | **Icône** : Image/Landscape
*   **Statut** : Apprenant & Formateur (Support de projection ou d'affichage).
*   **Contraintes Techniques** : Pas de texte complexe intégré directement dans une image matricielle (PNG/JPEG) pour assurer l'accessibilité (lecteurs d'écran) et la traduction. Les graphiques ou cartes sont rendus en SVG déterministe ou superposés à du texte HTML dynamique.
*   **Mise en page** : Ratios standardisés de `16:9` (visualisation écran/vidéoprojecteur) ou `A4 Paysage` pour l'impression murale.

### 15. Diagnostic / Évaluation (E1 à E4)
*   **Description** : Cahiers d'évaluation officieux sommatifs à 50h, 77h, 100h et 120h.
*   **Couleur Secondaire** : Noir Charbon (`#0f172a`) | **Icône** : Award/Shield
*   **Statut** : Apprenant (Remplissable en autonomie, sans aide).
*   **Contraintes de Questions** : Format TCF IRN strict pour la langue (QCM à 4 options pour CO/CE, 3 tâches écrites pour EE) et examen civique officiel pour le civisme (40 questions, 45 min).
*   **Mise en page** : Strictement noir et blanc. Pas de couleurs secondaires pour s'approcher des conditions d'examen réel. Numérotation de page rigoureuse (`Page X sur Y`) pour éviter toute perte de feuille.

---

## 6. Guide d'Implémentation Technique (Word, PDF, HTML)

### A. Rendu HTML vers PDF
Le rendu PDF doit être exécuté par un moteur headless (Chromium) en utilisant les directives CSS de média paginé standard :
```css
@media print {
  body {
    background: #ffffff;
    color: #000000;
  }
  @page {
    size: A4 portrait;
    margin: 15mm;
  }
  .no-print {
    display: none !important;
  }
  .page-break {
    page-break-before: always;
    break-before: page;
  }
  /* Économie d'encre forcée */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
}
```

### B. Gabarits Word (DOCX)
Lors de l'implémentation de la génération Word (via des bibliothèques XML de type `docx-templates` ou `docx` en JS), le script serveur doit mapper les styles CSS du Design System vers les balises XML de formatage Word :
- Les titres H1 doivent être mappés sur le style Word `Heading 1` configuré en Arial/14pt/Bold/Slate 800.
- L'en-tête commun doit être injecté dans le composant `Header` natif de chaque section Word pour apparaître proprement sur chaque page imprimée.
- Les zones pointillées de réponse apprenant doivent être générées via des tabulations avec points de conduite Word pour un alignement parfait à l'impression, plutôt que des suites manuelles de points (qui débordent selon les polices).
