import { useEffect, useState } from "react";
import { Award, Loader2, Lock, Unlock, User } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CEFR_LEVELS, lowestBaselineLevel, type StudentBaselineLevels,
} from "@/lib/studentLevelBaseline";

export type NiveauCECRL = "A0" | "A1" | "A2" | "B1" | "B2";

export type ProfilLitteratie =
  | "FLE"        // anciennement "standard"
  | "Post-Alpha"
  | "Alpha"      // anciennement "faible_litteratie"
  | "NSA"
  | "inconnu";

export type AlphabetL1 = "Latin" | "Arabe" | "Cyrillique" | "Autre";

export type ProfilNiveaux = {
  id: string;
  niveau_co: NiveauCECRL;
  niveau_ce: NiveauCECRL;
  niveau_ee: NiveauCECRL;
  niveau_eo: NiveauCECRL;
  niveau_locked: boolean;
  niveau_source?: string | null;
  niveau_reference_date?: string | null;
  niveau_reference_note?: string | null;
  profil_litteratie: ProfilLitteratie;
  alphabet_l1: AlphabetL1 | null;
};

type Props = {
  profil: ProfilNiveaux;
  onUpdate: (patch: Partial<ProfilNiveaux>) => void;
  onSetBaseline?: (input: {
    levels: StudentBaselineLevels;
    referenceDate: string;
    note: string;
  }) => Promise<void>;
};

const COMPETENCES: Array<{ key: "co" | "ce" | "ee" | "eo"; label: string }> = [
  { key: "co", label: "Comp. Orale" },
  { key: "ce", label: "Comp. Écrite" },
  { key: "ee", label: "Expr. Écrite" },
  { key: "eo", label: "Expr. Orale" },
];

const NIVEAUX: NiveauCECRL[] = [...CEFR_LEVELS];

const PROFILS_LITTERATIE: Array<{ value: ProfilLitteratie; label: string }> = [
  { value: "FLE", label: "FLE scolarisé" },
  { value: "Post-Alpha", label: "Post-Alpha" },
  { value: "Alpha", label: "Alpha (en cours)" },
  { value: "NSA", label: "NSA (non scripteur adulte)" },
  { value: "inconnu", label: "Inconnu" },
];

const ALPHABETS_L1: Array<{ value: AlphabetL1; label: string }> = [
  { value: "Latin", label: "Latin" },
  { value: "Arabe", label: "Arabe" },
  { value: "Cyrillique", label: "Cyrillique" },
  { value: "Autre", label: "Autre / Inconnu" },
];

// Rétrocompatibilité lecture : les anciens profils binaires sont remappés.
// La valeur est réécrite vers la nouvelle nomenclature au prochain save.
export function normalizeProfilLitteratie(raw: unknown): ProfilLitteratie {
  if (raw === "standard") return "FLE";
  if (raw === "faible_litteratie") return "Alpha";
  if (
    raw === "FLE" || raw === "Post-Alpha" || raw === "Alpha" ||
    raw === "NSA" || raw === "inconnu"
  ) {
    return raw;
  }
  return "inconnu";
}

