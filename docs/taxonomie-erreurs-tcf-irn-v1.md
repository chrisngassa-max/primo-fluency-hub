# CAP TCF — Taxonomie d'erreurs TCF IRN (v1)

**Projet Supabase** : `gudcenhmzlcvhgbgklzw`  
**Schéma** : `types_erreur`, `session_live_events`  
**Principe** : extension additive des 11 types existants → **16 types** linguistiques (plafond 18).  
**Conformité** : Sprint 0 RGPD livré (`daa4a38`) — pseudonymisation RapportsPage, `checkConsent` + `logAICall` + colonne `competence` dans `classifyAndEmitErrors`.

**Enjeu TCF IRN** : A2 pour la carte de résident, B1 pour la naturalisation. Les erreurs prioritaires sont celles qui font échouer ces seuils dans des situations administratives et quotidiennes.

---

## 0. Architecture anti-doublons

Une erreur linguistique = **un seul événement** `session_live_events`, attribué à la **compétence d'observation** (`competence` = `CO` | `CE` | `EE` | `EO` | `ST`).

Le pilier **Structures** n'est pas une compétence concurrente en double comptage : c'est une **vue de consolidation**. Tout événement dont le type appartient aux catégories Grammaire / Morphosyntaxe / Syntaxe (`GRAM_*`, `STRUCT_*`) remonte aussi dans les rapports Structures, quelle que soit la compétence d'origine.

| Règle | Détail |
|-------|--------|
| Totaux par pilier | Calculés sur la compétence d'**observation** uniquement |
| Vue Structures | Projection par `types_erreur.categorie` + présence de `ST` dans `competences[]` |
| Exemple | `GRAM_TEMPS` observé en EE → 1 événement `competence='EE'` ; visible en vue Structures, pas compté deux fois |
| Exercices Structures purs | `competence='ST'` (QCM grammaire, textes à trous) ; les exercices utilisent `Structures` dans `exercices.competence` |

**Implémentation v1** (migration `20260703100000_extend_types_erreur_taxonomy_v1.sql`) :

- Ajout de `ST` dans `competences[]` de `GRAM_ACCORD` et `GRAM_TEMPS`
- Autorisation de `ST` dans `session_live_events.competence` (CHECK étendu)
- Pas de colonne `niveau_st` : le recalibrage auto (`auto_recalibrage_niveau`) ignore `ST`

---

## 1. Taxonomie par pilier

### Pilier CO — Compréhension orale

| Code | Statut | Libellé formateur | Catégorie | Grav. | Besoin humain | Signal technique |
|------|--------|-------------------|-----------|-------|---------------|------------------|
| **CO_DISCRIMINATION** | ⭐ nouveau | Discrimination auditive | Phonétique | 2 | 0 | Distracteur phonologiquement proche + ratio replays audio > 2,5 |
| **INTERPRETATION** | existant | Contresens sur l'audio | Compréhension | 4 | 3 | Item global/intention faux, détail réussi |
| **LEX_CONFUSION** | existant | Lexique inconnu à l'oral | Lexique | 2 | 0 | Item faux + mot absent du carnet |
| **CONSIGNE_NC** | existant | Consigne audio non comprise | Méthodologie | 4 | 1 | Pattern de réponses incohérent avec la consigne |
| **COHERENCE_ADMIN** | existant | Incohérence formulaire | Pragmatique | 5 | 1 | Donnée incohérente dans un champ administratif |

**Sous-compétences** : globale (INTERPRETATION), détail (LEX_CONFUSION, CO_DISCRIMINATION), intention (INTERPRETATION), lexique admin (LEX_CONFUSION).

### Pilier CE — Compréhension écrite

| Code | Statut | Libellé formateur | Catégorie | Grav. | Besoin humain | Signal technique |
|------|--------|-------------------|-----------|-------|---------------|------------------|
| **METHODO_REPERAGE** | ⭐ nouveau | Lecture non stratégique | Méthodologie | 3 | 1 | Item repérage faux + temps/item > 3× médiane groupe |
| **INTERPRETATION** | existant | Contresens écrit | Compréhension | 4 | 3 | Inférence faux, repérage réussi |
| **LEX_CONFUSION** | existant | Vocabulaire en contexte | Lexique | 2 | 0 | Item faux ; densité clics dictionnaire (indicateur séparé) |
| **CONSIGNE_NC** | existant | Consigne écrite non comprise | Méthodologie | 4 | 1 | Pattern de réponse (ex. 1 réponse au lieu de 2) |
| **STRUCT_CONNECTEURS** | ⭐ nouveau | Connecteurs / marqueurs temporels | Syntaxe | 3 | 1 | Item repérage chronologie faux (projection CE) |
| **COHERENCE_ADMIN** | existant | Incohérence formulaire | Pragmatique | 5 | 1 | Validation champ déterministe |

