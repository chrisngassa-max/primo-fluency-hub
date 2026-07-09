import { fetchSessionDocuments } from "./documents";
import { fetchExerciseBankDetail, fetchSessionDocumentLinks } from "./exerciseLinks";
import { getFileSignedUrl } from "./importedFiles";
import { buildFlowItems } from "./sessionFlow";
import type {
  ExerciseBankDetail,
  ImportedFileMetadata,
  SessionDocument,
  SessionDocumentLink,
  SessionFlowItem,
} from "./types";

export type BookletAudience = "formateur" | "apprenant";

const FILE_TYPE_LABEL: Record<string, string> = { pdf: "PDF", docx: "DOCX", image: "Image" };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function includedInBooklet(item: SessionFlowItem, audience: BookletAudience): boolean {
  if (item.audience === "staging") return false;
  if (item.audience === "both") return true;
  return item.audience === audience;
}

function renderDocumentSection(doc: SessionDocument): string {
  return `
    <section class="booklet-section">
      <h2>${esc(doc.title)}</h2>
      <div class="booklet-content">${doc.content_html || "<p class='muted'>Contenu vide.</p>"}</div>
    </section>`;
}

// Rend un exercice de la banque. showAnswers=false (livret apprenant) : jamais
// bonne_reponse/explication/justification, seulement consigne/questions/options.
function renderExerciseSection(detail: ExerciseBankDetail, showAnswers: boolean): string {
  const contenu = detail.contenu as any;
  const items = Array.isArray(contenu?.items) ? (contenu.items as any[]) : null;

  const itemsHtml = items
    ? `<ol>${items
        .map((it) => {
          const question = esc(it.question ?? it.enonce ?? "");
          const optionsHtml = Array.isArray(it.options)
            ? `<ul>${it.options
                .map((opt: string) => {
                  const isAnswer = showAnswers && opt === it.bonne_reponse;
                  return `<li${isAnswer ? ' class="correct-answer"' : ""}>${esc(opt)}</li>`;
                })
                .join("")}</ul>`
            : "";
          const answerHtml =
            showAnswers && it.bonne_reponse
              ? `<p class="answer"><strong>Réponse :</strong> ${esc(String(it.bonne_reponse))}</p>`
              : "";
          const explanationHtml =
            showAnswers && (it.explication || it.justification)
              ? `<p class="explanation"><em>${esc(it.explication ?? it.justification)}</em></p>`
              : "";
          return `<li>${question}${optionsHtml}${answerHtml}${explanationHtml}</li>`;
        })
        .join("")}</ol>`
    : "";

  const texteHtml = contenu?.texte ? `<div class="exercise-support">${esc(String(contenu.texte))}</div>` : "";

  return `
    <section class="booklet-section">
      <h2>${esc(detail.titre)} <span class="badge">Exercice bibliothèque · ${esc(detail.niveau_vise)} · ${esc(detail.competence)}</span></h2>
      <p class="consigne">${esc(detail.consigne)}</p>
      ${texteHtml}
      ${itemsHtml}
    </section>`;
}

interface Annexe {
  title: string;
  type: string;
  filename: string;
  url: string;
}

function renderAnnexesSection(annexes: Annexe[]): string {
  if (annexes.length === 0) return "";
  return `
    <section class="booklet-section annexes">
      <h2>Annexes jointes</h2>
      <ul>
        ${annexes
          .map(
            (a) => `<li>
              <span class="badge">${esc(FILE_TYPE_LABEL[a.type] ?? a.type)}</span>
              <strong>${esc(a.title)}</strong> (${esc(a.filename)})
              — <a href="${a.url}" target="_blank" rel="noopener noreferrer">ouvrir / télécharger</a>
            </li>`,
          )
          .join("")}
      </ul>
      <p class="muted">Liens valables 1 heure à partir de la génération de ce livret.</p>
    </section>`;
}

