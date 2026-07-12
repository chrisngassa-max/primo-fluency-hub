from __future__ import annotations
import json, hashlib
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from pypdf import PdfReader, PdfWriter

ROOT=Path(__file__).resolve().parents[2]
S01=ROOT/'content/curriculum/v2/S01'
OUT=ROOT/'docs/seance-1-alignee'
OUT.mkdir(parents=True,exist_ok=True)
variants=json.loads((S01/'exercices/variantes-A1-A2-B1-B2.json').read_text(encoding='utf-8'))
support=json.loads((S01/'support/support-master.json').read_text(encoding='utf-8'))
deroule=json.loads((S01/'formateur/deroule-180min.json').read_text(encoding='utf-8'))
by_level={v['niveau']:v for v in variants}
NAVY=colors.HexColor('#0B234A'); BLUE=colors.HexColor('#2563EB'); PALE=colors.HexColor('#EFF6FF'); GREEN=colors.HexColor('#047857'); GREY=colors.HexColor('#475569'); LIGHT=colors.HexColor('#E2E8F0')
pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', r'C:\Windows\Fonts\arialbd.ttf')); AMBER=colors.HexColor('#F59E0B')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCap',parent=styles['Title'],fontName='Arial-Bold',fontSize=19,leading=23,textColor=NAVY,spaceAfter=10))
styles.add(ParagraphStyle(name='H1Cap',parent=styles['Heading1'],fontName='Arial-Bold',fontSize=13,leading=16,textColor=NAVY,spaceBefore=9,spaceAfter=6))
styles.add(ParagraphStyle(name='H2Cap',parent=styles['Heading2'],fontName='Arial-Bold',fontSize=10.5,leading=13,textColor=BLUE,spaceBefore=7,spaceAfter=4))
styles.add(ParagraphStyle(name='BodyCap',parent=styles['BodyText'],fontName='Arial',fontSize=9.2,leading=12.3,textColor=colors.HexColor('#1E293B'),spaceAfter=4))
styles.add(ParagraphStyle(name='SmallCap',parent=styles['BodyText'],fontName='Arial',fontSize=7.5,leading=9.5,textColor=GREY))
styles.add(ParagraphStyle(name='CenterCap',parent=styles['BodyText'],fontName='Arial-Bold',fontSize=9,leading=11,alignment=TA_CENTER,textColor=NAVY))

def esc(x):
    return str(x).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('\n','<br/>')

def footer(canvas,doc):
    canvas.saveState(); canvas.setStrokeColor(LIGHT); canvas.line(18*mm,14*mm,192*mm,14*mm)
    canvas.setFont('Arial',7); canvas.setFillColor(GREY)
    canvas.drawString(18*mm,9*mm,'CapTCF - S01 - Famille CE S01_CE_ACCUEIL_01 - version alignée')
    canvas.drawRightString(192*mm,9*mm,f'Page {doc.page}'); canvas.restoreState()

def doc(path,title,story,subject):
    d=SimpleDocTemplate(str(path),pagesize=A4,rightMargin=17*mm,leftMargin=17*mm,topMargin=16*mm,bottomMargin=18*mm,title=title,subject=subject,author='CapTCF')
    d.build(story,onFirstPage=footer,onLaterPages=footer)

def header(title,subtitle):
    return [Paragraph('SÉANCE 1 - ACCUEIL ET PARCOURS',styles['SmallCap']),Paragraph(esc(title),styles['TitleCap']),Paragraph(esc(subtitle),styles['BodyCap']),Spacer(1,3*mm)]

def info_box(rows,widths=None):
    data=[[Paragraph(f'<b>{esc(a)}</b>',styles['BodyCap']),Paragraph(esc(b),styles['BodyCap'])] for a,b in rows]
    t=Table(data,colWidths=widths or [42*mm,125*mm],hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(0,-1),PALE),('BOX',(0,0),(-1,-1),0.7,BLUE),('INNERGRID',(0,0),(-1,-1),0.3,LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)])); return t

def facts_box():
    return [Paragraph('Support factuel commun et immuable',styles['H1Cap']),info_box([('Support',support['support_id']),('Hash des faits',support['hash']),('Faits conservés',' | '.join(support['faits']))])]