**Sous-compétences** : repérage (METHODO_REPERAGE), inférence (INTERPRETATION), vocabulaire (LEX_CONFUSION), chronologie (STRUCT_CONNECTEURS), consigne (CONSIGNE_NC).

### Pilier EE — Expression écrite

| Code | Statut | Libellé formateur | Catégorie | Grav. | Besoin humain | Signal technique |
|------|--------|-------------------|-----------|-------|---------------|------------------|
| **PRODUCTION_COURTE** | existant | Production trop courte | Méthodologie | 4 | 1 | Comptage mots sur `reponses_eleve` (déterministe) |
| **REGISTRE** | existant | Registre inadapté | Sociolinguistique | 3 | 1 | Tu/vous, formules inadaptées |
| **GRAM_ACCORD** | existant (+ST) | Accords | Grammaire | 2 | 0 | Classification IA (EE) / item faux (trous ST) |
| **GRAM_TEMPS** | existant (+ST) | Temps verbaux | Grammaire | 3 | 1 | Idem |
| **COHERENCE_ADMIN** | existant | Incohérence formulaire | Pragmatique | 5 | 1 | Champ incohérent (éliminatoire en situation réelle) |
| **HORS_SUJET** | existant | Hors sujet | Méthodologie | 5 | 2 | Production ne répond pas à la situation |
| **JUSTIFICATION** | existant | Manque de justification | Argumentation | 3 | 2 | Affirmation sans argument (B1+) |
| **LEX_CONFUSION** | existant | Confusion lexicale | Lexique | 2 | 0 | Mot inadapté en production |
| **STRUCT_CONNECTEURS** | ⭐ nouveau | Connecteurs absents/erronés | Syntaxe | 3 | 1 | Classification EE (projection depuis ST) |
| **CONSIGNE_NC** | existant | Consigne non respectée | Méthodologie | 4 | 1 | Format ou tâche non respectée |

**Garde-fou produit** (hors `types_erreur`) : refus de soumission EE si nombre de mots < seuil consigne — compteur en direct, bouton grisé. `PRODUCTION_COURTE` reste pour cas limites et EO.

### Pilier EO — Expression orale

| Code | Statut | Libellé formateur | Catégorie | Grav. | Besoin humain | Signal technique |
|------|--------|-------------------|-----------|-------|---------------|------------------|
| **PHONO** | existant | Intelligibilité estimée | Phonétique | 2 | 0 | Proxy ASR : mots mal transcrits par `transcribe-audio` |
| **PRODUCTION_COURTE** | existant | Parole trop courte | Méthodologie | 4 | 1 | Durée audio vs durée attendue |
| **GRAM_TEMPS** | existant (+ST) | Temps à l'oral | Grammaire | 3 | 1 | Classification sur transcription |
| **REGISTRE** | existant | Registre oral | Sociolinguistique | 3 | 1 | Tutoiement / ton inadapté |
| **JUSTIFICATION** | existant | Manque de justification | Argumentation | 3 | 2 | Arguments absents à l'oral |
| **HORS_SUJET** | existant | Hors sujet | Méthodologie | 5 | 2 | Production hors situation |
| **CONSIGNE_NC** | existant | Consigne non respectée | Méthodologie | 4 | 1 | Tâche orale mal comprise |

### Pilier Structures — vue + exercices dédiés (`ST`)

| Code | Statut | Libellé formateur | Catégorie | Grav. | Besoin humain | Signal technique |
|------|--------|-------------------|-----------|-------|---------------|------------------|
| **STRUCT_CONJ** | ⭐ nouveau | Erreur de conjugaison | Grammaire | 3 | 1 | Item faux tagué conjugaison (déterministe) |
| **STRUCT_MORPHO** | ⭐ nouveau | Morphosyntaxe | Morphosyntaxe | 2 | 0 | Item faux tagué morphosyntaxe |
| **STRUCT_CONNECTEURS** | ⭐ nouveau | Connecteurs | Syntaxe | 3 | 1 | Item faux tagué connecteurs |
| **GRAM_ACCORD** | existant (+ST) | Accords | Grammaire | 2 | 0 | Direct en trous ST ; projection depuis EE |
| **GRAM_TEMPS** | existant (+ST) | Temps verbaux | Grammaire | 3 | 1 | Direct en trous ST ; projection depuis EE/EO |

