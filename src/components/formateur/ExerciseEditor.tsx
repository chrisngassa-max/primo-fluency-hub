import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Trash2, Plus } from "lucide-react";
import ItemEditor from "./ItemEditor";
import type { ExerciceDraft, ExerciceItem } from "./types";

interface Props {
  exercice: ExerciceDraft;
  index: number;
  onChange: (updated: ExerciceDraft) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onReformulateItem: (itemIndex: number, instruction?: string) => void;
  reformulatingIndex?: number | null;
  regenerating?: boolean;
}

const ExerciseEditor = ({
  exercice,
  index,
  onChange,
  onRegenerate,
  onDelete,
  onReformulateItem,
  reformulatingIndex,
  regenerating,
}: Props) => {
  const isQcm = ["qcm", "vrai_faux"].includes(exercice.format);
  const isCeOrCo = ["CE", "CO"].includes(exercice.competence);
  const isCo = exercice.competence === "CO";

  const updateItem = (itemIdx: number, updated: ExerciceItem) => {
    const items = [...exercice.contenu.items];
    items[itemIdx] = updated;
    onChange({ ...exercice, contenu: { ...exercice.contenu, items } });
  };

  const deleteItem = (itemIdx: number) => {
    const items = [...exercice.contenu.items];
    items.splice(itemIdx, 1);
    onChange({ ...exercice, contenu: { ...exercice.contenu, items } });
  };

  const addItem = () => {
    const newItem: ExerciceItem = {
      question: "",
      options: isQcm ? ["", "", ""] : undefined,
      bonne_reponse: "",
      explication: "",
    };
    onChange({
      ...exercice,
      contenu: { ...exercice.contenu, items: [...exercice.contenu.items, newItem] },
    });
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Exercice {index + 1}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating} className="gap-1">
              <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} /> Régénérer
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive gap-1">
              <Trash2 className="h-3 w-3" /> Supprimer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Titre</Label>
          <Input
            value={exercice.titre}
            onChange={(e) => onChange({ ...exercice, titre: e.target.value })}
            className="text-base"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Consigne</Label>
          <Textarea
            value={exercice.consigne}
            onChange={(e) => onChange({ ...exercice, consigne: e.target.value })}
            rows={2}
            className="text-base"
          />
        </div>

        {isCeOrCo && (
          <div>
            <Label className="text-sm font-medium">Texte support</Label>
            <Textarea
              value={exercice.contenu.texte || ""}
              onChange={(e) =>
                onChange({ ...exercice, contenu: { ...exercice.contenu, texte: e.target.value } })
              }
              rows={6}
              className="text-base"
            />
          </div>
        )}

        {isCo && (
          <div>
            <Label className="text-sm font-medium">Script audio (lu par la synthèse vocale)</Label>
            <Textarea
              value={exercice.contenu.script_audio || ""}
              onChange={(e) =>
                onChange({ ...exercice, contenu: { ...exercice.contenu, script_audio: e.target.value } })
              }
              rows={4}
              className="text-base"
            />
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-medium">Questions ({exercice.contenu.items.length})</Label>
          {exercice.contenu.items.map((item, i) => (
            <ItemEditor
              key={i}
              item={item}
              index={i}
              isQcm={isQcm}
              onChange={(updated) => updateItem(i, updated)}
              onDelete={() => deleteItem(i)}
              onReformulate={(instr) => onReformulateItem(i, instr)}
              reformulating={reformulatingIndex === i}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
            <Plus className="h-4 w-4" /> Ajouter une question
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExerciseEditor;
