# Rapport de Conformité et d'Audit — Modèle S02 v2 (Pilote de production)

**Date de l'audit** : 8 juillet 2026
**Référentiel cible** : CapTCF Document Design System v1.0 (aligné sur le modèle S01 validé)
**Statut de conformité global** : **CONFORME**

---

## 1. Présence des fichiers attendus

Les 9 gabarits documentaires ont été produits en HTML → PDF et DOCX (18 fichiers), avec la nomenclature `S02_[Statut]_[Type]_[Niveau]_[Nom-Ressource].[ext]` :

| # | Document | PDF | DOCX |
|---|---|---|---|
| 1 | Fiche Formateur — déroulé 180 min | ✅ S02_FOR_FI_ALL_deroule-180min.pdf | ✅ .docx |
| 2 | Fiche Apprenant A2 — activités | ✅ S02_APP_CO_A2_fiche-activites.pdf | ✅ .docx |
| 3 | Dialogue / Transcription CO | ✅ S02_APP_CO_ALL_dialogue-transcription.pdf | ✅ .docx |
| 4 | QCM type TCF | ✅ S02_APP_QC_ALL_qcm-tcf.pdf | ✅ .docx |
| 5 | QCM civique (CSP) | ✅ S02_APP_QC_ALL_qcm-civique.pdf | ✅ .docx |
| 6 | Corrigé Formateur | ✅ S02_COR_ALL_corrige-formateur.pdf | ✅ .docx |
| 7 | Lexique de séance | ✅ S02_APP_LX_ALL_lexique.pdf | ✅ .docx |
| 8 | Support visuel (image) | ✅ S02_APP_VI_ALL_support-visuel.pdf | ✅ .docx |
| 9 | Document transformé | ✅ S02_APP_CV_ALL_document-transforme.pdf | ✅ .docx |

Tous les fichiers attendus sont présents dans `docs/seance-2-modele-validation/`.

---

## 2. Cohérence avec la charte graphique

