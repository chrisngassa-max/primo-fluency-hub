// Générateur dédié S01 v3 — ne touche ni S02-S05 ni le pipeline generate-session-pack.mjs
// au-delà de l'import des primitives partagées (charte graphique CapTCF).
// Source de contenu : content/curriculum/v2/S01-v3/s01-v3-data.json
// (construit à partir de docs/s01-v3-conception-pedagogique.md)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlaywrightRenderer } from './providers/playwright-renderer.mjs';
import {
  getHTMLHeader,
  wrapHTML,
  getConsigneBoxHTML,
  renderVisualSVG,
  createDocxHeader,
  createDocxConsigne,
  createDocxParagraph,
  COLORS
} from './generate-session-pack.mjs';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, AlignmentType, WidthType, ImageRun
} from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..');
const SESSION = 'S01';
const OUT_DIR = join(ROOT_DIR, 'docs', 'seance-1-v3-validation');
const DATA_DIR = join(ROOT_DIR, 'content', 'curriculum', 'v2', 'S01-v3');

async function loadData() {
  const data = JSON.parse(await readFile(join(DATA_DIR, 's01-v3-data.json'), 'utf8'));
  const audioMeta = JSON.parse(await readFile(join(DATA_DIR, 'audio', 'CO-metadata.json'), 'utf8'));
  return { data, audioMeta };
}

const letters = ['A', 'B', 'C', 'D'];

// Rendu d'un exercice d'atelier différencié (identité, lecture, variante).
// showAnswer=false (Fiche Apprenant) : cases à cocher vides, aucune réponse visible.
// showAnswer=true (Corrigé Formateur) : réponse correcte cochée/surlignée.
function renderAtelierExerciceHTML(ex, showAnswer) {
  const subItems = ex.items || [{ question: ex.question, options: ex.options, reponse: ex.reponse }];
  return `
    <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; background:#fafbfc;">
      <div style="font-size: 9pt; margin-bottom: 6px;"><strong>Consigne :</strong> ${ex.consigne}</div>
      ${ex.texte ? `<div style="font-size:9pt; font-style:italic; background:#ffffff; padding:8px; border-radius:4px; white-space:pre-line; margin-bottom:8px;">${ex.texte}</div>` : ''}
      ${subItems.map(it => `
        <div style="margin-bottom:6px;">
          <div style="font-weight:700; font-size:9pt; color:#0b234a;">${it.question}</div>
          ${it.options ? `<div style="padding-left:8px;">${it.options.map(opt => `<div class="checkbox-row"><span class="checkbox"></span> ${opt}${showAnswer && opt === it.reponse ? ' <strong style="color:#047857;">&#10003; réponse</strong>' : ''}</div>`).join('')}</div>` : `<div class="response-line">${showAnswer ? `<span style="color:#047857; font-weight:700; font-size:9pt;">${it.reponse}</span>` : ''}</div>`}
        </div>
      `).join('')}
      ${showAnswer ? `<div style="font-size:7.5pt; color:#94a3b8; margin-top:4px;">${ex.source}</div>` : ''}
    </div>
  `;
}

function atelierExerciceDocxLines(ex, showAnswer) {
  const subItems = ex.items || [{ question: ex.question, options: ex.options, reponse: ex.reponse }];
  const lines = [createDocxParagraph(`Consigne : ${ex.consigne}`, false, 9.5, COLORS.text, 40)];
  if (ex.texte) lines.push(createDocxParagraph(ex.texte, false, 9, '475569', 30));
  subItems.forEach(it => {
    lines.push(createDocxParagraph(it.question, false, 9.5, COLORS.text, 30));
    if (it.options) {
      it.options.forEach(opt => lines.push(createDocxParagraph(`[  ] ${opt}${showAnswer && opt === it.reponse ? '  <- réponse' : ''}`, false, 9.5, showAnswer && opt === it.reponse ? '047857' : COLORS.text, 15)));
    } else if (showAnswer) {
      lines.push(createDocxParagraph(`Réponse : ${it.reponse}`, false, 9.5, '047857', 15));
    }
  });
  if (showAnswer) lines.push(createDocxParagraph(ex.source, false, 8, '94A3B8', 60));
  return lines;
}

