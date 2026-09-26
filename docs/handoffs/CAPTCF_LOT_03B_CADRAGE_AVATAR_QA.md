# CAPTCF — LOT 3B — Cadrage Avatar Q&A (élève allophone)

**Date :** 2026-09-24  
**Branche :** `codex-captcf-lot-00-protection-cartographie-20260917`  
**HEAD après 3A :** `b4dda50c` (`fix(ipe): require B2 for naturalisation under 2026 IRN rules`)  
**Nature :** diagnostic + cadrage uniquement — **pas de service payant**, **pas de nouvelle table distante**, **pas de déploiement**, **pas de code avatar** (aucun composant Q&A réutilisable trouvé).

---

## 1. Finalité MVP

Élève allophone clique un avatar → pose une question simple (exercice, consigne, correction, notion FR, parcours TCF, mot/phrase) → réponses **FR adaptées au niveau**, courtes.

**Interdits produit :** inventer règles admin, résultats TCF officiels, progression d’un autre élève, décisions admin non sourcées.

**MVP UI :** texte + avatar simple (image/statique) ; contexte page/exercice ; boutons *Reformuler* / *Exemple* / *Expliquer dans ma langue* ; avertissement si incertitude. **Pas** de voix/vidéo en MVP.

---

## 2. Inventaire bref (existant)

| Élément | État |
|---|---|
| Chat / avatar pédagogique Q&A | **Absent** — `Avatar` UI = Radix (initiales), pas d’assistant |
| Providers IA | `supabase/functions/_shared/ai-client.ts` : Lovable gateway (`LOVABLE_API_KEY`) → Gemini direct (`GEMINI_API_KEY`) |
| Consentement IA | `ai_consent` + `useAIConsent` / `AIConsentRequiredRoute` / `checkConsent` + `logAICall` |
| Lexique proche Q&A | Edge `get-word-definition` (mot → définition/traduction, cache vocab) |
| Génération / correction | `tcf-generate-exercise`, `tcf-evaluate-answer`, `curriculum-adapt`, etc. (formateur / évaluation — **pas** chat élève) |
| Contenu pédagogique | curriculum v2 séances, référentiels `_shared/referential/`, system-prompt TCF |
| Tables conversations élève | **Aucune** dédiée assistant avatar |

**Infra réutilisable :** oui pour **backend** (ai-client, consent, journalisation AI) et **lexique** (`get-word-definition`). Non pour UI chat avatar.

---

## 3. Chemin minimal MVP sans budget initial

1. Prototype **100 % local** (mock réponses + FAQ curriculum) — 0 clé API, 0 données réelles.  
2. Si budget minimal ensuite : **une** Edge Function texte courte, contexte page/exercice seulement, base doc CapTCF versionnée (pas d’apprentissage depuis conversations).  
3. Voix / avatar animé = lots ultérieurs.

---

## 4. Architecture protection données

| Zone | Règle |
|---|---|
| Clés API | Uniquement secrets Edge ; jamais client |
| Conversations | Pseudonymisation ; pas de PII dans prompts ; rétention configurable (ex. 30 j) |
| Docs péda | Corpus contrôlé CapTCF (curriculum + FAQ validée) — **pas** fine-tune sur chats |
| Péda vs admin | Allowlist intents ; refus si question admin/résultats officiels / autre élève |
| Consent | Réutiliser `has_ai_consent` avant tout appel modèle |
| Journal | Minimal : timestamp, intent class, modèle, tokens — **pas** le texte brut par défaut (ou hash) |

---

## 5. Limites produit (à afficher)

- Pas de diagnostic officiel TCF / FEI  
- Pas de modification de résultats / scores  
- Pas d’accès données autre élève  
- Pas de conseil admin non sourcé (préfecture, délais, éligibilité)  
- Journalisation minimale + rétention configurable  

---

## 6. Comparaison 3 options

| Option | Coût | Temps | Dépendances | Verdict |
|---|---|---|---|---|
| **A. Local / gratuit prototype** | 0 € | 0,5–1 j | UI React + FAQ JSON | **Départ recommandé** |
| **B. API texte économique MVP** | faible (Gemini Flash / gateway existant) | 2–4 j | Edge + consent + corpus | Phase 2 après A validé |
| **C. Avatar voix / vidéo** | élevé (TTS/STT/vidéo) | weeks | STT/TTS existants partiels + UX | Après B, lot distinct |

---

## 7. Recommandation unique de départ

**Option A — assistant textuel mock local**, contextualisé à la page/exercice, corpus FAQ CapTCF statique, sans clé API ni données élèves. Valider l’UX allophone avant tout coût.

---

## 8. Découpage en 3 petits lots max

| Lot | Contenu | Budget |
|---|---|---|
| **3B-1** | Assistant textuel contextualisé (UI + FAQ + garde-fous) | 0 € d’abord (mock) ; API optionnelle ensuite |
| **3B-2** | Voix (TTS réponses + éventuellement STT question) | API TTS/STT |
| **3B-3** | Avatar animé / vidéo | Asset + sync labiale éventuelle |

---

## 9. Décision code ce lot

Aucun composant Q&A existant → **doc seulement**, pas de prototype (évite faux départ payant / dette UI).

---

## 10. Prochaine autorisation réellement nécessaire

Pour **3B-1 mock local** : aucune (code local + commit).  
Pour brancher l’API (3B-1 phase B) : autorisation **clés / coût** + revue consent RGPD.  
Pour tables conversations distantes : autorisation **migration** explicite.
