-- ============================================================
-- CapTCF — Lot 6 : socles légers session_documents pour S02-S05
-- Contenu minimal ("socle à compléter"), pas une réécriture
-- pédagogique. Réutilise les packs déjà générés (docs/seance-N-
-- modele-validation/, complétés depuis les packs locaux seance-N-v2
-- non commités) pour les liens PDF/DOCX. Statut a_completer partout.
-- Pas de ON CONFLICT : l'unicité (session_code, document_type, version)
-- du Lot 1 a été supprimée au Lot 2 (blocs vierges multiples autorisés).
-- Vérifié avant application : aucune ligne S02-S05 n'existe encore.
-- ============================================================

BEGIN;

INSERT INTO public.session_documents
  (session_code, document_type, title, level, competence, status, content_html, source_file_path, version, display_order, audience)
VALUES
(
  'S02',
  'fiche_formateur',
  $doc$Fiche Formateur — Déroulé Pédagogique — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2',
  ARRAY['CO','CE','EO','EE','CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_FOR_FI_ALL_deroule-180min',
  1,
  1,
  'formateur'
),
(
  'S02',
  'fiche_apprenant',
  $doc$Fiche Apprenant — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2',
  ARRAY['Structures','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_APP_CO_A2_fiche-activites',
  1,
  2,
  'apprenant'
),
(
  'S02',
  'dialogue_transcription',
  $doc$Dialogue / Transcription — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2',
  ARRAY['CO','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_APP_CO_ALL_dialogue-transcription',
  1,
  3,
  'apprenant'
),
(
  'S02',
  'qcm_tcf',
  $doc$Préparation TCF — S02 (État civil, mairie et symboles)$doc$,
  'A2 Cible',
  ARRAY['CO']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_APP_QC_ALL_qcm-tcf',
  1,
  4,
  'apprenant'
),
(
  'S02',
  'qcm_civique',
  $doc$Diagnostic Civique — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_APP_QC_ALL_qcm-civique',
  1,
  5,
  'apprenant'
),
(
  'S02',
  'lexique',
  $doc$Lexique — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2',
  ARRAY['LEXIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_APP_LX_ALL_lexique',
  1,
  6,
  'apprenant'
),
(
  'S02',
  'support_visuel',
  $doc$Support Visuel — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_APP_VI_ALL_support-visuel',
  1,
  7,
  'apprenant'
),
(
  'S02',
  'document_transforme',
  $doc$Document Transformé — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2 Invariant',
  ARRAY['LECTURE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_APP_CV_ALL_document-transforme',
  1,
  8,
  'apprenant'
),
(
  'S02',
  'corrige_formateur',
  $doc$Corrigé Formateur — S02 (État civil, mairie et symboles)$doc$,
  'A1-B2',
  ARRAY['CORRECTION']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S02 — État civil, mairie et symboles. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Principes et valeurs de la République.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-2-modele-validation/S02_COR_ALL_corrige-formateur',
  1,
  9,
  'formateur'
),
(
  'S03',
  'fiche_formateur',
  $doc$Fiche Formateur — Déroulé Pédagogique — S03 (Santé et urgences)$doc$,
  'A1-B2',
  ARRAY['CO','CE','EO','EE','CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_FOR_FI_ALL_deroule-180min',
  1,
  1,
  'formateur'
),
(
  'S03',
  'fiche_apprenant',
  $doc$Fiche Apprenant — S03 (Santé et urgences)$doc$,
  'A1-B2',
  ARRAY['Structures','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_APP_CO_A2_fiche-activites',
  1,
  2,
  'apprenant'
),
(
  'S03',
  'dialogue_transcription',
  $doc$Dialogue / Transcription — S03 (Santé et urgences)$doc$,
  'A1-B2',
  ARRAY['CO','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_APP_CO_ALL_dialogue-transcription',
  1,
  3,
  'apprenant'
),
(
  'S03',
  'qcm_tcf',
  $doc$Préparation TCF — S03 (Santé et urgences)$doc$,
  'A2 Cible',
  ARRAY['CO']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_APP_QC_ALL_qcm-tcf',
  1,
  4,
  'apprenant'
),
(
  'S03',
  'qcm_civique',
  $doc$Diagnostic Civique — S03 (Santé et urgences)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_APP_QC_ALL_qcm-civique',
  1,
  5,
  'apprenant'
),
(
  'S03',
  'lexique',
  $doc$Lexique — S03 (Santé et urgences)$doc$,
  'A1-B2',
  ARRAY['LEXIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_APP_LX_ALL_lexique',
  1,
  6,
  'apprenant'
),
(
  'S03',
  'support_visuel',
  $doc$Support Visuel — S03 (Santé et urgences)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_APP_VI_ALL_support-visuel',
  1,
  7,
  'apprenant'
),
(
  'S03',
  'document_transforme',
  $doc$Document Transformé — S03 (Santé et urgences)$doc$,
  'A1-B2 Invariant',
  ARRAY['LECTURE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_APP_CV_ALL_document-transforme',
  1,
  8,
  'apprenant'
),
(
  'S03',
  'corrige_formateur',
  $doc$Corrigé Formateur — S03 (Santé et urgences)$doc$,
  'A1-B2',
  ARRAY['CORRECTION']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S03 — Santé et urgences. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Vivre dans la société française.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-3-modele-validation/S03_COR_ALL_corrige-formateur',
  1,
  9,
  'formateur'
),
(
  'S04',
  'fiche_formateur',
  $doc$Fiche Formateur — Déroulé Pédagogique — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2',
  ARRAY['CO','CE','EO','EE','CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_FOR_FI_ALL_deroule-180min',
  1,
  1,
  'formateur'
),
(
  'S04',
  'fiche_apprenant',
  $doc$Fiche Apprenant — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2',
  ARRAY['Structures','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_APP_CO_A2_fiche-activites',
  1,
  2,
  'apprenant'
),
(
  'S04',
  'dialogue_transcription',
  $doc$Dialogue / Transcription — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2',
  ARRAY['CO','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_APP_CO_ALL_dialogue-transcription',
  1,
  3,
  'apprenant'
),
(
  'S04',
  'qcm_tcf',
  $doc$Préparation TCF — S04 (École, absence et autorité parentale)$doc$,
  'A2 Cible',
  ARRAY['CO']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_APP_QC_ALL_qcm-tcf',
  1,
  4,
  'apprenant'
),
(
  'S04',
  'qcm_civique',
  $doc$Diagnostic Civique — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_APP_QC_ALL_qcm-civique',
  1,
  5,
  'apprenant'
),
(
  'S04',
  'lexique',
  $doc$Lexique — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2',
  ARRAY['LEXIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_APP_LX_ALL_lexique',
  1,
  6,
  'apprenant'
),
(
  'S04',
  'support_visuel',
  $doc$Support Visuel — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_APP_VI_ALL_support-visuel',
  1,
  7,
  'apprenant'
),
(
  'S04',
  'document_transforme',
  $doc$Document Transformé — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2 Invariant',
  ARRAY['LECTURE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_APP_CV_ALL_document-transforme',
  1,
  8,
  'apprenant'
),
(
  'S04',
  'corrige_formateur',
  $doc$Corrigé Formateur — S04 (École, absence et autorité parentale)$doc$,
  'A1-B2',
  ARRAY['CORRECTION']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S04 — École, absence et autorité parentale. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CE, EE. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-4-modele-validation/S04_COR_ALL_corrige-formateur',
  1,
  9,
  'formateur'
),
(
  'S05',
  'fiche_formateur',
  $doc$Fiche Formateur — Déroulé Pédagogique — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2',
  ARRAY['CO','CE','EO','EE','CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_FOR_FI_ALL_deroule-180min',
  1,
  1,
  'formateur'
),
(
  'S05',
  'fiche_apprenant',
  $doc$Fiche Apprenant — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2',
  ARRAY['Structures','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_APP_CO_A2_fiche-activites',
  1,
  2,
  'apprenant'
),
(
  'S05',
  'dialogue_transcription',
  $doc$Dialogue / Transcription — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2',
  ARRAY['CO','CE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_APP_CO_ALL_dialogue-transcription',
  1,
  3,
  'apprenant'
),
(
  'S05',
  'qcm_tcf',
  $doc$Préparation TCF — S05 (Logement, voisinage et discrimination)$doc$,
  'A2 Cible',
  ARRAY['CO']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_APP_QC_ALL_qcm-tcf',
  1,
  4,
  'apprenant'
),
(
  'S05',
  'qcm_civique',
  $doc$Diagnostic Civique — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_APP_QC_ALL_qcm-civique',
  1,
  5,
  'apprenant'
),
(
  'S05',
  'lexique',
  $doc$Lexique — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2',
  ARRAY['LEXIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_APP_LX_ALL_lexique',
  1,
  6,
  'apprenant'
),
(
  'S05',
  'support_visuel',
  $doc$Support Visuel — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2',
  ARRAY['CIVIQUE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_APP_VI_ALL_support-visuel',
  1,
  7,
  'apprenant'
),
(
  'S05',
  'document_transforme',
  $doc$Document Transformé — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2 Invariant',
  ARRAY['LECTURE']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_APP_CV_ALL_document-transforme',
  1,
  8,
  'apprenant'
),
(
  'S05',
  'corrige_formateur',
  $doc$Corrigé Formateur — S05 (Logement, voisinage et discrimination)$doc$,
  'A1-B2',
  ARRAY['CORRECTION']::text[],
  'a_completer',
  $doc$<p><strong>Socle à compléter.</strong> Ce document est un point de départ minimal pour S05 — Logement, voisinage et discrimination. Le contenu détaillé n'a pas encore été rédigé dans l'éditeur.</p>
<p>Compétences visées : CO, EO. Thème civique : Droits et devoirs.</p>
<p>Un PDF/DOCX généré automatiquement est disponible en téléchargement ci-dessus (à vérifier et enrichir — il peut contenir les défauts connus des anciens packs : QCM insuffisants, justifications génériques, options faibles).</p>
<p><em>Complétez ce contenu directement ici pour remplacer progressivement le PDF/DOCX par une version éditable et à jour.</em></p>$doc$,
  'seance-5-modele-validation/S05_COR_ALL_corrige-formateur',
  1,
  9,
  'formateur'
);

COMMIT;