// ---------------------------------------------------------------------------
// 1. Fiche Formateur
// ---------------------------------------------------------------------------
function getTrainerHTML(data) {
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2', '180 min', 'CO/CE/EO/EE/CIVIQUE', 'FOR', `Fiche Formateur — Déroulé Pédagogique ${SESSION} (v3 dense)`, COLORS.formateur)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
      'GUIDE PÉDAGOGIQUE — VERSION 3 DENSE',
      data.formateur.fiche_formateur
    )}
    <div class="section-title">Objectifs opérationnels</div>
    <div style="font-size: 9.5pt; margin-bottom: 15px; line-height: 1.45;">
      ${data.manifest.objectifs.map(o => `• ${o}<br>`).join('')}
    </div>
    <div class="section-title">Déroulé détaillé (180 minutes)</div>
    ${data.formateur.deroule_180min.map((phase, i) => `
      <div style="margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
        <div style="font-weight: 800; color: #065f46; margin-bottom: 4px;">Phase ${i + 1} : ${phase.phase} (${phase.duree_min} min)</div>
        <div style="font-size: 9pt; line-height: 1.5;">${phase.description}</div>
      </div>
    `).join('')}
    <div class="section-title">Détail Phase 1 — Rituel civique (10 min)</div>
    <div style="font-size: 9pt; line-height: 1.5;">
      <strong>Consigne formateur :</strong> « Aujourd'hui, avant de commencer, regardons ensemble les cinq grands thèmes que nous allons voir pendant toute la formation. Ce n'est pas un test, juste une découverte. »<br>
      <strong>Activité apprenant :</strong> observation collective du support visuel, lecture à voix haute des cinq intitulés.<br>
      <strong>Questions exactes :</strong> « Combien de panneaux voyez-vous ? » / « Quel est le premier thème, à gauche ? » / « Selon vous, que veut dire 'vivre dans la société française' ? »<br>
      <strong>Relance :</strong> « Est-ce qu'un de ces mots vous fait déjà penser à quelque chose que vous connaissez dans votre pays ? »<br>
      <strong>Adaptation :</strong> A1 — pointer les couleurs plutôt que lire ; B1/B2 — reformulation complète de chaque intitulé.
    </div>
    <div class="section-title">Détail Phase 2 — Activation + lexique (20 min)</div>
    <div style="font-size: 9pt; line-height: 1.5;">
      <strong>Consigne formateur :</strong> « Voici les mots importants d'aujourd'hui. On va les lire, les comprendre, puis les utiliser. »<br>
      <strong>Déroulement :</strong> lecture silencieuse (3 min) → lecture à voix haute par binômes (5 min) → 3 exercices lexicaux (12 min, cf. fiche Lexique).<br>
      <strong>Adaptation :</strong> A1 — appui sur les exercices Structures les plus simples ; B1/B2 — réemploi oral libre en plus.
    </div>
    <div class="section-title">Détail Phase 3 — Support invariant CO/CE (50 min)</div>
    <div style="font-size: 9pt; line-height: 1.5;">
      <strong>1ère écoute globale (10 min) :</strong> sans transcription, questions 1-3.<br>
      <strong>2ème écoute ciblée (15 min) :</strong> repérage chiffres et lexique, questions 4-10.<br>
      <strong>3ème écoute + transcription (10 min) :</strong> lecture silencieuse, correction phonétique des liaisons.<br>
      <strong>Exploitation écrite (15 min) :</strong> questions 11-20, correction collective avec citation exacte de la réplique.<br>
      <strong>Relance :</strong> « Pourquoi Mme Rossi demande-t-elle à Awa d'épeler son nom ? »<br>
      <strong>Adaptation :</strong> A1 → questions 1-13 ; A2 → 1-17 ; B1/B2 → 1-20 (détail : fiche Dialogue/Transcription).
    </div>
    <div class="section-title">Détail Phase 4 — Ateliers différenciés (60 min)</div>
    <table>
      <thead><tr><th>Niveau</th><th>Durée</th><th>Contenu</th></tr></thead>
      <tbody>
        ${Object.entries(data.ateliers).map(([niv, at]) => `
          <tr><td><strong>${niv}</strong></td><td>${at.duree_min} min</td><td>${at.contenu_formateur}</td></tr>
        `).join('')}
      </tbody>
    </table>
    <div class="section-title">Ateliers différenciés — exercices et corrigé (pour le formateur)</div>
    ${Object.entries(data.ateliers).map(([niv, at]) => `
      <div style="margin: 12px 0 6px 0; font-weight: 800; color: #065f46; font-size: 10.5pt;">Niveau ${niv}</div>
      ${at.exercices.map(ex => renderAtelierExerciceHTML(ex, true)).join('')}
    `).join('')}
    <div class="section-title">Détail Phase 5 — Production EE/EO (30 min)</div>
    <div style="font-size: 9pt; line-height: 1.5;">
      EO (15 min) : 8 prompts gradés A1→B2 (fiche EO). EE (15 min) : 2 productions guidées + 1 autonome (fiche EE).
    </div>
    <div class="section-title">Détail Phase 6 — Fixation (10 min)</div>
    <div style="font-size: 9pt; line-height: 1.5;">
      QCM civique 10 questions (5 min), correction flash collective (3 min), explication des devoirs différenciés (2 min).
    </div>
    <div class="section-title">Règles d'adaptation & vigilance</div>
    <div class="tip-box">
      ${data.formateur.adaptation_rules.map(r => `• ${r}<br>`).join('')}
    </div>
  `;
  return wrapHTML(content, COLORS.formateur);
}

async function buildTrainerDocx(data) {
  const children = [
    ...createDocxHeader(SESSION, 'A1-B2', '180 min', 'CO/CE/EO/EE/CIVIQUE', 'FOR', `Fiche Formateur — Déroulé Pédagogique ${SESSION} (v3 dense)`, COLORS.formateur),
    createDocxConsigne('GUIDE PÉDAGOGIQUE — VERSION 3 DENSE', data.formateur.fiche_formateur),
    createDocxParagraph('Objectifs opérationnels', true, 13, COLORS.text, 200),
    ...data.manifest.objectifs.map(o => createDocxParagraph(`• ${o}`, false, 10.5, COLORS.text, 40)),
    createDocxParagraph('Déroulé détaillé (180 minutes)', true, 13, COLORS.text, 200)
  ];
  data.formateur.deroule_180min.forEach((phase, i) => {
    children.push(createDocxParagraph(`Phase ${i + 1} : ${phase.phase} (${phase.duree_min} min)`, true, 11.5, COLORS.formateur, 150));
    children.push(createDocxParagraph(phase.description, false, 10, COLORS.text, 40));
  });
  children.push(createDocxParagraph('Ateliers différenciés — détail par niveau', true, 13, COLORS.text, 200));
  Object.entries(data.ateliers).forEach(([niv, at]) => {
    children.push(createDocxParagraph(`${niv} (${at.duree_min} min)`, true, 11, COLORS.formateur, 100));
    children.push(createDocxParagraph(at.contenu_formateur, false, 10, COLORS.text, 40));
  });
  children.push(createDocxParagraph('Ateliers différenciés — exercices et corrigé', true, 13, COLORS.text, 200));
  Object.entries(data.ateliers).forEach(([niv, at]) => {
    children.push(createDocxParagraph(`Niveau ${niv}`, true, 11, COLORS.formateur, 100));
    at.exercices.forEach(ex => children.push(...atelierExerciceDocxLines(ex, true)));
  });
  children.push(createDocxParagraph("Règles d'adaptation & vigilance", true, 12, COLORS.formateur, 200));
  data.formateur.adaptation_rules.forEach(r => children.push(createDocxParagraph(`• ${r}`, false, 10.5, COLORS.formateur, 50)));

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 2. Fiche Apprenant dense (grammaire graduée A1-B2 + repères ateliers)
// ---------------------------------------------------------------------------
function getStudentHTML(data) {
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2 gradué', '60 min (ateliers)', 'Structures/CE/EE', 'APP', `Fiche Apprenant Dense — Ateliers différenciés ${SESSION} (v3)`, COLORS.apprenant)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
      'CONSIGNE',
      "Travaillez les exercices correspondant à votre niveau. Le formateur passera vous aider."
    )}
    <div class="section-title">Bloc grammaire / structures — se présenter, identité, parcours</div>
    ${data.grammaire.map(g => `
      <div style="margin-bottom: 14px; padding-left: 8px; border-left: 3px solid #a7f3d0;">
        <div style="font-weight: 800; color: #0b234a;">${g.niveau} — ${g.point}</div>
        <div style="font-size: 9pt; margin: 4px 0;">${g.consigne}</div>
        ${g.items.map(it => `<div class="response-line" style="height:auto; border:none; font-size:9pt; margin-bottom:4px;">• ${it}</div>`).join('')}
      </div>
    `).join('')}
    <div class="section-title">Ateliers différenciés — repères par niveau (60 min)</div>
    <table>
      <thead><tr><th>Niveau</th><th>Contenu de l'atelier</th></tr></thead>
      <tbody>
        ${Object.entries(data.ateliers).map(([niv, at]) => `<tr><td><strong>${niv}</strong></td><td style="font-size:9pt;">${at.contenu_apprenant}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="section-title">Exercices d'atelier — faites les exercices de votre niveau</div>
    ${Object.entries(data.ateliers).map(([niv, at]) => `
      <div style="margin: 14px 0 6px 0; font-weight: 800; color: #0b234a; font-size: 10.5pt;">Niveau ${niv}</div>
      ${at.exercices.map(ex => renderAtelierExerciceHTML(ex, false)).join('')}
    `).join('')}
    <div class="section-title">Travail à la maison (Devoir)</div>
    ${Object.entries(data.devoirs).map(([niv, txt]) => `
      <div style="margin-bottom: 8px; font-size: 9pt;"><strong>${niv} :</strong> ${txt}</div>
    `).join('')}
  `;
  return wrapHTML(content, COLORS.apprenant);
}

async function buildStudentDocx(data) {
  const children = [
    ...createDocxHeader(SESSION, 'A1-B2 gradué', '60 min', 'Structures/CE/EE', 'APP', `Fiche Apprenant Dense — Ateliers différenciés ${SESSION} (v3)`, COLORS.apprenant),
    createDocxConsigne('CONSIGNE', 'Travaillez les exercices correspondant à votre niveau.'),
    createDocxParagraph('Bloc grammaire / structures', true, 13, COLORS.text, 200)
  ];
  data.grammaire.forEach(g => {
    children.push(createDocxParagraph(`${g.niveau} — ${g.point}`, true, 11, COLORS.apprenant, 150));
    children.push(createDocxParagraph(g.consigne, false, 10, COLORS.text, 40));
    g.items.forEach(it => children.push(createDocxParagraph(`• ${it}`, false, 10, COLORS.text, 30)));
  });
  children.push(createDocxParagraph('Ateliers différenciés — repères par niveau', true, 13, COLORS.text, 200));
  Object.entries(data.ateliers).forEach(([niv, at]) => {
    children.push(createDocxParagraph(niv, true, 11, COLORS.apprenant, 100));
    children.push(createDocxParagraph(at.contenu_apprenant, false, 10, COLORS.text, 30));
  });
  children.push(createDocxParagraph("Exercices d'atelier — faites les exercices de votre niveau", true, 13, COLORS.text, 200));
  Object.entries(data.ateliers).forEach(([niv, at]) => {
    children.push(createDocxParagraph(`Niveau ${niv}`, true, 11, COLORS.apprenant, 100));
    at.exercices.forEach(ex => children.push(...atelierExerciceDocxLines(ex, false)));
  });
  children.push(createDocxParagraph('Travail à la maison', true, 12, COLORS.text, 200));
  Object.entries(data.devoirs).forEach(([niv, txt]) => children.push(createDocxParagraph(`${niv} : ${txt}`, false, 10.5, COLORS.text, 60)));

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 3. Dialogue / Transcription + 20 questions
// ---------------------------------------------------------------------------
function getDialogueHTML(data) {
  const lines = data.co.script.split('\n').filter(l => l.trim()).map(l => {
    const idx = l.indexOf(':');
    return { name: l.slice(0, idx).trim(), text: l.slice(idx + 1).trim() };
  });
  const dialogueHtml = lines.map(l => `
    <div style="border-left: 3px solid #6b21a8; padding-left: 12px; margin-bottom: 10px; font-size: 9.5pt;">
      <div style="font-weight: 800; color: #0b234a; margin-bottom: 2px;">${l.name}</div>
      <div style="color: #1e293b; line-height: 1.45;">${l.text}</div>
    </div>
  `).join('');
  const questionsByCat = {};
  for (const q of data.co_questions) {
    (questionsByCat[q.categorie] ||= []).push(q);
  }
  const questionsHtml = Object.entries(questionsByCat).map(([cat, qs]) => `
    <div class="section-title" style="margin-top:14px;">${cat}</div>
    ${qs.map(q => `
      <div style="margin-bottom: 10px; padding-left: 8px;">
        <div style="font-weight: 700; font-size: 9.5pt; color: #0b234a;">q${q.id}. ${q.question} <span style="font-weight:400; color:#64748b; font-size:8pt;">(niveaux : ${q.niveaux.join(', ')})</span></div>
        <div class="response-line"></div>
      </div>
    `).join('')}
  `).join('');
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2 Invariant', '2.5 min', 'CO / CE', 'APP', `Transcription Audio + 20 Questions — Séance ${SESSION} (v3)`, COLORS.co)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
      "CONTEXTE D'ÉCOUTE",
      data.support.situation
    )}
    <div style="margin-top: 16px;">${dialogueHtml}</div>
    <div class="section-title">Questions de compréhension (20 items)</div>
    ${questionsHtml}
  `;
  return wrapHTML(content, COLORS.co);
}