**Priorisation conjugaison TCF IRN** : P0 présent + passé composé ; P1 imparfait, opposition PC/imparfait, futur ; P2 conditionnel (formules), plus-que-parfait ; hors scope = subjonctif, passé simple.

---

## 2. Matrice Type × Pilier × Priorité produit

Légende : ● = compétence d'observation, ○ = projection Structures.

| Type | CO | CE | EE | EO | ST | Priorité |
|------|:--:|:--:|:--:|:--:|:--:|----------|
| PRODUCTION_COURTE | | | ● | ● | | **P0** |
| REGISTRE | | | ● | ● | | **P0** |
| GRAM_TEMPS | | | ● | ● | ○/● | **P0** |
| STRUCT_CONJ | | | | | ● | **P0** |
| LEX_CONFUSION | ● | ● | ● | | | **P0** |
| INTERPRETATION | ● | ● | | | | **P0** |
| COHERENCE_ADMIN | ● | ● | ● | ● | | **P0** |
| CO_DISCRIMINATION | ● | | | | | **P1** |
| GRAM_ACCORD | | | ● | | ○/● | **P1** |
| CONSIGNE_NC | ● | ● | ● | ● | | **P1** |
| METHODO_REPERAGE | | ● | | | | **P1** |
| STRUCT_MORPHO | | | | | ● | **P1** |
| PHONO | | | | ● | | **P1** |
| STRUCT_CONNECTEURS | | ● | ● | | ● | **P1** |
| HORS_SUJET | | | ● | ● | | **P2** |
| JUSTIFICATION | | | ● | ● | | **P2** |

---

## 3. Indicateurs vocabulaire (hors `types_erreur`)

Ces indicateurs vivent dans le **catalogue d'indicateurs** du rapport stratégique (famille I-vocabulaire). Ils ne créent **aucune** ligne dans `types_erreur`.

| Code indicateur | Pilier de reporting | Définition | Seuil indicatif | Source données |
|-----------------|---------------------|------------|-----------------|----------------|
| **VOC_DENSITE_CLIC** | CE | Mots cliqués / 100 mots de texte | > 8/100 = texte au-dessus du niveau | `student_vocabulary.created_at` × fenêtre exercice |
| **VOC_FAUX_AMIS** | CO, CE, EE | Confusions sémantiques / faux-amis | — | Rattaché à `LEX_CONFUSION` en observation |
| **VOC_CHAMP_ADMIN** | CO + CE | % mots administratifs IRN (~200) rencontrés et réussis | — | Liste fermée + items |
| **VOC_REUTILISATION_EE** | EE | Mots du carnet réutilisés en production | — | Croisement carnet × `reponses_eleve` |
| **VOC_RETENTION_CARNET** | Transversal | `review_count ≥ 2` / mots `is_saved` | < 30 % = carnet peu actif | `student_vocabulary` → `generate-daily-homework` |

---

## 4. Signaux comportementaux (catégorie Comportement)

Les signaux comportementaux **ne sont pas** des types linguistiques. Ils utilisent `session_live_events.event_type` (déjà déclarés dans `liveEventEmitter.ts`), **sans** `type_erreur_id`.

| event_type | Détection | Usage |
|------------|-----------|-------|
| `clic_aleatoire_probable` | Suite de réponses < 3 s + score < 30 % | Tuile formateur live |
| `inactif` | Absence d'interaction prolongée | Désengagement |
| `rythme_anormal` | Temps/item > 3× médiane groupe | Vigilance, pas niveau |
| `aide_demandee` | Demande d'aide explicite | Intervention humaine |
| Abandon (à émettre) | `exercice_demarre` sans `exercice_termine` > 2× `duree_limite_secondes` | Différé |