def answer_line(lines=2):
    return Table([[''] for _ in range(lines)],colWidths=[167*mm],rowHeights=[7*mm]*lines,style=TableStyle([('LINEBELOW',(0,0),(-1,-1),0.35,colors.HexColor('#94A3B8'))]))

def render_questions(v,answers=False):
    story=[]
    for i,q in enumerate(v['questions'],1):
        story.append(KeepTogether([Paragraph(f'<b>{i}. {esc(q["enonce"])}</b>',styles['BodyCap'])]))
        opts=q.get('options')
        if q['type']=='vrai_faux': opts=['Vrai','Faux']
        if opts:
            ans=str(v['corrige'].get(q['id']))
            for opt in opts:
                mark='[x] ' if answers and (str(opt)==ans or (ans=='True' and opt=='Vrai') or (ans=='False' and opt=='Faux')) else '[ ] '
                story.append(Paragraph(mark+esc(opt),styles['BodyCap']))
        elif answers:
            story.append(info_box([('Éléments attendus',str(v['corrige'].get(q['id'],'')))],widths=[38*mm,129*mm]))
        else:
            story.append(answer_line(2 if v['niveau'] in ('A1','A2') else 4))
        story.append(Spacer(1,2*mm))
    return story

def make_student(level):
    v=by_level[level]; c=v['differentiation_contract']
    story=header(f'Fiche apprenant - Niveau {level}',f'Compétence CE | Transformation {c["transformation_id"]} | même support, mêmes faits')
    story += facts_box()
    story += [Paragraph('Votre contrat de travail',styles['H1Cap']),info_box([('Objectif','Comprendre l’organisation du parcours d’Awa sans inventer de fait.'),('Opérations',', '.join(c['cognitive_operations'])),('Autonomie',c['autonomy']),('Guidage',c['guidance']),('Support',c['support_mode']),('Temps indicatif',f'{c["estimated_minutes"]} minutes - non bloquant')])]
    story += [Paragraph('Aides autorisées',styles['H1Cap'])]
    for a in v.get('aides',[]): story.append(Paragraph('- '+esc(a),styles['BodyCap']))
    story += [Paragraph('Consigne',styles['H1Cap']),info_box([('À faire',v['consigne'])]),Paragraph('Questions de compréhension',styles['H1Cap'])]
    story += render_questions(v,False)
    story += [Paragraph('Auto-vérification',styles['H1Cap']),Paragraph('[ ] J’ai conservé les nombres et les faits du support.  [ ] Je distingue un fait explicite de mon interprétation.  [ ] Je n’ai ajouté aucune information absente.',styles['BodyCap'])]
    path=OUT/f'S01_02_Fiche_{level}_CE.pdf'; doc(path,f'S01 Fiche {level} CE',story,f'Variante {level} de la famille CE S01'); return path

def make_homework(level):
    v=by_level[level]; c=v['differentiation_contract']
    story=header(f'Devoir CE - Niveau {level}',f'Consolidation de la même compétence | {c["transformation_id"]}')+facts_box()
    story += [Paragraph('Consigne',styles['H1Cap']),Paragraph(esc(v['consigne']),styles['BodyCap']),Paragraph('Travail à rendre',styles['H1Cap'])]
    selected=v['questions'][:2]
    for i,q in enumerate(selected,1):
        story.append(Paragraph(f'<b>{i}. {esc(q["enonce"])}</b>',styles['BodyCap'])); story.append(answer_line(3 if level in ('A1','A2') else 6)); story.append(Spacer(1,2*mm))
    story += [Paragraph('Règle de réussite',styles['H1Cap']),Paragraph('La réponse est évaluée en compréhension écrite. Une réponse longue ne transforme pas cette activité en expression écrite : elle sert à rendre visibles les relations comprises dans le support.',styles['BodyCap'])]
    path=OUT/f'S01_04_Devoir_{level}_CE.pdf'; doc(path,f'S01 Devoir {level} CE',story,f'Devoir CE {level}'); return path

