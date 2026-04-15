import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Bot, Plus } from "lucide-react";
import type { ExerciceItem } from "./types";

interface Props {
  item: ExerciceItem;
  index: number;
  isQcm: boolean;
  onChange: (updated: ExerciceItem) => void;
  onDelete: () => void;
  onReformulate: (instruction?: string) => void;
  reformulating?: boolean;
}

const ItemEditor = ({ item, index, isQcm, onChange, onDelete, onReformulate, reformulating }: Props) => {
  const [instruction, setInstruction] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const updateOption = (optIdx: number, value: string) => {
    const options = [...(item.options || [])];
    options[optIdx] = value;
    onChange({ ...item, options });
  };

  const addOption = () => {
    onChange({ ...item, options: [...(item.options || []), ""] });
  };

  const removeOption = (optIdx: number) => {
    const options = [...(item.options || [])];
    options.splice(optIdx, 1);
    onChange({ ...item, options });
  };

  const setCorrectAnswer = (optIdx: number) => {
    const options = item.options || [];
    onChange({ ...item, bonne_reponse: options[optIdx] || "" });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">Question n°{index + 1}</span>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive h-8">
          <Trash2 className="h-4 w-4 mr-1" /> Supprimer
        </Button>
      </div>

      <Input
        value={item.question}
        onChange={(e) => onChange({ ...item, question: e.target.value })}
        placeholder="Question…"
        className="text-base"
      />

      {isQcm ? (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Options (cochez la bonne réponse)</Label>
          {(item.options || []).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <Checkbox
                checked={item.bonne_reponse === opt && opt !== ""}
                onCheckedChange={() => setCorrectAnswer(oi)}
              />
              <Input
                value={opt}
                onChange={(e) => updateOption(oi, e.target.value)}
                placeholder={`Option ${oi + 1}`}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOption(oi)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOption} className="gap-1">
            <Plus className="h-3 w-3" /> Option
          </Button>
        </div>
      ) : (
        <div>
          <Label className="text-xs text-muted-foreground">Bonne réponse</Label>
          <Input
            value={item.bonne_reponse}
            onChange={(e) => onChange({ ...item, bonne_reponse: e.target.value })}
            placeholder="Bonne réponse…"
          />
        </div>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Explication (affichée après correction)</Label>
        <Textarea
          value={item.explication || ""}
          onChange={(e) => onChange({ ...item, explication: e.target.value })}
          placeholder="Explication courte…"
          rows={2}
        />
      </div>

      <div className="flex justify-end">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={reformulating} className="gap-1">
              {reformulating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
              Reformuler avec l'IA
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3">
            <Label className="text-sm font-medium">Instruction (optionnel)</Label>
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ex: rends-le plus facile…"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={reformulating}
              onClick={() => {
                onReformulate(instruction || undefined);
                setPopoverOpen(false);
                setInstruction("");
              }}
            >
              {reformulating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Reformuler
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default ItemEditor;
