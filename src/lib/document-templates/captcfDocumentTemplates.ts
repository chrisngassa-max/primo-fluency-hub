import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  getCaptcfLevelProfile,
  getCaptcfLevelProfileSummary,
  resolveCaptcfDocumentLevel,
} from "@/lib/captcf-level-profiles";

export type CaptcfDocumentType =
  | "fiche_formateur"
  | "fiche_apprenant"
  | "dialogue_transcription"
  | "qcm_tcf"
  | "qcm_civique"
  | "corrige_formateur"
  | "lexique"
  | "document_image"
  | "document_transforme";

export type CaptcfExerciseLike = {
  id?: string;
  titre?: string;
  consigne?: string;
  competence?: string;
  niveau_vise?: string;
  format?: string;
  difficulte?: number;
  contenu?: any;
  theme?: string | null;
  created_at?: string;
};

export type CaptcfDocumentInput = {
  type: CaptcfDocumentType;
  title?: string;
  exercises: CaptcfExerciseLike[];
  level?: string | null;
  sessionLevel?: string | null;
  groupLevel?: string | null;
};

export const CAPTCF_DOCUMENT_TYPES: Array<{
  value: CaptcfDocumentType;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "fiche_formateur",
    label: "Fiche formateur",
    shortLabel: "Formateur",
    description: "Deroule, objectifs, timing et relances pedagogiques.",
  },
  {
    value: "fiche_apprenant",
    label: "Fiche apprenant",
    shortLabel: "Apprenant",
    description: "Support eleve lisible ecran et imprimable.",
  },
  {
    value: "dialogue_transcription",
    label: "Dialogue / transcription",
    shortLabel: "Dialogue",
    description: "Dialogue CO avec cadrage audio 2 min 25 a 2 min 35.",
  },
  {
    value: "qcm_tcf",
    label: "QCM type TCF",
    shortLabel: "QCM TCF",
    description: "Questions A/B/C/D au format proche epreuve.",
  },
  {
    value: "qcm_civique",
    label: "QCM civique",
    shortLabel: "Civique",
    description: "Diagnostic CSP et education civique.",
  },
  {
    value: "corrige_formateur",
    label: "Corrige formateur",
    shortLabel: "Corrige",
    description: "Reponses, justifications et points de vigilance.",
  },
  {
    value: "lexique",
    label: "Lexique",
    shortLabel: "Lexique",
    description: "Mots cles, definitions et exemples.",
  },
  {
    value: "document_image",
    label: "Document avec image",
    shortLabel: "Image",
    description: "Image, legende, source, consigne et questions.",
  },
  {
    value: "document_transforme",
    label: "Document transforme PDF/HTML",
    shortLabel: "Transforme",
    description: "Support externe remis dans la charte CapTCF.",
  },
];

