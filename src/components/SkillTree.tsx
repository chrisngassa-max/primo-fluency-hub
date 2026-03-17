import { useSkillTree } from "@/hooks/useSkillTree";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Headphones, BookOpenText, PenLine, Mic, Languages, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const competenceIcons: Record<string, React.ElementType> = {
  CO: Headphones,
  CE: BookOpenText,
  EE: PenLine,
  EO: Mic,
  Structures: Languages,
};

const competenceColors: Record<string, string> = {
  CO: "bg-blue-500/10 text-blue-700 border-blue-200",
  CE: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  EE: "bg-amber-500/10 text-amber-700 border-amber-200",
  EO: "bg-purple-500/10 text-purple-700 border-purple-200",
  Structures: "bg-rose-500/10 text-rose-700 border-rose-200",
};

const SkillTree = () => {
  const { data: tree, isLoading, error } = useSkillTree();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Erreur de chargement de l'arborescence.
      </div>
    );
  }

  if (!tree?.length) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">Aucune épreuve configurée</p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-3">
      {tree.map((epreuve) => {
        const Icon = competenceIcons[epreuve.competence] || Target;
        const colorClass = competenceColors[epreuve.competence] || "";
        const totalPoints = epreuve.sous_sections.reduce(
          (acc, ss) => acc + ss.points_a_maitriser.length,
          0
        );

        return (
          <AccordionItem
            key={epreuve.id}
            value={epreuve.id}
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
              <div className="flex items-center gap-3 text-left">
                <div className={cn("p-2 rounded-lg border", colorClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-base">{epreuve.nom}</div>
                  <div className="text-sm text-muted-foreground">
                    {epreuve.sous_sections.length} sous-sections · {totalPoints} points
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <Accordion type="multiple" className="space-y-2 mt-2">
                {epreuve.sous_sections.map((ss) => (
                  <AccordionItem
                    key={ss.id}
                    value={ss.id}
                    className="border rounded-md"
                  >
                    <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline hover:bg-muted/30">
                      <div className="flex items-center gap-2 text-left">
                        <span className="font-medium">{ss.nom}</span>
                        <Badge variant="secondary" className="text-xs">
                          {ss.points_a_maitriser.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <ul className="space-y-3 mt-2">
                        {ss.points_a_maitriser.map((point) => (
                          <li key={point.id} className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {point.nom}
                                </p>
                                {point.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {point.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {point.niveau_min}–{point.niveau_max}
                                </Badge>
                              </div>
                            </div>
                            {/* Progress bar — 0% until we have real data */}
                            <Progress value={0} className="h-1.5" />
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

export default SkillTree;