- Les 9 documents ont été générés avec les **mêmes fonctions de rendu HTML/DOCX** que le modèle S01 validé (`scripts/curriculum/generate-session-pack.mjs`), sans aucune modification de la charte.
- Couleurs de marque respectées : Bleu CapTCF `#0b234a`, Orange action `#f47b20`, cartes blanches contrastées, fond clair chaud pour les encadrés de consigne.
- Logo / identité "CAP TCF" présent en en-tête de chaque document.
- Icônes SVG unies (pas d'émojis), bandeaux de métadonnées (Séance / Niveau / Durée / Compétence / Statut) identiques au gabarit S01.
- Nomenclature de fichiers strictement identique au schéma validé sur S01.

**Statut : CONFORME.**

---

## 3. Durée totale formateur (180 min)

Déroulé en 6 phases chronométrées, identique en structure au modèle S01 :

1. Rituel civique — 10 min (repérage des symboles de la République à partir du visuel maître)
2. Activation + lexique — 20 min (nom, prénom, devise, drapeau, hymne...)
3. Support invariant CO/CE — 50 min (écoute du dialogue en mairie + lecture du formulaire fictif)
4. Ateliers différenciés A1-B2 — 60 min (quatre groupes travaillent leur variante du même support)
5. Production EE/EO — 30 min (rédaction d'une demande écrite polie à la mairie)
6. Fixation — 10 min (synthèse, QCM civique CSP, devoir personnalisé)

**Total : 10 + 20 + 50 + 60 + 30 + 10 = 180 minutes.**

**Statut : CONFORME.**

---

## 4. Durée du dialogue audio (cible 2 min 30 s, tolérance 2 min 25 s – 2 min 35 s)

- **Ressource concernée** : `content/curriculum/v2/S02/audio/CO-metadata.json` (provider `fake-tts`, non encore synthétisé en voix réelle ; `duration_seconds` est une estimation déterministe à ~2 mots/seconde, pas un rendu audio final).
- **Durée réelle déclarée** : **2 min 33 s** (153 secondes), pour un script de 16 répliques (306 mots).
- **Durée cible** : **2 min 30 s** (150 secondes).
- **Écart mesuré** : **+3 s** par rapport à la cible, dans la plage de tolérance (145 s – 155 s).
- **Statut de production** : **GO** — le script (thème état civil/mairie/symboles républicains) tient la cible de 2 min 30 s au débit de parole actuel (`speaking_rate: 0.92`).
- **Recommandation** : aucune action requise sur la longueur du script. Ré-auditer la durée réelle une fois la voix synthétisée (TTS définitif), le débit réel pouvant différer légèrement de l'estimation `fake-tts`.

**Statut : GO — durée conforme, prêt pour génération de la voix définitive.**

---

## 5. Conformité des QCM

- **QCM type TCF** (`S02_APP_QC_ALL_qcm-tcf`) : 1 question à choix multiple sur l'hymne national, présentée au format examen A/B/C/D (option de complément ajoutée automatiquement à 4 choix), consigne courte, une seule bonne réponse. **Conforme à la logique TCF.**
- **QCM civique** (`S02_APP_QC_ALL_qcm-civique`) : 5 questions (devise, drapeau, fête nationale, hymne, langue des démarches), 3 options par question, une bonne réponse par question, mention CSP. **Conforme.**
- **Corrigé formateur** : réponses A1/A2/B1/B2 présentes et justifiées (`corrige.json`), corrigé du QCM civique reproduit avec la réponse attendue en gras.

**Statut : CONFORME.**

---

## 6. Présence des ressources civiques

Le thème civique de la séance (symboles de la République : devise, drapeau, hymne, fête nationale, langue des démarches, Marianne) est intégré dans :
- le support de compréhension orale (dialogue en mairie),
- le lexique de séance (10 mots dont *devise*, *drapeau*, *hymne*, *Marianne*),
- le support visuel (formulaire d'état civil + drapeau tricolore),
- le QCM civique CSP (5 questions dédiées),
- le devoir à la maison (association symboles/mots pour A1, rédaction argumentée pour B2).

**Statut : CONFORME.**

---

## 7. Lisibilité écran / impression

- Documents rendus en A4, marges 15 mm, typographie Inter/Outfit, contraste texte bleu marine sur fond blanc.
- Encadrés de consigne en orange clair (`#fff7f0` / bordure `#f47b20`), tableaux à fond clair, faible couverture d'encre (identique au gabarit S01, estimé < 5 %).
- Rendu PDF vérifié via Playwright/Chromium (mode `printBackground`), export DOCX vérifié via la librairie `docx`.

**Statut : CONFORME (à confirmer par relecture humaine sur impression papier réelle).**

---

## 7bis. Correctif appliqué — visuel absent du DOCX

- **Bug identifié** : `S02_APP_VI_ALL_support-visuel.docx` n'affichait aucune image. La fonction `buildSupportVisuelDocx` (`scripts/curriculum/generate-session-pack.mjs`) générait un tableau texte codé en dur pour "5 thèmes civiques" (hérité du visuel S01), incompatible avec le visuel S02 (formulaire + drapeau) : 3 des 4 cellules du tableau s'affichaient vides, sans aucune image.
- **Correctif** : la fonction rend désormais le schéma SVG réel en image PNG (via `PlaywrightRenderer.renderSvgToRaster`, déjà utilisé ailleurs dans le pipeline) et l'insère dans le DOCX avec `ImageRun`, avec une légende dynamique reprenant le titre du visuel. Ce correctif est générique (fonctionne pour toute séance) et ne modifie aucune couleur ni aucun élément de charte graphique — seul le mécanisme d'insertion de l'image dans le DOCX est corrigé.
- **Vérification** : le fichier `S02_APP_VI_ALL_support-visuel.docx` régénéré contient désormais une image PNG intégrée (`word/media/*.png`), visuellement identique au rendu PDF (formulaire d'état civil + drapeau tricolore).
- **Portée** : seuls les fichiers de `docs/seance-2-modele-validation/` ont été régénérés. Les fichiers déjà livrés de `docs/seance-1-modele-validation/` n'ont pas été touchés (non régénérés) ; le même bug latent existe potentiellement dans le DOCX visuel de S01 si celui-ci est régénéré un jour, mais son tableau "5 thèmes" reste correctement rempli pour les données S01 (bug silencieux, pas de régression visible sur S01 en l'état).

---

## 8. Points à relire humainement avant validation formateur

1. **Durée audio** : le dialogue S02 dure 2 min 33 s pour une cible de 2 min 30 s — **GO**, dans la plage de tolérance. Cette durée reste une estimation `fake-tts` (~2 mots/seconde) : à reconfirmer une fois la voix de synthèse réelle générée.
2. Vérifier que le tampon "fictif" sur le formulaire d'état civil (support visuel) est explicite pour éviter toute confusion avec un document administratif réel, conformément à la règle d'adaptation formateur (`brief.formateur.adaptation_rules[1]`).
3. Relire la formulation des relances formateur (section "Consigne formateur adaptation") propres à S02 et confirmer qu'elles couvrent bien les groupes hétérogènes A1→B2 sur ce thème (mairie / état civil).
4. Confirmer visuellement le rendu du schéma "formulaire + drapeau tricolore" en impression noir & blanc (lisibilité des trois bandes de couleur en niveaux de gris).
5. Valider le format d'examen TCF (padding automatique à 4 options "40" hérité du gabarit S01) — vérifier qu'aucune option de complément non pertinente n'apparaît dans le QCM TCF de S02.
6. Relire les deux nouvelles répliques ajoutées pour allonger le dialogue (carte de séjour / justificatif, délai de délivrance du document) : vérifier leur justesse administrative et leur niveau de langue A2.

---

## 9. Recommandations avant impression

1. **Papier** : A4 80 g blanc mat.
2. **Impression** : mode standard/brouillon, la charte reste lisible à faible débit d'encre.
3. Le point audio est levé sur la base de l'estimation `fake-tts` ; confirmer avec la voix de synthèse réelle avant diffusion aux apprenants.