const BRAND = {
  primary: "#0b234a",
  accent: "#f47b20",
  accentSoft: "#fff7f0",
  warm: "#fdfbf7",
  border: "#d8dee8",
  muted: "#64748b",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getItems(exercise: CaptcfExerciseLike) {
  const contenu = typeof exercise.contenu === "object" && exercise.contenu !== null ? exercise.contenu : {};
  return Array.isArray(contenu.items) ? contenu.items : [];
}

function getDocumentMeta(input: CaptcfDocumentInput) {
  const option = CAPTCF_DOCUMENT_TYPES.find((item) => item.value === input.type) ?? CAPTCF_DOCUMENT_TYPES[1];
  const first = input.exercises[0];
  const level = resolveCaptcfDocumentLevel({
    explicitLevel: input.level,
    exerciseLevel: first?.niveau_vise,
    sessionLevel: input.sessionLevel,
    groupLevel: input.groupLevel,
    fallback: "A2",
  });
  return {
    option,
    title: input.title?.trim() || option.label,
    level,
    profile: getCaptcfLevelProfile(level),
    competence: first?.competence || "TCF",
  };
}

function capLogo() {
  return `
    <span class="captcf-logo">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479L12 21l-6.825-4a12.083 12.083 0 01.665-6.479L12 14z"/></svg>
      <span>CAP <strong>TCF</strong></span>
    </span>
  `;
}

function consigne(title: string, text: string) {
  return `
    <section class="captcf-consigne">
      <div class="captcf-consigne-title">${escapeHtml(title)}</div>
      <p>${escapeHtml(text)}</p>
    </section>
  `;
}

function exerciseQuestions(exercise: CaptcfExerciseLike, withAnswers = false) {
  const items = getItems(exercise);
  if (!items.length) {
    return `<div class="captcf-answer-zone"></div>`;
  }

  return items
    .map((item: any, index: number) => {
      const options = Array.isArray(item.options) ? item.options : [];
      const answer = item.answer ?? item.reponse ?? item.correct_answer ?? "";
      return `
        <article class="captcf-question">
          <h3>Question ${index + 1}</h3>
          <p>${escapeHtml(item.question || item.enonce || item.prompt || "")}</p>
          ${
            options.length
              ? `<ol class="captcf-options" type="A">${options
                  .slice(0, 4)
                  .map((option: string) => `<li>${escapeHtml(option)}</li>`)
                  .join("")}</ol>`
              : `<div class="captcf-answer-zone"></div>`
          }
          ${withAnswers ? `<p class="captcf-answer"><strong>Reponse attendue :</strong> ${escapeHtml(answer || "A completer")}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function exerciseCard(exercise: CaptcfExerciseLike, index: number, withAnswers = false) {
  return `
    <section class="captcf-card">
      <div class="captcf-card-head">
        <h2>${index + 1}. ${escapeHtml(exercise.titre || "Exercice")}</h2>
        <span>${escapeHtml(exercise.competence || "TCF")} · Niveau ${escapeHtml(exercise.niveau_vise || "A2")}</span>
      </div>
      ${consigne("CONSIGNE", exercise.consigne || "Lisez le document et repondez aux questions.")}
      ${exerciseQuestions(exercise, withAnswers)}
    </section>
  `;
}

function buildTypeSpecificContent(input: CaptcfDocumentInput) {
  const exercises = input.exercises.length ? input.exercises : [{ titre: "Document CapTCF", niveau_vise: "A2", competence: "TCF" }];
  const first = exercises[0];
  const meta = getDocumentMeta(input);
  const profile = meta.profile;
  const levelBox = levelProfileBox(profile);

  switch (input.type) {
    case "fiche_formateur":
      return `
        ${consigne("GUIDE PEDAGOGIQUE", "Utilisez cette fiche pour piloter la seance, adapter les relances et garder le rythme.")}
        <section class="captcf-timeline">
          <div><strong>10 min</strong><span>Accueil, objectif, rituel civique.</span></div>
          <div><strong>20 min</strong><span>Activation du lexique et anticipation.</span></div>
          <div><strong>50 min</strong><span>Exploitation CO/CE : reperage, comprehension, correction.</span></div>
          <div><strong>60 min</strong><span>Ateliers differencies A1-A2-B1-B2.</span></div>
          <div><strong>30 min</strong><span>Production ecrite ou orale.</span></div>
          <div><strong>10 min</strong><span>Fixation, devoirs, trace de fin.</span></div>
        </section>
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, true)).join("")}
      `;
    case "dialogue_transcription":
      return `
        ${levelBox}
        ${consigne("CONTEXTE D'ECOUTE", `Niveau ${profile.level}. La duree audio cible est de 2 min 30. La plage acceptable est de 2 min 25 a 2 min 35. ${profile.dialogueRule}`)}
        <section class="captcf-card">
          <h2>${escapeHtml(first.titre || "Dialogue")}</h2>
          <p class="captcf-dialogue-line"><strong>Personne A :</strong> Bonjour, je viens pour une demarche administrative.</p>
          <p class="captcf-dialogue-line"><strong>Personne B :</strong> Tres bien. Je vais vous expliquer les etapes et les documents utiles.</p>
          <p class="captcf-note">Remplacez ce dialogue par la transcription finale validee.</p>
        </section>
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, false)).join("")}
      `;
    case "qcm_tcf":
      return `
        ${levelBox}
        ${consigne("CONSIGNE EXAMEN TCF", `Lisez ou ecoutez le document. Pour chaque question, cochez la bonne reponse. Cadrage ${profile.level} : ${profile.qcmRule}`)}
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, false)).join("")}
      `;
    case "qcm_civique":
      return `
        ${consigne("DIAGNOSTIC CIVIQUE", "Repondez aux questions. Les reponses seront corrigees collectivement avec le formateur.")}
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, false)).join("")}
      `;
    case "corrige_formateur":
      return `
        ${consigne("GUIDE DE CORRECTION", "Verifiez les reponses, puis utilisez les justifications pour expliquer les erreurs frequentes.")}
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, true)).join("")}
      `;
    case "lexique":
      return `
        ${consigne("GLOSSAIRE", "Lisez les mots, reformulez-les, puis reutilisez-les dans une phrase personnelle.")}
        <table class="captcf-table">
          <thead><tr><th>Mot</th><th>Definition simple</th><th>Exemple</th></tr></thead>
          <tbody>
            <tr><td>demarche</td><td>Action administrative a faire.</td><td>Je fais une demarche a la mairie.</td></tr>
            <tr><td>justificatif</td><td>Document qui prouve une information.</td><td>Je donne un justificatif de domicile.</td></tr>
            <tr><td>rendez-vous</td><td>Date et heure pour rencontrer quelqu'un.</td><td>J'ai rendez-vous mardi.</td></tr>
          </tbody>
        </table>
      `;
    case "document_image":
      return `
        ${consigne("A FAIRE", "Observez l'image, decrivez les informations importantes, puis repondez aux questions.")}
        <figure class="captcf-visual">
          <div class="captcf-image-placeholder">Image / schema / document visuel</div>
          <figcaption>Legende : precisez la source, les droits et le contexte d'utilisation.</figcaption>
        </figure>
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, false)).join("")}
      `;
    case "document_transforme":
      return `
        ${consigne("DOCUMENT TRANSFORME", "Le support source est reformate dans la charte CapTCF avant d'etre transforme en exercice.")}
        <section class="captcf-card">
          <h2>Support source reformate</h2>
          <p>${escapeHtml(first.consigne || "Collez ou importez un extrait PDF/HTML, puis reformatez-le ici.")}</p>
        </section>
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, false)).join("")}
      `;
    case "fiche_apprenant":
    default:
      return `
        ${consigne("CONSIGNE", "Realisez les activites dans l'ordre. Vous pouvez relire le document avant de repondre.")}
        ${exercises.map((exercise, index) => exerciseCard(exercise, index, false)).join("")}
      `;
  }
}

function levelProfileBox(profile: ReturnType<typeof getCaptcfLevelProfile>) {
  return `
    <section class="captcf-level-profile">
      <strong>${escapeHtml(profile.label)}</strong>
      <span>${escapeHtml(profile.questionStyle)}</span>
      <span>${escapeHtml(profile.supportLevel)}</span>
      <span>${escapeHtml(profile.expectedProduction)}</span>
    </section>
  `;
}

export const CAPTCF_DOCUMENT_CSS = `
  .captcf-doc-page {
    box-sizing: border-box;
    width: 794px;
    min-height: 1123px;
    padding: 56px;
    background: #ffffff;
    color: ${BRAND.primary};
    font-family: Inter, Arial, system-ui, sans-serif;
    line-height: 1.55;
  }
  .captcf-doc-header {
    border-bottom: 2px solid ${BRAND.accent};
    padding-bottom: 12px;
    margin-bottom: 22px;
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
  }
  .captcf-logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .captcf-logo svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: ${BRAND.primary};
    stroke-width: 2.2;
  }
  .captcf-logo strong { color: ${BRAND.accent}; }
  .captcf-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
    font-size: 11px;
  }
  .captcf-meta span {
    border: 1px solid ${BRAND.border};
    background: ${BRAND.warm};
    border-radius: 6px;
    padding: 4px 8px;
    font-weight: 700;
  }
  .captcf-doc-title {
    margin: 0 0 18px;
    font-size: 26px;
    line-height: 1.2;
    color: ${BRAND.primary};
  }
  .captcf-consigne {
    background: ${BRAND.accentSoft};
    border-left: 5px solid ${BRAND.accent};
    border-radius: 8px;
    padding: 12px 14px;
    margin: 16px 0;
  }
  .captcf-consigne-title {
    color: ${BRAND.accent};
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .captcf-consigne p { margin: 0; font-weight: 650; }
  .captcf-card {
    border: 1px solid ${BRAND.border};
    border-radius: 8px;
    padding: 14px;
    margin: 16px 0;
    break-inside: avoid;
  }
  .captcf-card-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px solid ${BRAND.border};
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .captcf-card h2 {
    margin: 0;
    font-size: 18px;
  }
  .captcf-card-head span,
  .captcf-note,
  .captcf-visual figcaption {
    color: ${BRAND.muted};
    font-size: 12px;
  }
  .captcf-question {
    margin: 13px 0;
  }
  .captcf-level-profile {
    display: grid;
    grid-template-columns: 1.15fr 1fr 1fr 1fr;
    gap: 8px;
    margin: 0 0 14px;
    padding: 9px 10px;
    border: 1px solid ${BRAND.border};
    border-left: 4px solid ${BRAND.accent};
    border-radius: 8px;
    background: #fffdf8;
    color: ${BRAND.primary};
    font-size: 11px;
    line-height: 1.35;
  }
  .captcf-level-profile span {
    color: ${BRAND.muted};
  }
  .captcf-question h3 {
    margin: 0 0 4px;
    font-size: 14px;
    color: ${BRAND.primary};
  }
  .captcf-options {
    margin: 8px 0 0 22px;
    padding: 0;
  }
  .captcf-options li {
    padding: 3px 0;
  }
  .captcf-answer-zone {
    height: 72px;
    border: 1px dashed #9aa7b9;
    border-radius: 7px;
    margin-top: 8px;
    background: #fff;
  }
  .captcf-answer {
    background: #f8fafc;
    border: 1px solid ${BRAND.border};
    border-radius: 7px;
    padding: 8px 10px;
  }
  .captcf-timeline {
    border: 1px solid ${BRAND.border};
    border-radius: 8px;
    overflow: hidden;
    margin: 16px 0;
  }
  .captcf-timeline div {
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid ${BRAND.border};
  }
  .captcf-timeline div:last-child { border-bottom: 0; }
  .captcf-dialogue-line {
    border-left: 4px solid ${BRAND.accent};
    padding-left: 10px;
  }
  .captcf-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 14px;
  }
  .captcf-table th,
  .captcf-table td {
    border: 1px solid ${BRAND.border};
    padding: 9px 10px;
    text-align: left;
    vertical-align: top;
  }
  .captcf-table th {
    background: #f3f6fa;
  }
  .captcf-visual {
    margin: 16px 0;
  }
  .captcf-image-placeholder {
    height: 220px;
    border: 1.5px solid ${BRAND.border};
    border-radius: 10px;
    background: linear-gradient(135deg, #f8fafc, #fff7f0);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    color: ${BRAND.primary};
  }
  @media print {
    body { margin: 0; background: #fff; }
    .captcf-doc-page { width: auto; min-height: auto; padding: 15mm; }
  }
`;

export function buildCaptcfDocumentBody(input: CaptcfDocumentInput) {
  const meta = getDocumentMeta(input);
  return `
    <article class="captcf-doc-page">
      <header class="captcf-doc-header">
        ${capLogo()}
        <div class="captcf-meta">
          <span>${escapeHtml(meta.option.shortLabel)}</span>
          <span>Niveau ${escapeHtml(meta.level)}</span>
          <span>${escapeHtml(meta.competence)}</span>
          <span>${new Date().toLocaleDateString("fr-FR")}</span>
        </div>
      </header>
      <h1 class="captcf-doc-title">${escapeHtml(meta.title)}</h1>
      ${buildTypeSpecificContent(input)}
    </article>
  `;
}

export function buildCaptcfDocumentHtml(input: CaptcfDocumentInput) {
  return `<!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(getDocumentMeta(input).title)} - CAP TCF</title>
        <style>${CAPTCF_DOCUMENT_CSS} body{margin:0;background:#f6f4ef;padding:24px;}</style>
      </head>
      <body>${buildCaptcfDocumentBody(input)}</body>
    </html>`;
}

function docxText(text: string, options: any = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: "0B234A", ...options })],
  });
}