export function NiveauEleveEditor({ profil, onUpdate, onSetBaseline }: Props) {
  const [data, setData] = useState<ProfilNiveaux>(profil);
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineLevels, setBaselineLevels] = useState<StudentBaselineLevels>({
    co: profil.niveau_co,
    ce: profil.niveau_ce,
    ee: profil.niveau_ee,
    eo: profil.niveau_eo,
  });
  const [referenceDate, setReferenceDate] = useState(
    profil.niveau_reference_date ?? new Date().toISOString().slice(0, 10),
  );
  const [referenceNote, setReferenceNote] = useState(profil.niveau_reference_note ?? "");

  useEffect(() => {
    setData(profil);
    setBaselineLevels({
      co: profil.niveau_co,
      ce: profil.niveau_ce,
      ee: profil.niveau_ee,
      eo: profil.niveau_eo,
    });
    setReferenceDate(profil.niveau_reference_date ?? new Date().toISOString().slice(0, 10));
    setReferenceNote(profil.niveau_reference_note ?? "");
  }, [profil]);

  const apply = <K extends keyof ProfilNiveaux>(field: K, value: ProfilNiveaux[K]) => {
    const next = { ...data, [field]: value };
    setData(next);
    onUpdate({ [field]: value });
  };

  const locked = data.niveau_locked;
  const officialBaseline = data.niveau_source === "tcf_irn_officiel";

  const setGlobalBaselineLevel = (level: NiveauCECRL) => {
    setBaselineLevels({ co: level, ce: level, ee: level, eo: level });
  };

  const saveBaseline = async () => {
    if (!onSetBaseline || !referenceDate) return;
    setSavingBaseline(true);
    try {
      await onSetBaseline({ levels: baselineLevels, referenceDate, note: referenceNote });
      setData((current) => ({
        ...current,
        niveau_co: baselineLevels.co,
        niveau_ce: baselineLevels.ce,
        niveau_ee: baselineLevels.ee,
        niveau_eo: baselineLevels.eo,
        niveau_locked: true,
        niveau_source: "tcf_irn_officiel",
        niveau_reference_date: referenceDate,
        niveau_reference_note: referenceNote,
      }));
      setBaselineOpen(false);
    } finally {
      setSavingBaseline(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="font-medium text-base flex items-center gap-2">
          <User className="w-4 h-4" /> Niveaux par compétence
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => apply("niveau_locked", !locked)}
          className={locked ? "text-amber-600 hover:text-amber-700" : "text-gray-400 hover:text-gray-600"}
        >
          {locked ? <Lock className="w-4 h-4 mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}
          {locked ? "Verrouillé" : "Déverrouillé"}
        </Button>
      </div>

      {officialBaseline && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-medium">Base de départ : résultat officiel TCF IRN</p>
          <p className="mt-1 text-xs">
            Référence du {data.niveau_reference_date
              ? new Date(`${data.niveau_reference_date}T12:00:00`).toLocaleDateString("fr-FR")
              : "jour de saisie"}. Les adaptations repartent de ces niveaux.
          </p>
        </div>
      )}

      {onSetBaseline && (
        <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setBaselineOpen(true)}>
          <Award className="h-4 w-4" />
          Définir une nouvelle base TCF IRN
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {COMPETENCES.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="uppercase text-[10px] font-semibold tracking-wider text-gray-500">
              {label}
            </Label>
            <Select
              disabled={locked}
              value={data[`niveau_${key}`]}
              onValueChange={(val) =>
                apply(`niveau_${key}` as keyof ProfilNiveaux, val as NiveauCECRL)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NIVEAUX.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t space-y-1">
        <Label className="text-sm">Profil de littératie</Label>
        <p className="text-[11px] text-gray-500 leading-tight">
          Pilote l'étayage, les formats interdits et les supports obligatoires côté génération.
        </p>
        <Select
          disabled={locked}
          value={data.profil_litteratie}
          onValueChange={(val) => apply("profil_litteratie", val as ProfilLitteratie)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFILS_LITTERATIE.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2 border-t space-y-2">
        <Label className="text-sm">Alphabet de la langue première (L1)</Label>
        <p className="text-[11px] text-gray-500 leading-tight">
          Système d'écriture d'origine, utile pour adapter le transfert graphique.
        </p>
        <RadioGroup
          disabled={locked}
          value={data.alphabet_l1 ?? ""}
          onValueChange={(val) => apply("alphabet_l1", val as AlphabetL1)}
          className="flex flex-wrap gap-x-4 gap-y-2"
        >
          {ALPHABETS_L1.map((a) => (
            <div key={a.value} className="flex items-center gap-1.5">
              <RadioGroupItem value={a.value} id={`alphabet-${a.value}`} />
              <Label htmlFor={`alphabet-${a.value}`} className="text-sm font-normal cursor-pointer">
                {a.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Dialog open={baselineOpen} onOpenChange={setBaselineOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle base de départ TCF IRN</DialogTitle>
            <DialogDescription>
              Les prochains exercices utiliseront ces niveaux. Les anciens résultats restent archivés,
              mais ne piloteront plus les adaptations après cette nouvelle référence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Niveau identique pour les quatre compétences</Label>
              <Select value={lowestBaselineLevel(baselineLevels)} onValueChange={(value) => setGlobalBaselineLevel(value as NiveauCECRL)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIVEAUX.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {COMPETENCES.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Select
                    value={baselineLevels[key]}
                    onValueChange={(value) => setBaselineLevels((current) => ({
                      ...current,
                      [key]: value as NiveauCECRL,
                    }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NIVEAUX.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tcf-reference-date">Date du résultat TCF IRN</Label>
              <Input
                id="tcf-reference-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={referenceDate}
                onChange={(event) => setReferenceDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tcf-reference-note">Référence ou commentaire (optionnel)</Label>
              <Textarea
                id="tcf-reference-note"
                value={referenceNote}
                onChange={(event) => setReferenceNote(event.target.value)}
                placeholder="Ex. attestation France Éducation international, session de mai 2026"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBaselineOpen(false)} disabled={savingBaseline}>
              Annuler
            </Button>
            <Button onClick={saveBaseline} disabled={savingBaseline || !referenceDate}>
              {savingBaseline && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Utiliser comme nouvelle base
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