def make_trainer():
    story=header('Déroulé formateur aligné - 180 minutes','La différenciation CE devient le centre de la phase 4 ; les prolongements EE/EO restent séparés.')
    story += [Paragraph('Principes non négociables',styles['H1Cap']),info_box([('Famille','Une seule compétence CE de A1 à B2.'),('Pivot','A2 est le cadre de référence de S01.'),('Support','Document source immuable ; annotations et segmentation autorisées.'),('Faits','Même hash dans les quatre variantes.'),('Prolongements','EE et EO sont des activités liées mais séparées, jamais des variantes CE.'),('B2','Difficulté par autonomie, implicite, précision et nuance - pas par longueur mécanique.')])]
    story += [Paragraph('Déroulé général',styles['H1Cap'])]
    rows=[[Paragraph('<b>Phase</b>',styles['BodyCap']),Paragraph('<b>Durée</b>',styles['BodyCap']),Paragraph('<b>Finalité</b>',styles['BodyCap'])]]+[[Paragraph(esc(p['phase']),styles['BodyCap']),Paragraph(str(p['duree_min'])+' min',styles['BodyCap']),Paragraph(esc(p['description']),styles['BodyCap'])] for p in deroule]
    t=Table(rows,colWidths=[42*mm,21*mm,104*mm],repeatRows=1);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),0.4,LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),5)]));story.append(t)
    story += [PageBreak(),Paragraph('Phase 4 - Atelier différencié CE (60 minutes)',styles['TitleCap']),info_box([('0-10 min','Présentation du support commun et rappel des cinq faits invariants.'),('10-35 min','Travail par niveau sur la variante publiée.'),('35-50 min','Vérification guidée avec les critères propres au niveau.'),('50-60 min','Mise en commun : ce qui change dans l’activité et ce qui ne change jamais dans les faits.')])]
    matrix=[]
    for level in ['A1','A2','B1','B2']:
        v=by_level[level];c=v['differentiation_contract'];matrix.append([level,c['transformation_id'],', '.join(c['cognitive_operations']),c['guidance'],str(len(v['questions']))])
    rows=[[Paragraph('<b>Niveau</b>',styles['SmallCap']),Paragraph('<b>Transformation</b>',styles['SmallCap']),Paragraph('<b>Opérations</b>',styles['SmallCap']),Paragraph('<b>Guidage</b>',styles['SmallCap']),Paragraph('<b>Items</b>',styles['SmallCap'])]]+[[Paragraph(esc(x),styles['SmallCap']) for x in row] for row in matrix]
    t=Table(rows,colWidths=[15*mm,30*mm,69*mm,32*mm,18*mm]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),0.4,LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),4)]));story.append(t)
    story += [Paragraph('Conduite par niveau',styles['H1Cap'])]
    for level in ['A1','A2','B1','B2']:
        v=by_level[level];c=v['differentiation_contract']; story += [Paragraph(f'{level} - {c["transformation_id"]}',styles['H2Cap']),Paragraph(esc(v['consigne']),styles['BodyCap']),Paragraph('<b>Aides :</b> '+esc(' | '.join(v['aides'])),styles['BodyCap'])]
    story += [Paragraph('Prolongements séparés (30 minutes)',styles['H1Cap']),Paragraph('<b>EO :</b> présenter oralement son objectif administratif. <b>EE :</b> rédiger une courte présentation personnelle. Ces productions possèdent leur propre objectif, leurs propres critères et ne sont pas comptées comme variantes de la famille CE.',styles['BodyCap'])]
    path=OUT/'S01_01_Deroule_formateur_aligne.pdf';doc(path,'S01 Déroulé formateur aligné',story,'Déroulé 180 minutes aligné sur le moteur de différenciation');return path

