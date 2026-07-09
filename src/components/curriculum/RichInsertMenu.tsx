import { Close as PopoverClose } from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import {
  BLANK_DOCUMENT_TYPES,
  SESSION_DOCUMENT_TYPE_LABELS,
  type SessionDocumentType,
} from "@/lib/curriculum/types";
import { FileText, Library, Paperclip } from "lucide-react";

export type RichInsertAction =
  | { kind: "blank"; documentType: SessionDocumentType }
  | { kind: "exercise" }
  | { kind: "file" };

export function RichInsertMenu({ onPick }: { onPick: (action: RichInsertAction) => void }) {
  return (
    <PopoverContent className="w-72 p-2" align="start">
      <div className="space-y-2">
        <div>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">
            Contenu interactif ou fichier
          </p>
          <PopoverClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() => onPick({ kind: "exercise" })}
            >
              <Library className="h-3.5 w-3.5" />
              Exercice interactif depuis la banque
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() => onPick({ kind: "file" })}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Fichier PDF, Word, image, audio ou video
            </Button>
          </PopoverClose>
        </div>

        <div className="border-t pt-2">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">
            Bloc editable
          </p>
          {BLANK_DOCUMENT_TYPES.map((type) => (
            <PopoverClose key={type} asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                onClick={() => onPick({ kind: "blank", documentType: type })}
              >
                <FileText className="h-3.5 w-3.5" />
                {SESSION_DOCUMENT_TYPE_LABELS[type]}
              </Button>
            </PopoverClose>
          ))}
        </div>
      </div>
    </PopoverContent>
  );
}