function docxHeading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2 = HeadingLevel.HEADING_2) {
  return new Paragraph({
    heading: level,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, font: "Arial", bold: true, color: "0B234A", size: level === HeadingLevel.HEADING_1 ? 32 : 26 })],
  });
}

function docxConsigne(title: string, text: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "F47B20" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "F47B20" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "F47B20" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "F47B20" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "FFF7F0" },
            margins: { top: 160, bottom: 160, left: 180, right: 180 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: title, bold: true, color: "F47B20", font: "Arial", size: 20 })],
              }),
              docxText(text),
            ],
          }),
        ],
      }),
    ],
  });
}

function docxExercise(exercise: CaptcfExerciseLike, index: number, withAnswers: boolean) {
  const children: any[] = [
    docxHeading(`${index + 1}. ${exercise.titre || "Exercice"}`),
    docxText(`${exercise.competence || "TCF"} - Niveau ${exercise.niveau_vise || "A2"}`, { italics: true, size: 18, color: "64748B" }),
    docxConsigne("CONSIGNE", exercise.consigne || "Lisez le document et repondez aux questions."),
  ];

  const items = getItems(exercise);
  if (!items.length) {
    children.push(docxText("Zone de reponse : ________________________________________________"));
    return children;
  }

  items.forEach((item: any, itemIndex: number) => {
    children.push(docxText(`Question ${itemIndex + 1}. ${item.question || item.enonce || item.prompt || ""}`, { bold: true }));
    if (Array.isArray(item.options) && item.options.length) {
      item.options.slice(0, 4).forEach((option: string, optionIndex: number) => {
        children.push(docxText(`${String.fromCharCode(65 + optionIndex)}. ${option}`));
      });
    } else {
      children.push(docxText("Reponse : ________________________________________________"));
    }
    if (withAnswers) {
      children.push(docxText(`Reponse attendue : ${item.answer ?? item.reponse ?? item.correct_answer ?? "A completer"}`, { bold: true, color: "991B1B" }));
    }
  });
  return children;
}

