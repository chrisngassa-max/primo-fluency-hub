import {
  HINT_BANK_ID,
  HINT_CONTRACT_VERSION,
  LOUISE_FACTS_HASH,
  LOUISE_SOURCE_ID,
  type HintBankEntry,
  type PilotLevel,
} from './types.ts';

const AUTH = '2026-09-28T00:00:00.000Z';

function entry(
  level: PilotLevel,
  exercise_id: string,
  item_id: string,
  fact_refs: string[],
  texts: [string, string, string],
): HintBankEntry {
  return {
    bank_id: HINT_BANK_ID,
    source_id: LOUISE_SOURCE_ID,
    facts_hash: LOUISE_FACTS_HASH,
    exercise_id,
    level,
    item_id,
    review_status: 'draft',
    hints: [
      { ordinal: 1, text: texts[0] },
      { ordinal: 2, text: texts[1] },
      { ordinal: 3, text: texts[2] },
    ],
    fact_refs,
    authored_at: AUTH,
    validated_at: null,
    validator: null,
    contract_version: HINT_CONTRACT_VERSION,
  };
}

const A1 = '62b06150-7942-4c41-bab9-fdba0a4d852c';
const A2 = '972e14a8-9fe1-4f3d-93d1-9a8280028c91';
const B1 = 'bcbcef25-7dcf-4e35-97dd-1fb641ab9815';
const B2 = 'cb06e39a-e914-4729-8ce4-893e7f8faeaf';

