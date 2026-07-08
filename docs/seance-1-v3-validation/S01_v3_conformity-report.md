# Rapport de Conformité — Séance S01 v3 (Pilote Refonte)

**Date** : 8 juillet 2026
**Statut global** : **GO**
**Dossier** : `docs/seance-1-v3-validation/` — dossier séparé, **`docs/seance-1-modele-validation/` non modifié**.
**Source pédagogique** : `docs/s01-v3-conception-pedagogique.md`.

---

## 1. Contrôles obligatoires

| Contrôle | Résultat |
|---|---|
| Déroulé formateur = 180 min | ✅ 180 min (10+20+50+60+30+10) |
| Dialogue CO cible 2 min 25 s – 2 min 35 s | ✅ 2 min 29 s (estimation fake-tts, écart -1 s) — **GO** |
| QCM TCF — aucune option inventée type "D. 40" | ✅ 10 questions vérifiées, toutes options réelles (contrôle automatisé : 0 occurrence de "40" isolé dans le PDF) |
| QCM civique — justification spécifique par question | ✅ 10 questions, justifications distinctes vérifiées (contrôle automatisé : 0 occurrence du texte générique "80h/25 séances" répété) |
| Support visuel DOCX — image réelle | ✅ `word/media/*.png` présent, `<w:drawing>` présent, pas de tableau hacké |
| PDF + DOCX présents | ✅ 18 fichiers (9 documents × 2 formats) |
| Charte graphique CapTCF | ✅ Rendu via les mêmes fonctions partagées que S01-S05 (`getHTMLHeader`, `wrapHTML`, `COLORS`) — aucune modification de charte |
| Supabase | ✅ Aucune écriture — lecture seule effectuée lors de la phase de conception |
| MP3 | ✅ Aucun généré — `duration_seconds` reste une estimation `fake-tts` |
| S02-S05 | ✅ Non touchées |

---

## 2. Comparaison S01 actuelle vs S01 v3

| Élément | S01 actuelle | S01 v3 |
|---|---|---|
| Questions sur le dialogue CO | 2 par niveau (8 total) | 20 questions, réparties par niveau |
| QCM TCF | 1 question (+ option "D. 40") | 10 questions, options réelles |
| QCM civique | 5 questions, justifications génériques (bug) | 10 questions, justifications spécifiques |
| Bloc grammaire dédié | Aucun | 9 exercices gradués A1→B2 |
| Expression orale | 1 consigne générique par niveau | 8 prompts gradés avec critères |
| Expression écrite | 1 tâche par niveau | 2 productions guidées + 1 autonome |
| Lexique | 10 mots, 0 exercice dédié | 10 mots + 3 exercices |
| Support visuel | 2 questions | 5 questions |
| Variantes A2/B1/B2 (Supabase) | 3 sur 4 : `rejected` | Recréées, format valide (à re-valider) |
| Durée dialogue | 267 mots (~2 min 14 s, NO-GO jamais corrigé) | 298 mots (~2 min 29 s, GO) |

---

## 3. Estimation réaliste de durée

| Phase | Cible | Estimation réaliste v3 |
|---|---:|---:|
| Rituel civique | 10 min | 10 min |
| Activation lexique | 20 min | 18-20 min |
| Support invariant CO/CE | 50 min | 45-50 min |
| Ateliers différenciés | 60 min | 55-60 min |
| Production EE/EO | 30 min | 28-32 min |
| Fixation | 10 min | 10 min |
| **Total** | **180 min** | **≈ 170-185 min** |

---

## 4. Points à relire humainement

1. Naturel de l'échange ajouté dans le dialogue (épellation du nom) et reformulation de l'exemple de "règle".
2. Les 3 variantes A2/B1/B2 recréées n'ont pas été re-testées par la chaîne de validation Supabase (aucune écriture effectuée, conformément à la consigne) — à faire avant réinsertion éventuelle en base.
3. Charge réelle des ateliers B1/B2 (estimation 55-60 min pour 4 groupes en parallèle) à confirmer en conditions réelles.
4. Variante A1 Supabase (`cv2:S01:variant:A1`) reste `needs_review` — proposé de la corriger plutôt que la remplacer.
5. Durée audio : estimation `fake-tts` uniquement — à reconfirmer une fois une voix de synthèse réelle générée (aucun MP3 créé à ce stade).
6. Vérifier que le QCM TCF et le QCM civique ne recoupent pas de contenu utilisé dans les évaluations E1/E2.

---

## 5. Fichiers générés

18 fichiers (PDF + DOCX) dans `docs/seance-1-v3-validation/` : déroulé formateur, fiche apprenant dense, dialogue + 20 questions, QCM TCF (10 questions), QCM civique (10 questions), corrigé formateur, lexique + 3 exercices, support visuel (5 questions), document transformé — plus `index.html` et ce rapport.
