import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface PointAMaitriser {
  id: string;
  nom: string;
  description: string | null;
  niveau_min: string;
  niveau_max: string;
  ordre: number;
  sous_section_id: string;
}

export interface SousSection {
  id: string;
  nom: string;
  description: string | null;
  ordre: number;
  epreuve_id: string;
  points_a_maitriser: PointAMaitriser[];
}

export interface Epreuve {
  id: string;
  competence: string;
  nom: string;
  description: string | null;
  ordre: number;
  sous_sections: SousSection[];
}

async function fetchSkillTree(): Promise<Epreuve[]> {
  const { data: epreuves, error: e1 } = await supabase
    .from("epreuves")
    .select("*")
    .order("ordre");
  if (e1) throw e1;

  const { data: sousSections, error: e2 } = await supabase
    .from("sous_sections")
    .select("*")
    .order("ordre");
  if (e2) throw e2;

  const { data: points, error: e3 } = await supabase
    .from("points_a_maitriser")
    .select("*")
    .order("ordre");
  if (e3) throw e3;

  // Build the tree
  const ssMap = new Map<string, SousSection>();
  for (const ss of (sousSections ?? [])) {
    ssMap.set(ss.id, { ...ss, points_a_maitriser: [] } as SousSection);
  }

  for (const p of (points ?? [])) {
    const ss = ssMap.get(p.sous_section_id);
    if (ss) ss.points_a_maitriser.push(p as PointAMaitriser);
  }

  return (epreuves ?? []).map((ep: any) => ({
    ...ep,
    sous_sections: Array.from(ssMap.values()).filter((ss) => ss.epreuve_id === ep.id),
  })) as Epreuve[];
}

export function useSkillTree() {
  return useQuery({
    queryKey: ["skill-tree"],
    queryFn: fetchSkillTree,
    staleTime: 5 * 60 * 1000,
  });
}
