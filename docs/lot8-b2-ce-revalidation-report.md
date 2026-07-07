# Lot 8 B2 CE — rapport de revalidation

**Généré :** 2026-07-07T23:38:33.607Z
**Commit :** aad5f46
**Profil :** generated_strict
**Manifest source :** C:\Users\Sofiane\Projects\primo-fluency-hub\scripts\backups\lot8-b2-ce-dry-run-2026-07-07T23-31-48\lot8-b2-ce-dry-run-2026-07-07T23-31-48.json
**Manifest corrigé :** C:\Users\Sofiane\Projects\primo-fluency-hub\scripts\backups\lot8-b2-ce-revalidated-2026-07-07T23-38-33\lot8-b2-ce-revalidated-2026-07-07T23-38-33.json
**Écritures DB :** 0

## Corrections appliquées

- **sf-p0:B2:CE:005** : consigne
  - avant : « Lisez le document et complétez la lacune avec un mot ou groupe de mots du texte. » (16 mots)
  - après : « Lisez le document et complétez la lacune. » (7 mots)

## Résumé

| Métrique | Valeur |
|----------|--------|
| planned | 5 |
| validated_auto | 5 |
| needs_review | 0 |
| rejected | 0 |
| all checks OK | true |

## Détail par exercice

### ✅ sf-p0:B2:CE:001 — Courrier préfectoral : comprendre la convocation

- **status** : validated_auto
- **format** : qcm | **theme** : prefecture
- **consigne** (8 mots) : Lisez le courrier et répondez à la question.
- **texte** : 168 mots
- **hasUsableContent** : true
- **checks** : {"hasUsableContent":true,"notRejected":true,"noForbiddenCodes":true,"textWordCountOk":true,"themePresent":true,"metadataCodeOk":true,"allOk":true}
- **issues** : aucune

### ✅ sf-p0:B2:CE:002 — Article presse — laïcité et école publique

- **status** : validated_auto
- **format** : qcm | **theme** : vie_citoyenne
- **consigne** (7 mots) : Lisez l'article et répondez à la question.
- **texte** : 164 mots
- **hasUsableContent** : true
- **checks** : {"hasUsableContent":true,"notRejected":true,"noForbiddenCodes":true,"textWordCountOk":true,"themePresent":true,"metadataCodeOk":true,"allOk":true}
- **issues** : aucune

### ✅ sf-p0:B2:CE:003 — Offre d'emploi — comprendre les conditions

- **status** : validated_auto
- **format** : qcm | **theme** : travail
- **consigne** (7 mots) : Lisez l'annonce et répondez à la question.
- **texte** : 161 mots
- **hasUsableContent** : true
- **checks** : {"hasUsableContent":true,"notRejected":true,"noForbiddenCodes":true,"textWordCountOk":true,"themePresent":true,"metadataCodeOk":true,"allOk":true}
- **issues** : aucune

### ✅ sf-p0:B2:CE:004 — Notice locative — droits du locataire

- **status** : validated_auto
- **format** : vrai_faux | **theme** : logement
- **consigne** (11 mots) : Lisez le texte et indiquez si l'affirmation est vraie ou fausse.
- **texte** : 167 mots
- **hasUsableContent** : true
- **checks** : {"hasUsableContent":true,"notRejected":true,"noForbiddenCodes":true,"textWordCountOk":true,"themePresent":true,"metadataCodeOk":true,"allOk":true}
- **issues** : aucune

### ✅ sf-p0:B2:CE:005 — Formulaire CAF — compléter une information

- **status** : validated_auto
- **format** : texte_lacunaire | **theme** : prefecture
- **consigne** (7 mots) : Lisez le document et complétez la lacune.
- **texte** : 153 mots
- **hasUsableContent** : true
- **checks** : {"hasUsableContent":true,"notRejected":true,"noForbiddenCodes":true,"textWordCountOk":true,"themePresent":true,"metadataCodeOk":true,"allOk":true}
- **issues** : aucune

## Commandes

```bash
node --import tsx scripts/revalidate-lot8-b2-ce.mjs
node --import tsx scripts/apply-lot8-b2-ce.mjs --manifest "C:\Users\Sofiane\Projects\primo-fluency-hub\scripts\backups\lot8-b2-ce-revalidated-2026-07-07T23-38-33\lot8-b2-ce-revalidated-2026-07-07T23-38-33.json"
npm test -- scripts/lib/lot8-b2-ce-spec.test.mjs
```

---
_Rapport généré par scripts/revalidate-lot8-b2-ce.mjs — 0 écriture Supabase._