**Règle absolue** : exclus du calcul des taux de maîtrise et du recalibrage de niveau. Famille conceptuelle `categorie='Comportement'` — **aucune ligne** `types_erreur` requise (vérifié : `liveEventEmitter.ts` n'associe pas de `typeErreurId`).

---

## 5. Mapping exact 11 existants + 5 nouveaux = 16

### Types existants (inchangés sauf `competences[]`)

| id | competences (après migration) | categorie | gravite | besoin_humain |
|----|----------------------------|-----------|---------|---------------|
| LEX_CONFUSION | CO, CE, EE | Lexique | 2 | 0 |
| CONSIGNE_NC | CO, CE, EE, EO | Méthodologie | 4 | 1 |
| GRAM_ACCORD | EE, **ST** | Grammaire | 2 | 0 |
| GRAM_TEMPS | EE, EO, **ST** | Grammaire | 3 | 1 |
| HORS_SUJET | EE, EO | Méthodologie | 5 | 2 |
| INTERPRETATION | CE, CO | Compréhension | 4 | 3 |
| JUSTIFICATION | EE, EO | Argumentation | 3 | 2 |
| PHONO | EO | Phonétique | 2 | 0 |
| PRODUCTION_COURTE | EE, EO | Méthodologie | 4 | 1 |
| REGISTRE | EE, EO | Sociolinguistique | 3 | 1 |
| COHERENCE_ADMIN | CO, CE, EE, EO | Pragmatique | 5 | 1 |

### Types nouveaux (INSERT migration)

| id | competences | categorie | gravite | besoin_humain |
|----|-------------|-----------|---------|---------------|
| CO_DISCRIMINATION | CO | Phonétique | 2 | 0 |
| METHODO_REPERAGE | CE | Méthodologie | 3 | 1 |
| STRUCT_CONJ | ST | Grammaire | 3 | 1 |
| STRUCT_MORPHO | ST | Morphosyntaxe | 2 | 0 |
| STRUCT_CONNECTEURS | ST, CE, EE | Syntaxe | 3 | 1 |

---

## 6. Top 10 ordre d'implémentation

1. **PRODUCTION_COURTE** — compteur mots EE + durée EO (déterministe)
2. **REGISTRE** — critère TCF explicite A2–B1
3. **GRAM_TEMPS** — discriminant A2→B1
4. **STRUCT_CONJ** — socle de GRAM_TEMPS en exercices Structures
5. **LEX_CONFUSION** — plafond CO/CE
6. **INTERPRETATION** — cœur compréhension
7. **COHERENCE_ADMIN** — gravité max, spécifique IRN
8. **CO_DISCRIMINATION** — plafond CO niveaux bas (signal replays en attendant taggage distracteurs)
9. **CONSIGNE_NC** — méthodologique transversal
10. **GRAM_ACCORD** — correction linguistique EE + trous ST

---

## 7. Notes RGPD

| Exigence | Statut / règle |
|----------|----------------|
| Sprint 0 conformité | **Fait** (`daa4a38`) : `checkConsent`, `logAICall`, pseudonymisation productions EE/EO dans `classifyAndEmitErrors` |
| Exports formateur | **Pseudonyme** uniquement (`Apprenant_A`, etc.) — jamais nom/prénom dans exports UI |
| Productions EE/EO vers IA | Pseudonymisation niveau B avant envoi ; masquage entités nommées (adresses, dates de naissance) |
| Indicateurs comportementaux | Pas de données linguistiques personnelles ; pas de impact sur profil de niveau |
| Extension classification (Sprint 3) | **Ne pas étendre** `classifyAndEmitErrors` à toute l'activité avant conformité complète du flux |

---

## 8. Prérequis Sprint 3 (hors scope v1 doc/migration)

| Prérequis | Description |
|-----------|-------------|
| Extension `classifyAndEmitErrors` | Toute activité (pas seulement devoirs liés à une séance) — après conformité IA |
| Taggage items à la génération | Type de question (globale/détail/repérage), notion grammaticale, paire phonologique |
| Capture temps par item | Pour `METHODO_REPERAGE`, `rythme_anormal` |
| Mise à jour prompt taxonomie | Passer de 11 à 16 types dans `TAXONOMIE_COURTE` |
| Labels UI formateur | Étendre `ERREUR_LABELS` (SuiviDirect, Bibliothèque interventions, bilans) |
| Émission événements comportementaux | Brancher détections sur `emitLiveEvent` |

---

## 9. Déploiement

Fichier : `supabase/migrations/20260703100000_extend_types_erreur_taxonomy_v1.sql`

```bash
# Local
supabase db push

# Ou via Dashboard Supabase → SQL → exécuter le fichier de migration
```

Après déploiement : régénérer les types si besoin (`supabase gen types typescript`). La colonne `session_live_events.competence` reste `string | null` — pas de changement d'enum Postgres requis côté `competence_type` (`Structures` ≠ `ST` en observation live).

---

*Document v1 — juillet 2026. Aligné sur l'audit taxonomique Claude + seed vérifié en base.*
