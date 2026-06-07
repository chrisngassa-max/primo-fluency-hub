import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PEDAGOGICAL_TERMS } from "@/lib/pedagogicalTerminology";

export default function PedagogicalTerminologyHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" title="Vocabulaire pédagogique">
          <CircleHelp className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
        <p className="mb-3 font-semibold">Vocabulaire utilisé dans CAP TCF</p>
        <dl className="space-y-3 text-sm">
          {Object.values(PEDAGOGICAL_TERMS).map((term) => (
            <div key={term.label}>
              <dt className="font-medium">{term.label}</dt>
              <dd className="text-muted-foreground">{term.definition}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
