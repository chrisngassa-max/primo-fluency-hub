import type { NiveauCECRL, ProfilLitteratie } from "./NiveauEleveEditor";

const BADGE_COLORS: Record<NiveauCECRL, string> = {
  A0: "bg-red-100 text-red-800",
  A1: "bg-orange-100 text-orange-800",
  A2: "bg-yellow-100 text-yellow-800",
  B1: "bg-green-100 text-green-800",
  B2: "bg-blue-100 text-blue-800",
};

export function NiveauBadge({ niveau }: { niveau: string }) {
  const color = BADGE_COLORS[niveau as NiveauCECRL] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>
      {niveau}
    </span>
  );
}

export type EleveAvecNiveaux = {
  id: string;
  prenom: string;
  nom: string;
  niveau_co: NiveauCECRL;
  niveau_ce: NiveauCECRL;
  niveau_ee: NiveauCECRL;
  niveau_eo: NiveauCECRL;
  profil_litteratie: ProfilLitteratie;
};

const COMPETENCES = ["co", "ce", "ee", "eo"] as const;

export function LigneEleveNiveaux({ eleve }: { eleve: EleveAvecNiveaux }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b last:border-0 hover:bg-gray-50 transition-colors">
      <div className="font-medium text-sm flex items-center gap-2">
        {eleve.prenom} {eleve.nom}
        {eleve.profil_litteratie === "faible_litteratie" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold uppercase tracking-wide">
            Littératie
          </span>
        )}
      </div>
      <div className="flex gap-4">
        {COMPETENCES.map((comp) => (
          <div key={comp} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-gray-400 font-semibold tracking-widest uppercase">
              {comp}
            </span>
            <NiveauBadge niveau={eleve[`niveau_${comp}`]} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupeNiveauxMap({ eleves }: { eleves: EleveAvecNiveaux[] }) {
  if (eleves.length === 0) return null;

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="grid grid-cols-[1fr_repeat(4,auto)] gap-x-4 px-3 py-1.5 bg-gray-50 border-b">
        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Élève</span>
        {COMPETENCES.map((c) => (
          <span key={c} className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider text-center w-10">
            {c}
          </span>
        ))}
      </div>
      {eleves.map((e) => (
        <LigneEleveNiveaux key={e.id} eleve={e} />
      ))}
    </div>
  );
}