export async function buildCaptcfDocumentDocxBlob(input: CaptcfDocumentInput) {
  const meta = getDocumentMeta(input);
  const exercises = input.exercises.length ? input.exercises : [{ titre: meta.title, niveau_vise: meta.level, competence: meta.competence }];
  const withAnswers = input.type === "corrige_formateur";
  const profileSummary = getCaptcfLevelProfileSummary(meta.level);
  const children: any[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 160 },
      children: [
        new TextRun({ text: "CAP ", bold: true, color: "0B234A", font: "Arial", size: 26 }),
        new TextRun({ text: "TCF", bold: true, color: "F47B20", font: "Arial", size: 26 }),
      ],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "F47B20" } },
    }),
    docxHeading(meta.title, HeadingLevel.HEADING_1),
    docxText(`${meta.option.label} - Niveau ${meta.level} - ${meta.competence}`),
  ];

  if (input.type === "document_image") {
    children.push(docxConsigne("A FAIRE", "Observez l'image, decrivez les informations importantes, puis repondez aux questions."));
    children.push(docxText("[Emplacement image / schema / document visuel]", { bold: true }));
    children.push(docxText("Legende et source : a completer.", { italics: true, color: "64748B" }));
  } else if (input.type === "dialogue_transcription") {
    children.push(docxConsigne("CONTEXTE D'ECOUTE", "Duree audio cible : 2 min 30. Plage acceptable : 2 min 25 a 2 min 35."));
  } else if (input.type === "qcm_tcf") {
    children.push(docxConsigne("CONSIGNE EXAMEN TCF", "Lisez ou ecoutez le document. Cochez la bonne reponse A, B, C ou D."));
  } else if (input.type === "document_transforme") {
    children.push(docxConsigne("DOCUMENT TRANSFORME", "Support externe reformate dans la charte CapTCF."));
  } else if (input.type === "fiche_formateur") {
    children.push(docxConsigne("GUIDE PEDAGOGIQUE", "Utilisez cette fiche pour piloter la seance, adapter les relances et garder le rythme."));
  } else {
    children.push(docxConsigne("CONSIGNE", "Realisez les activites dans l'ordre."));
  }

  exercises.forEach((exercise, index) => {
    children.push(...docxExercise(exercise, index, withAnswers));
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeDocumentFilename(input: CaptcfDocumentInput, extension: "pdf" | "docx") {
  const meta = getDocumentMeta(input);
  const first = input.exercises[0];
  const base = `${meta.option.shortLabel}_${first?.niveau_vise || "A2"}_${meta.competence}_${meta.title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `CAPTCF_${base || "document"}.${extension}`;
}
