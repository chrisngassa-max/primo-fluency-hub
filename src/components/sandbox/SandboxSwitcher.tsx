import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SandboxLevel } from "@/contexts/SandboxContext";
import { useSandboxPreview } from "@/contexts/SandboxPreviewContext";

const LEVELS: SandboxLevel[] = ["A1", "A2", "B1", "B2"];

export default function SandboxSwitcher() {
  const { mode, niveau, enterStudentPreview } = useSandboxPreview();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <UserRound className="mr-2 h-4 w-4" />
          Basculer vers un élève
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {LEVELS.map((item) => (
          <DropdownMenuItem
            key={item}
            disabled={mode === "eleve" && niveau === item}
            onSelect={() => enterStudentPreview(item)}
          >
            Élève Test {item}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