/** Banque Louise v1 — toutes les entrées restent `draft` jusqu’à validation propriétaire. */
export const LOUISE_HINTS_V1: HintBankEntry[] = [
  entry('A1', A1, 'item_01', ['fact_01'], [
    'Écoute bien le début. Le locuteur annonce le sujet de la discussion.',
    'Repère la phrase où il présente le « thème d’aujourd’hui ».',
    'Le sujet annoncé juste après « thème d’aujourd’hui » est celui qu’il faut retenir.',
  ]),
  entry('A1', A1, 'item_02', ['fact_02', 'fact_03'], [
    'Écoute les remarques sur l’âge pour commencer la musique.',
    'Concentre-toi quand le locuteur parle de l’âge et de l’apprentissage.',
    'Il dit clairement si l’âge est une condition ou non.',
  ]),
  entry('A1', A1, 'item_03', ['fact_03'], [
    'Écoute le passage sur des adultes qui commencent tard.',
    'Un instrument précis est nommé pour ces adultes.',
    'Retiens l’instrument cité juste après « apprendre de ».',
  ]),
  entry('A1', A1, 'item_04', ['fact_15', 'fact_18'], [
    'Écoute ce que le locuteur dit à propos du solfège.',
    'Il compare le solfège à un outil pour lire ce qui est écrit.',
    'Cherche à quoi servent les « outils » donnés par le solfège.',
  ]),

  entry('A2', A2, 'item_01', ['fact_01'], [
    'Écoute l’annonce du thème au début de l’extrait.',
    'Le locuteur présente clairement le sujet de la discussion.',
    'Retiens le thème annoncé avec la formule « thème d’aujourd’hui ».',
  ]),
  entry('A2', A2, 'item_02', ['fact_02'], [
    'Écoute ce qui est dit sur l’âge pour commencer.',
    'Concentre-toi sur la phrase qui parle de l’âge et de la musique.',
    'Le locuteur dit s’il faut être jeune ou non.',
  ]),
  entry('A2', A2, 'item_03', ['fact_03'], [
    'Écoute le passage sur des adultes qui commencent après quarante ans.',
    'Un instrument précis est nommé pour ces adultes.',
    'Retiens l’instrument cité juste après « apprendre de ».',
  ]),
  entry('A2', A2, 'item_04', ['fact_08', 'fact_09', 'fact_10'], [
    'Écoute les façons de jouer avec d’autres personnes.',
    'Plusieurs possibilités de pratique collective sont listées.',
    'Le locuteur propose plus d’une manière de jouer en groupe.',
  ]),
  entry('A2', A2, 'item_05', ['fact_15', 'fact_18'], [
    'Écoute la définition du solfège.',
    'Le locuteur explique à quoi sert cet apprentissage.',
    'Relie le solfège à la lecture de ce qui est écrit en musique.',
  ]),
  entry('A2', A2, 'item_06', ['fact_28'], [
    'Écoute les avantages mentionnés vers la fin.',
    'Un effet positif sur la durée de la vie est évoqué.',
    'Repère la phrase sur l’« espérance de vie ».',
  ]),

  entry('B1', B1, 'item_01', ['fact_01', 'fact_02', 'fact_29'], [
    'Écoute l’ensemble : thème annoncé, âge et invitation finale.',
    'Le discours parle d’apprendre la musique à différents moments de la vie.',
    'Relie les difficultés évoquées et les aspects positifs de cet apprentissage.',
  ]),
  entry('B1', B1, 'item_02', ['fact_04', 'fact_05', 'fact_06', 'fact_07'], [
    'Écoute pourquoi ces adultes sont félicités.',
    'Le locuteur explique ce qui rend cet apprentissage plus exigeant.',
    'Il compare la facilité d’apprentissage chez l’enfant et chez l’adulte.',
  ]),
  entry('B1', B1, 'item_03', ['fact_08', 'fact_09', 'fact_10'], [
    'Écoute la liste des façons de jouer avec d’autres.',
    'Plusieurs structures ou groupes sont proposés.',
    'Le locuteur en cite trois, pas une seule.',
  ]),
  entry('B1', B1, 'item_04', ['fact_15', 'fact_16', 'fact_18', 'fact_19'], [
    'Écoute ce qui est indispensable pour jouer exactement ce qui est écrit.',
    'Le locuteur insiste sur un apprentissage avant de lire le texte musical.',
    'Relie cet apprentissage à la capacité de jouer le texte écrit, pas l’imaginé.',
  ]),
  entry('B1', B1, 'item_05', ['fact_14', 'fact_21', 'fact_22', 'fact_23'], [
    'Écoute le ton du locuteur quand il parle du solfège.',
    'Il exprime à la fois une difficulté et une obligation.',
    'Retiens qu’il trouve cela pénible, mais qu’on ne peut pas l’éviter.',
  ]),
  entry('B1', B1, 'item_06', ['fact_11', 'fact_13', 'fact_20'], [
    'Écoute ce que le locuteur présente comme l’objectif de la pratique.',
    'Il parle d’un moment partagé avec d’autres personnes.',
    'L’objectif final évoqué concerne un moment avec d’autres personnes.',
  ]),

  entry('B2', B2, 'item_01', ['fact_02', 'fact_03', 'fact_04', 'fact_05', 'fact_06', 'fact_07'], [
    'Écoute le passage sur les adultes qui commencent tard.',
    'Le locuteur mêle difficulté et respect pour ces personnes.',
    'Il souligne à la fois l’effort demandé et le mérite de se lancer.',
  ]),
  entry('B2', B2, 'item_02', ['fact_11', 'fact_12', 'fact_13', 'fact_20'], [
    'Écoute ce vers quoi mène la pratique selon le locuteur.',
    'Il valorise fortement un moment avec d’autres personnes.',
    'Cette étape finale est présentée comme particulièrement souhaitable.',
  ]),
  entry('B2', B2, 'item_03', ['fact_14', 'fact_15', 'fact_18', 'fact_19', 'fact_21', 'fact_22', 'fact_23'], [
    'Écoute le ton du locuteur sur le solfège.',
    'Il exprime une gêne, puis une nécessité.',
    'Selon lui, cela déplaît, mais on est obligé d’y passer pour jouer ce qui est écrit.',
  ]),
  entry('B2', B2, 'item_04', ['fact_08', 'fact_09', 'fact_10'], [
    'Écoute les trois façons de pratiquer mentionnées.',
    'Compare le cadre organisé et la formule plus libre.',
    'Cherche l’option où l’on constitue soi-même un ensemble après un temps seul.',
  ]),
  entry('B2', B2, 'item_05', ['fact_02', 'fact_27', 'fact_28', 'fact_29'], [
    'Écoute la conclusion et l’invitation finale.',
    'Le locuteur pousse clairement à se mettre à la musique.',
    'Il insiste aussi sur le fait que l’âge n’est pas un obstacle.',
  ]),
];

export function findLouiseHintEntry(
  exerciseId: string,
  itemId: string,
  bank: readonly HintBankEntry[] = LOUISE_HINTS_V1,
): HintBankEntry | undefined {
  return bank.find((row) => row.exercise_id === exerciseId && row.item_id === itemId);
}
