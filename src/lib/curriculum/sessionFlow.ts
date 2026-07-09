import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import type { ExerciseBankPreview, SessionDocument, SessionDocumentLink, SessionFlowItem } from "./types";

/**
 * Le déroulé de séance fusionne deux tables (session_documents et
 * session_document_links) dans UN SEUL espace de numérotation
 * display_order — jamais deux séquences indépendantes. Ces helpers
 * sont le seul point d'écriture de display_order : toute opération
 * (déplacer/insérer/retirer) doit passer par ici pour que les deux
 * tables restent cohérentes entre elles.
 */

export interface FlowRef {
  kind: "document" | "link";
  id: string;
  display_order: number;
}

export function toFlowRef(item: SessionFlowItem): FlowRef {
  return item.kind === "document"
    ? { kind: "document", id: item.document.id, display_order: item.display_order }
    : { kind: "link", id: item.link.id, display_order: item.display_order };
}

/** Fusionne documents + liens en une seule liste triée par display_order. */
export function buildFlowItems(
  documents: SessionDocument[],
  links: { link: SessionDocumentLink; exercise: ExerciseBankPreview | null }[],
): SessionFlowItem[] {
  const docItems: SessionFlowItem[] = documents.map((document) => ({
    kind: "document",
    display_order: document.display_order,
    audience: document.audience,
    document,
  }));
  const linkItems: SessionFlowItem[] = links.map(({ link, exercise }) => ({
    kind: "link",
    display_order: link.display_order,
    audience: link.audience,
    link,
    exercise,
  }));
  return [...docItems, ...linkItems].sort((a, b) => a.display_order - b.display_order);
}

function tableFor(kind: FlowRef["kind"]) {
  return kind === "document" ? "session_documents" : "session_document_links";
}

/** Renumérote 1..N les display_order des refs reçues, dans l'ordre donné,
 * en écrivant dans la table correspondant à chaque item (documents et/ou
 * liens mélangés). Utilisé après une insertion pour spliced un nouvel
 * élément à la bonne position dans le déroulé fusionné. */
export async function reorderSessionFlow(orderedRefs: FlowRef[]): Promise<void> {
  await Promise.all(
    orderedRefs.map((ref, index) =>
      supabase.from(tableFor(ref.kind)).update({ display_order: index + 1 }).eq("id", ref.id),
    ),
  );
}

/** Échange le display_order de deux éléments du déroulé (documents et/ou
 * liens), pour les boutons Monter/Descendre. */
export async function swapSessionFlowOrder(a: FlowRef, b: FlowRef): Promise<void> {
  await Promise.all([
    supabase.from(tableFor(a.kind)).update({ display_order: b.display_order }).eq("id", a.id),
    supabase.from(tableFor(b.kind)).update({ display_order: a.display_order }).eq("id", b.id),
  ]);
}