async function buildDialogueDocx(data) {
  const lines = data.co.script.split('\n').filter(l => l.trim()).map(l => {
    const idx = l.indexOf(':');
    return { name: l.slice(0, idx).trim(), text: l.slice(idx + 1).trim() };
  });
  const children = [
    ...createDocxHeader(SESSION, 'A1-B2', '2.5 min', 'CO / CE', 'APP', `Transcription Audio + 20 Questions — Séance ${SESSION} (v3)`, COLORS.co),
    createDocxConsigne("CONTEXTE D'ÉCOUTE", data.support.situation)
  ];
  lines.forEach(l => {
    children.push(createDocxParagraph(`${l.name} :`, true, 10.5, COLORS.co, 90));
    children.push(createDocxParagraph(l.text, false, 10.5, COLORS.text, 40));
  });
  children.push(createDocxParagraph('Questions de compréhension (20 items)', true, 13, COLORS.text, 200));
  let lastCat = null;
  data.co_questions.forEach(q => {
    if (q.categorie !== lastCat) {
      children.push(createDocxParagraph(q.categorie, true, 11, COLORS.co, 120));
      lastCat = q.categorie;
    }
    children.push(createDocxParagraph(`q${q.id}. ${q.question} (niveaux : ${q.niveaux.join(', ')})`, false, 10, COLORS.text, 60));
  });
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 4. QCM TCF — 10 questions, sans option inventée
// ---------------------------------------------------------------------------
function getQcmTcfHTML(data) {
  const content = `
    ${getHTMLHeader(SESSION, 'A2 Cible', '20 min', 'CO', 'QCM', `Préparation TCF — 10 Questions Compréhension Orale (v3)`, COLORS.qcm)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z"/></svg>`,
      'CONSIGNE EXAMEN TCF',
      data.qcm_tcf.consigne
    )}
    ${data.qcm_tcf.questions.map(q => `
      <div style="margin-top: 16px; padding: 14px; border: 1px solid #cbd5e1; border-radius: 8px; background-color: #fafbfc;">
        <div style="font-weight: 800; font-size: 10.5pt; margin-bottom: 10px; color: #0b234a;">Question ${q.id} : ${q.enonce}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${q.options.map((opt, idx) => `
            <div class="checkbox-row" style="background: #ffffff; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px;">
              <span class="checkbox"></span><span><strong>${letters[idx]}.</strong> ${opt}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
    <div style="font-size: 8.5pt; color: #64748b; margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center;">
      Examen Blanc CapTCF — Format officiel du Test de Connaissance du Français (TCF). Chaque question a exactement une bonne réponse parmi des options réelles.
    </div>
  `;
  return wrapHTML(content, COLORS.qcm);
}

async function buildQcmTcfDocx(data) {
  const children = [
    ...createDocxHeader(SESSION, 'A2 Cible', '20 min', 'CO', 'QCM', 'Préparation TCF — 10 Questions Compréhension Orale (v3)', COLORS.qcm),
    createDocxConsigne('CONSIGNE EXAMEN TCF', data.qcm_tcf.consigne)
  ];
  data.qcm_tcf.questions.forEach(q => {
    children.push(createDocxParagraph(`Question ${q.id} : ${q.enonce}`, true, 11, COLORS.text, 180));
    q.options.forEach((opt, idx) => children.push(createDocxParagraph(`[  ] ${letters[idx]}. ${opt}`, false, 10.5, COLORS.text, 40)));
  });
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 5. QCM Civique — 10 questions
// ---------------------------------------------------------------------------
function getQcmCiviqueHTML(data) {
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2', '15 min', 'CIVIQUE', 'APP', `Diagnostic Civique — 10 Questions (${data.qcm_civique.mention}) (v3)`, COLORS.qcm)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
      'DIAGNOSTIC CIVIQUE (CSP)',
      `Thème : ${data.qcm_civique.theme} | Mention officielle : ${data.qcm_civique.mention}`
    )}
    ${data.qcm_civique.questions.map((item, idx) => `
      <div style="margin-bottom: 16px; padding-left: 8px;">
        <div style="font-weight: 800; font-size: 10pt; margin-bottom: 6px; color: #0b234a;">${idx + 1}. ${item.enonce}</div>
        <div style="padding-left: 10px;">
          ${item.options.map((opt, i) => `<div class="checkbox-row"><span class="checkbox"></span> <strong>${letters[i]}.</strong> ${opt}</div>`).join('')}
        </div>
      </div>
    `).join('')}
    <div style="font-size: 8pt; font-style: italic; color: #64748b; text-align: center; border-top: 0.75pt solid #cbd5e1; padding-top: 8px; margin-top: 20px;">
      Simulation pédagogique CapTCF. Les questions présentées ne préjugent pas des questions officielles de l'examen d'État.
    </div>
  `;
  return wrapHTML(content, COLORS.qcm);
}

async function buildQcmCiviqueDocx(data) {
  const children = [
    ...createDocxHeader(SESSION, 'A1-B2', '15 min', 'CIVIQUE', 'APP', `Diagnostic Civique — 10 Questions (${data.qcm_civique.mention}) (v3)`, COLORS.qcm),
    createDocxConsigne('DIAGNOSTIC CIVIQUE', `Thème : ${data.qcm_civique.theme} | Mention : ${data.qcm_civique.mention}`)
  ];
  data.qcm_civique.questions.forEach((item, idx) => {
    children.push(createDocxParagraph(`${idx + 1}. ${item.enonce}`, true, 11, COLORS.text, 150));
    item.options.forEach((opt, i) => children.push(createDocxParagraph(`[  ] ${letters[i]}. ${opt}`, false, 10.5, '475569', 40)));
  });
  children.push(createDocxParagraph("Simulation pédagogique CapTCF. Les questions présentées ne préjugent pas des questions officielles de l'examen d'État.", false, 8.5, '94A3B8', 300));
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 6. Corrigé Formateur — justifications réelles (pas de texte générique)
// ---------------------------------------------------------------------------
function getCorrigeHTML(data) {
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2', 'N/A', 'CORRECTION', 'COR', `Corrigé Formateur — Séance ${SESSION} (v3)`, COLORS.corrige)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
      'GUIDE DE CORRECTION PÉDAGOGIQUE',
      "Veuillez adapter la sévérité de l'évaluation selon le niveau CECRL cible."
    )}
    <div class="section-title">Corrigé des questions de compréhension (par niveau)</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
      ${Object.entries(data.corrige_co).map(([niv, c], idx) => {
        const borderColors = ['#991b1b', '#2563eb', '#6b21a8', '#047857'];
        return `
        <div style="border: 0.75pt solid #cbd5e1; padding: 8px; border-radius: 4px; border-top: 2.5px solid ${borderColors[idx]};">
          <div style="font-weight: 800; color: ${borderColors[idx]}; font-size: 9.5pt; margin-bottom: 4px;">Niveau ${niv}</div>
          <div style="font-size: 9pt;">• q1 : <strong>${c.q1 === true ? 'Vrai' : c.q1 === false ? 'Faux' : c.q1}</strong></div>
          <div style="font-size: 9pt;">• q2 : <strong>${typeof c.q2 === 'boolean' ? (c.q2 ? 'Vrai' : 'Faux') : c.q2}</strong></div>
          <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">${c.notes}</div>
        </div>
      `; }).join('')}
    </div>

    <div class="section-title">Corrigé QCM TCF (10 questions)</div>
    <table>
      <thead><tr><th style="width:5%;">#</th><th style="width:45%;">Question</th><th style="width:20%;">Réponse</th><th style="width:30%;">Justification (extrait du dialogue)</th></tr></thead>
      <tbody>
        ${data.qcm_tcf.questions.map(q => `
          <tr><td>${q.id}</td><td>${q.enonce}</td><td><strong>${q.reponse}</strong></td><td style="font-size:8.5pt; color:#475569;">${q.justification}</td></tr>
        `).join('')}
      </tbody>
    </table>

    <div class="section-title">Corrigé explicité du QCM Civique (${data.qcm_civique.mention})</div>
    <table>
      <thead><tr><th style="width:5%;">#</th><th style="width:35%;">Question</th><th style="width:20%;">Réponse attendue</th><th style="width:40%;">Justification pédagogique</th></tr></thead>
      <tbody>
        ${data.qcm_civique.questions.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.enonce}</td>
            <td><strong>${item.reponse}</strong></td>
            <td style="font-size: 8.5pt; color: #475569;">${item.justification}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="section-title">Grille d'évaluation & conseils formateur</div>
    <div style="font-size: 9pt; line-height: 1.45; color: #475569;">
      • <strong>Niveaux A1/A2 :</strong> tolérer les fautes de grammaire et d'orthographe si le sens communicatif est préservé.<br>
      • <strong>Niveaux B1/B2 :</strong> attendre une structure textuelle fluide (connecteurs logiques) et une argumentation développée.<br>
      • <strong>Variantes A2/B1/B2 recréées :</strong> à faire re-passer par la chaîne de validation Supabase avant toute réinsertion en base (non testées automatiquement dans cette maquette).
    </div>
  `;
  return wrapHTML(content, COLORS.corrige);
}

async function buildCorrigeDocx(data) {
  const children = [
    ...createDocxHeader(SESSION, 'A1-B2', 'N/A', 'CORRECTION', 'COR', `Corrigé Formateur — Séance ${SESSION} (v3)`, COLORS.corrige),
    createDocxConsigne('GUIDE DE CORRECTION PÉDAGOGIQUE', "Veuillez adapter la sévérité de l'évaluation selon le niveau CECRL cible."),
    createDocxParagraph('Corrigé des questions de compréhension par niveau', true, 13, COLORS.corrige, 200)
  ];
  Object.entries(data.corrige_co).forEach(([niv, c]) => {
    const q1 = c.q1 === true ? 'Vrai' : c.q1 === false ? 'Faux' : c.q1;
    const q2 = typeof c.q2 === 'boolean' ? (c.q2 ? 'Vrai' : 'Faux') : c.q2;
    children.push(createDocxParagraph(`Niveau ${niv} : q1 = ${q1} | q2 = ${q2}`, false, 10.5, COLORS.text, 100));
  });

  children.push(createDocxParagraph('Corrigé QCM TCF (10 questions)', true, 13, COLORS.corrige, 200));
  data.qcm_tcf.questions.forEach(q => {
    children.push(createDocxParagraph(`${q.id}. ${q.enonce} → ${q.reponse}`, true, 10.5, COLORS.text, 100));
    children.push(createDocxParagraph(`Justification : ${q.justification}`, false, 9.5, '475569', 20));
  });

  children.push(createDocxParagraph('Corrigé explicité du QCM Civique', true, 13, COLORS.corrige, 200));
  data.qcm_civique.questions.forEach((item, idx) => {
    children.push(createDocxParagraph(`${idx + 1}. ${item.enonce} → ${item.reponse}`, true, 10.5, COLORS.text, 100));
    children.push(createDocxParagraph(`Justification : ${item.justification}`, false, 9.5, '475569', 20));
  });

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 7. Lexique + 3 exercices
// ---------------------------------------------------------------------------
function getLexiqueHTML(data) {
  const rows = data.lexique.mots.map(item => `
    <tr>
      <td style="font-weight: 800; color: #0b234a; width: 20%;">${item.mot}</td>
      <td style="color: #334155; width: 45%;">${item.definition_simple}</td>
      <td style="font-style: italic; color: #475569; width: 35%;">« ${item.exemple} »</td>
    </tr>
  `).join('');
  const exercicesHtml = data.lexique_exercices.map(ex => `
    <div style="margin-bottom: 14px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px;">
      <div style="font-weight: 800; color: #475569; margin-bottom: 4px;">${ex.titre}</div>
      <div style="font-size: 9pt; margin-bottom: 6px;">${ex.consigne}</div>
      ${ex.items ? `<ul style="margin-left:16px; font-size:9pt;">${ex.items.map(it => `<li>${it.mot} → ______________</li>`).join('')}</ul>` : ''}
      ${ex.texte ? `<div style="font-size:9pt; font-style:italic; background:#fafbfc; padding:8px; border-radius:4px;">${ex.texte}</div>` : ''}
      ${ex.critere ? `<div style="font-size:8pt; color:#64748b; margin-top:4px;">Critère : ${ex.critere}</div>` : ''}
    </div>
  `).join('');
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2', '20 min', 'LEXIQUE', 'APP', `Glossaire + 3 Exercices — Lexique ${SESSION} (v3)`, COLORS.lexique)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
      'GLOSSAIRE DES MOTS CLÉS',
      'Ces mots constituent le socle de vocabulaire de la séance.'
    )}
    <table><thead><tr><th>Mot</th><th>Définition simplifiée</th><th>Exemple d'utilisation</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="section-title">Exercices de réemploi (minimum 3)</div>
    ${exercicesHtml}
  `;
  return wrapHTML(content, COLORS.lexique);
}