def make_guide():
    story=header('Guide visuel de la transformation pédagogique','Ce document permet de comparer concrètement A1, A2, B1 et B2 à partir du même exercice CE.')+facts_box()
    story += [Paragraph('Ce qui reste identique',styles['H1Cap']),Paragraph('Compétence CE, objectif de compréhension, support S01-support-accueil, cinq faits invariants et famille S01_CE_ACCUEIL_01.',styles['BodyCap']),Paragraph('Ce qui est transformé',styles['H1Cap'])]
    rows=[]
    for level in ['A1','A2','B1','B2']:
        v=by_level[level];c=v['differentiation_contract'];rows.append([level,c['transformation_id'],', '.join(c['cognitive_operations']),c['autonomy'],c['guidance'],v['consigne']])
    data=[[Paragraph('<b>Niv.</b>',styles['SmallCap']),Paragraph('<b>Règle</b>',styles['SmallCap']),Paragraph('<b>Opérations</b>',styles['SmallCap']),Paragraph('<b>Autonomie</b>',styles['SmallCap']),Paragraph('<b>Aide</b>',styles['SmallCap']),Paragraph('<b>Consigne</b>',styles['SmallCap'])]]+[[Paragraph(esc(x),styles['SmallCap']) for x in row] for row in rows]
    t=Table(data,colWidths=[11*mm,25*mm,36*mm,21*mm,20*mm,54*mm],repeatRows=1);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),0.4,LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),4)]));story.append(t)
    story += [PageBreak(),Paragraph('Exemples réels par niveau',styles['TitleCap'])]
    for level in ['A1','A2','B1','B2']:
        v=by_level[level]; story += [Paragraph(f'Niveau {level}',styles['H1Cap']),info_box([('Consigne',v['consigne']),('Aides',' | '.join(v['aides'])),('Exemple de tâche',v['questions'][0]['enonce'])])]
    story += [Paragraph('Variante ou prolongement ?',styles['H1Cap']),info_box([('Variante interne','Reste en CE et transforme seulement l’accès, les opérations, le guidage et l’autonomie.'),('Prolongement lié','Change de compétence vers EE ou EO ; possède un identifiant séparé et ne remplace aucune variante CE.')])]
    path=OUT/'S01_00_Guide_transformation_differenciation.pdf';doc(path,'S01 Guide de transformation',story,'Comparaison concrète des variantes CE');return path

def make_answers():
    story=header('Corrigé formateur - Famille CE','Éléments attendus strictement fondés sur le support commun.')+facts_box()
    for level in ['A1','A2','B1','B2']:
        v=by_level[level];story += [Paragraph(f'Niveau {level} - {v["differentiation_contract"]["transformation_id"]}',styles['H1Cap'])];story += render_questions(v,True)
    story += [Paragraph('Contrôle de divergence',styles['H1Cap']),Paragraph('Rejeter toute réponse qui modifie un fait invariant ou attribue à E1/E2 une fonction non établie par le support. Une interprétation B2 est recevable seulement si elle est explicitement présentée comme interprétation.',styles['BodyCap'])]
    path=OUT/'S01_03_Corrige_formateur_CE.pdf';doc(path,'S01 Corrigé CE',story,'Corrigé des quatre variantes CE');return path

files=[make_guide(),make_trainer()]
for level in ['A1','A2','B1','B2']: files.append(make_student(level))
files.append(make_answers())
for level in ['A1','A2','B1','B2']: files.append(make_homework(level))
def merge_pdfs(target, sources):
    writer=PdfWriter()
    for source in sources:
        reader=PdfReader(source)
        for page in reader.pages: writer.add_page(page)
    with target.open('wb') as handle: writer.write(handle)
    return target

trainer_pack=merge_pdfs(OUT/'S01_10_Pack_formateur_complet.pdf',[files[0],files[1],files[6]])
student_pack=merge_pdfs(OUT/'S01_11_Pack_apprenant_A1_B2.pdf',files[2:6])
files.extend([trainer_pack,student_pack])

index=['# Paquet S01 aligné sur la politique de différenciation','',f'Généré à partir de `{S01.relative_to(ROOT)}`.','', '## Documents']+[f'- [{p.name}]({p.name})' for p in files]+['','## Invariants','',f'- Famille : `S01_CE_ACCUEIL_01`',f'- Compétence : `CE` de A1 à B2',f'- Pivot : `A2`',f'- Hash des faits : `{support["hash"]}`','- Les productions EE/EO restent des prolongements séparés.']
(OUT/'README.md').write_text('\n'.join(index)+'\n',encoding='utf-8')
for p in files: print(f'{p.relative_to(ROOT)}\t{p.stat().st_size}')