function wrapBooklet(params: { sessionCode: string; sessionTitle: string; audience: BookletAudience; sections: string[]; annexes: Annexe[] }): string {
  const { sessionCode, sessionTitle, audience, sections, annexes } = params;
  const audienceLabel = audience === "formateur" ? "Livret Formateur" : "Livret Apprenant";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${esc(sessionCode)} — ${audienceLabel}</title>
<style>
  :root { --navy: #0b234a; --orange: #f47b20; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; max-width: 860px; margin: 0 auto; padding: 32px 24px 64px; line-height: 1.5; }
  header.booklet-header { border-bottom: 3px solid var(--orange); padding-bottom: 14px; margin-bottom: 28px; }
  header.booklet-header .brand { font-weight: 900; font-size: 20px; color: var(--navy); }
  header.booklet-header .brand span { color: var(--orange); }
  header.booklet-header h1 { font-size: 24px; color: var(--navy); margin: 8px 0 4px; }
  header.booklet-header .meta { font-size: 13px; color: #64748b; }
  .booklet-section { margin-bottom: 28px; page-break-inside: avoid; }
  .booklet-section h2 { font-size: 16px; color: var(--navy); border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 10px; }
  .booklet-content :first-child { margin-top: 0; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; color: var(--navy); background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 2px 8px; margin-left: 6px; vertical-align: middle; }
  .consigne { font-weight: 600; margin: 8px 0; }
  .exercise-support { background: #f8fafc; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; white-space: pre-line; font-size: 13px; }
  .correct-answer { font-weight: 700; color: #047857; }
  .answer { color: #047857; margin: 4px 0 0; font-size: 13px; }
  .explanation { color: #64748b; font-size: 12.5px; margin: 2px 0 0; }
  .muted { color: #94a3b8; font-size: 12px; }
  section.annexes ul { list-style: none; padding: 0; }
  section.annexes li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  @media print {
    body { padding: 0; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <header class="booklet-header">
    <div class="brand">CAP <span>TCF</span></div>
    <h1>${esc(sessionCode)} — ${esc(sessionTitle)}</h1>
    <div class="meta">${audienceLabel} · généré le ${new Date().toLocaleDateString("fr-FR")} · brouillon pédagogique ("socle à compléter")</div>
  </header>
  ${sections.join("\n")}
  ${renderAnnexesSection(annexes)}
</body>
</html>`;
}

/**
 * Construit le livret HTML imprimable pour une audience donnée. Lit
 * le déroulé global existant (documents + liens), ne modifie aucune
 * donnée. Le corrigé (bonne_reponse/explication/justification) n'est
 * jamais inclus dans le livret apprenant.
 */
export async function buildSessionBooklet(
  sessionCode: string,
  sessionTitle: string,
  audience: BookletAudience,
): Promise<string> {
  const [documents, linksWithExercise] = await Promise.all([
    fetchSessionDocuments(sessionCode),
    fetchSessionDocumentLinks(sessionCode),
  ]);
  const flowItems = buildFlowItems(documents, linksWithExercise).filter((item) =>
    includedInBooklet(item, audience),
  );

  const sections: string[] = [];
  const annexes: Annexe[] = [];

  for (const item of flowItems) {
    if (item.kind === "document") {
      sections.push(renderDocumentSection(item.document));
      continue;
    }
    const link: SessionDocumentLink = item.link;
    if (link.linked_type === "exercise") {
      try {
        const detail = await fetchExerciseBankDetail(link.linked_id);
        sections.push(renderExerciseSection(detail, audience === "formateur"));
      } catch {
        sections.push(`<section class="booklet-section"><p class="muted">Exercice introuvable (${esc(link.title ?? link.linked_id)}).</p></section>`);
      }
      continue;
    }
    // pdf/docx/image : jamais incorporé, seulement listé en annexe.
    const meta = link.metadata as unknown as Partial<ImportedFileMetadata>;
    if (meta.storage_path) {
      const url = await getFileSignedUrl(meta.storage_path, 3600);
      annexes.push({
        title: link.title || meta.original_filename || "Fichier importé",
        type: link.linked_type,
        filename: meta.original_filename || "",
        url,
      });
    }
  }

  return wrapBooklet({ sessionCode, sessionTitle, audience, sections, annexes });
}