async function buildLexiqueDocx(data) {
  const children = [
    ...createDocxHeader(SESSION, 'A1-B2', '20 min', 'LEXIQUE', 'APP', `Glossaire + 3 Exercices — Lexique ${SESSION} (v3)`, COLORS.lexique),
    createDocxConsigne('GLOSSAIRE DES MOTS CLÉS', 'Ces mots constituent le socle de vocabulaire de la séance.')
  ];
  const tableRows = [new TableRow({ children: ['Mot', 'Définition', 'Exemple'].map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: COLORS.lexique })] })] })) })];
  data.lexique.mots.forEach(item => {
    tableRows.push(new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.mot, bold: true })] })] }),
      new TableCell({ children: [new Paragraph(item.definition_simple)] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `« ${item.exemple} »`, italic: true })] })] })
    ] }));
  });
  children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  children.push(createDocxParagraph('Exercices de réemploi', true, 13, COLORS.text, 200));
  data.lexique_exercices.forEach(ex => {
    children.push(createDocxParagraph(ex.titre, true, 11, COLORS.lexique, 120));
    children.push(createDocxParagraph(ex.consigne, false, 10, COLORS.text, 40));
    if (ex.texte) children.push(createDocxParagraph(ex.texte, false, 9.5, '475569', 40));
  });
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 8. Support Visuel — 5 questions
// ---------------------------------------------------------------------------
function getSupportVisuelHTML(data) {
  const visualSvg = renderVisualSVG(data.visual);
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2', '10 min', 'CIVIQUE', 'APP', `Fiche Activité — Exploitation du Support Visuel (v3)`, COLORS.apprenant)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`,
      'À FAIRE',
      'Observez attentivement le schéma ci-dessous, puis répondez aux questions.'
    )}
    <div style="margin: 16px 0; text-align: center;">
      ${visualSvg}
      <div style="font-size: 8.5pt; font-style: italic; color: #475569; margin-top: 6px;"><strong>Figure 1 :</strong> ${data.visual.scene.title}</div>
    </div>
    <div class="section-title">Questions d'observation (5 questions)</div>
    ${data.visual_questions.map((q, i) => `
      <div style="margin-bottom: 14px; padding-left: 8px;">
        <div style="font-weight: 700; margin-bottom: 6px; color: #0b234a;">q${i + 1}. ${q}</div>
        <div class="response-line"></div>
      </div>
    `).join('')}
  `;
  return wrapHTML(content, COLORS.apprenant);
}

async function buildSupportVisuelDocx(data) {
  const renderer = new PlaywrightRenderer();
  const visualSvg = renderVisualSVG(data.visual);
  const { buffer: imageBuffer } = await renderer.renderSvgToRaster({ svg: visualSvg, format: 'png' });
  const displayWidth = 500;
  const displayHeight = Math.round(displayWidth * (data.visual.scene.height / data.visual.scene.width));

  const children = [
    ...createDocxHeader(SESSION, 'A1-B2', '10 min', 'CIVIQUE', 'APP', 'Fiche Activité — Exploitation du Support Visuel (v3)', COLORS.apprenant),
    createDocxConsigne('À FAIRE', 'Observez attentivement le schéma ci-dessous, puis répondez aux questions.'),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 150, after: 100 },
      children: [new ImageRun({ data: imageBuffer, type: 'png', transformation: { width: displayWidth, height: displayHeight } })]
    }),
    createDocxParagraph(`Figure 1 : ${data.visual.scene.title}`, false, 9, '475569', 0),
    createDocxParagraph("Questions d'observation (5 questions)", true, 12, COLORS.text, 200)
  ];
  data.visual_questions.forEach((q, i) => {
    children.push(createDocxParagraph(`q${i + 1}. ${q}`, true, 11, COLORS.text, 120));
    children.push(createDocxParagraph('......................................................................................................................', false, 11, '94A3B8'));
  });
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// 9. Document Transformé (générique, inchangé par rapport aux autres séances)
// ---------------------------------------------------------------------------
function getDocumentTransformeHTML() {
  const content = `
    ${getHTMLHeader(SESSION, 'A1-B2 Invariant', 'N/A', 'LECTURE', 'APP', `Notice d'Accueil — Structure du Parcours d'Intégration`, COLORS.lexique)}
    ${getConsigneBoxHTML(
      `<svg style="width:14px;height:14px;fill:none;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>`,
      "DOCUMENT TRANSFORMÉ (NOTICE D'ORIENTATION)",
      "Ce document est un extrait de la notice officielle d'accueil, restructuré selon la charte d'impression CapTCF pour une lisibilité maximale."
    )}
    <div style="margin-top: 20px; line-height: 1.6; color: #1e293b;">
      <h3 style="font-size: 12pt; color: #0b234a; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">1. Bienvenue dans votre parcours d'intégration</h3>
      <p style="margin-bottom: 12px;">Chaque primo-arrivant signataire du contrat d'intégration républicaine s'engage dans un parcours de formation linguistique et civique de <strong>80 heures</strong> (réparties sur <strong>25 séances</strong> de trois heures).</p>
      <h3 style="font-size: 12pt; color: #0b234a; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">2. Les Objectifs d'Apprentissage</h3>
      <p style="margin-bottom: 12px;">La formation vise l'acquisition de repères sur la société française à travers cinq thèmes civiques :</p>
      <ul style="margin-left: 20px; margin-bottom: 15px;">
        <li>Principes et valeurs de la République</li><li>Système institutionnel et politique</li>
        <li>Droits et devoirs en France</li><li>Histoire, géographie et culture</li>
        <li>Vie en société et démarches quotidiennes</li>
      </ul>
      <h3 style="font-size: 12pt; color: #0b234a; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">3. Présence et Assiduité</h3>
      <p style="margin-bottom: 12px; background-color: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px; border-radius: 4px;">
        La présence à chaque séance est obligatoire et contrôlée par émargement. Deux évaluations nationales hors séances mesurent vos progrès : l'évaluation intermédiaire et l'évaluation finale.
      </p>
    </div>
  `;
  return wrapHTML(content, COLORS.lexique);
}

async function buildDocumentTransformeDocx() {
  const children = [
    ...createDocxHeader(SESSION, 'A1-B2 Invariant', 'N/A', 'LECTURE', 'APP', "Notice d'Accueil — Structure du Parcours", COLORS.lexique),
    createDocxConsigne('DOCUMENT TRANSFORMÉ', "Extrait de la notice officielle d'accueil, adapté pour une lisibilité maximale."),
    createDocxParagraph("1. Bienvenue dans votre parcours d'intégration", true, 13, COLORS.navy, 200),
    createDocxParagraph("Chaque primo-arrivant s'engage dans un parcours de formation de 80h réparties sur 25 séances de 3h.", false, 11),
    createDocxParagraph('2. Les Objectifs d\'Apprentissage', true, 13, COLORS.navy, 200),
    createDocxParagraph("La formation vise l'acquisition de repères sur la société française à travers cinq thèmes civiques.", false, 11),
    createDocxParagraph('3. Présence et Assiduité', true, 13, COLORS.navy, 200),
    createDocxParagraph('La présence à chaque séance est obligatoire et contrôlée par émargement.', false, 11)
  ];
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children }] });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Pipeline principal
// ---------------------------------------------------------------------------
async function main() {
  console.log('Génération du pack S01 v3 (validation)...');
  await mkdir(OUT_DIR, { recursive: true });
  const { data, audioMeta } = await loadData();
  data._audioMeta = audioMeta;

  const renderer = new PlaywrightRenderer();
  const deliverables = [
    { name: 'S01_FOR_FI_ALL_deroule-180min', html: getTrainerHTML(data), docxBuilder: () => buildTrainerDocx(data) },
    { name: 'S01_APP_CO_A2_fiche-activites', html: getStudentHTML(data), docxBuilder: () => buildStudentDocx(data) },
    { name: 'S01_APP_CO_ALL_dialogue-transcription', html: getDialogueHTML(data), docxBuilder: () => buildDialogueDocx(data) },
    { name: 'S01_APP_QC_ALL_qcm-tcf', html: getQcmTcfHTML(data), docxBuilder: () => buildQcmTcfDocx(data) },
    { name: 'S01_APP_QC_ALL_qcm-civique', html: getQcmCiviqueHTML(data), docxBuilder: () => buildQcmCiviqueDocx(data) },
    { name: 'S01_COR_ALL_corrige-formateur', html: getCorrigeHTML(data), docxBuilder: () => buildCorrigeDocx(data) },
    { name: 'S01_APP_LX_ALL_lexique', html: getLexiqueHTML(data), docxBuilder: () => buildLexiqueDocx(data) },
    { name: 'S01_APP_VI_ALL_support-visuel', html: getSupportVisuelHTML(data), docxBuilder: () => buildSupportVisuelDocx(data) },
    { name: 'S01_APP_CV_ALL_document-transforme', html: getDocumentTransformeHTML(), docxBuilder: () => buildDocumentTransformeDocx() }
  ];

  for (const deliv of deliverables) {
    console.log(`Rendu PDF pour ${deliv.name}...`);
    const { buffer: pdfBuffer } = await renderer.renderHtmlToPdf({ html: deliv.html, title: deliv.name, printBackground: true });
    await writeFile(join(OUT_DIR, `${deliv.name}.pdf`), pdfBuffer);
    console.log(`✓ PDF généré : ${deliv.name}.pdf`);

    const docxBuffer = await deliv.docxBuilder();
    await writeFile(join(OUT_DIR, `${deliv.name}.docx`), docxBuffer);
    console.log(`✓ DOCX généré : ${deliv.name}.docx`);
  }

  console.log('Pack S01 v3 généré dans docs/seance-1-v3-validation/');
  return { data, audioMeta, outDir: OUT_DIR };
}

export {
  main, loadData, DATA_DIR, OUT_DIR, SESSION,
  getTrainerHTML, getStudentHTML, getDialogueHTML, getQcmTcfHTML,
  getQcmCiviqueHTML, getCorrigeHTML, getLexiqueHTML, getSupportVisuelHTML, getDocumentTransformeHTML
};

const executedFilePath = process.argv[1] ? fileURLToPath(import.meta.url) : '';
if (executedFilePath && (process.argv[1] === executedFilePath || process.argv[1].endsWith('generate-s01-v3-pack.mjs'))) {
  main().catch(err => {
    console.error('Erreur globale de génération :', err);
    process.exitCode = 1;
  });
}
