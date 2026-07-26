import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, CalendarClock, CheckCircle2, ChevronRight, GraduationCap,
  PlayCircle, Sparkles, MonitorPlay,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CompetenceLabel from "@/components/CompetenceLabel";
import SeanceLeconsList from "@/components/eleve/SeanceLeconsList";
import {
  useActiveSeances,
  useSeanceExercices,
  useSeancesLiveRefresh,
  type ExerciceStatut,
  type SeanceExercice,
} from "@/hooks/useEleveSeances";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUT_META: Record<ExerciceStatut, { label: string; badge: string; ring: string; icon: typeof BookOpen; iconWrap: string; iconColor: string }> = {
  a_faire: {
    label: "À faire",
    badge: "border-orange-500/30 text-orange-600",
    ring: "bg-orange-50 border-orange-200 hover:bg-orange-100/70",
    icon: BookOpen,
    iconWrap: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  en_cours: {
    label: "En cours",
    badge: "border-blue-500/30 text-blue-600",
    ring: "bg-blue-50 border-blue-200 hover:bg-blue-100/70",
    icon: PlayCircle,
    iconWrap: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  termine: {
    label: "Terminé",
    badge: "border-green-500/30 text-green-600",
    ring: "bg-green-50 border-green-200 hover:bg-green-100/70 opacity-90",
    icon: CheckCircle2,
    iconWrap: "bg-green-100",
    iconColor: "text-green-600",
  },
};

const MaSeance = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: seances, isLoading: loadingSeances } = useActiveSeances(user?.id);

  // Séance courante = la plus récente parmi les séances actives.
  const seance = seances?.[0] ?? null;
  const seanceIds = useMemo(() => (seances ?? []).map((s) => s.id), [seances]);

  const { data: exercices, isLoading: loadingEx } = useSeanceExercices(seance?.id ?? null, user?.id);

  // Couche temps réel : rafraîchit la liste persistée + notifie les nouveaux envois.
  useSeancesLiveRefresh(seanceIds, { notify: true });

  const openExercice = (ex: SeanceExercice) => {
    if (ex.devoirId) navigate(`/eleve/devoirs/${ex.devoirId}`);
    else if (seance) navigate(`/eleve/exercices-seance/${seance.id}`);
  };

  const list = exercices ?? [];
  const aFaire = list.filter((e) => e.statut === "a_faire");
  const enCours = list.filter((e) => e.statut === "en_cours");
  const termine = list.filter((e) => e.statut === "termine");
  const restants = aFaire.length + enCours.length;

  if (loadingSeances) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Aucune séance du jour / en cours.
  if (!seance) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Header />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <CalendarClock className="h-8 w-8 text-primary" />
          </div>
          <p className="font-semibold text-foreground">Aucune séance aujourd'hui</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Quand ton formateur lancera une séance, tes exercices apparaîtront ici.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => navigate("/eleve/mes-seances")}>
            Voir mes séances passées
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Header />

      {/* Carte séance courante */}
      <div className="rounded-2xl bg-[#0b234a] p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-widest">
          <Sparkles className="h-4 w-4" /> Séance du jour
        </div>
        <h2 className="text-xl font-extrabold mt-1.5 leading-tight">{seance.titre}</h2>
        <p className="text-sm text-white/80 mt-1">
          {seance.group_nom ? `${seance.group_nom} · ` : ""}
          {format(new Date(seance.date_seance), "EEEE d MMMM", { locale: fr })}
        </p>
        {restants > 0 ? (
          <Button
            className="mt-4 w-full bg-[#f47b20] hover:bg-[#e06d15] text-white font-bold"
            onClick={() => navigate(`/eleve/exercices-seance/${seance.id}`)}
          >
            {enCours.length > 0 ? "Continuer mes exercices" : "Commencer mes exercices"} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-green-300" /> Tous tes exercices sont faits, bravo !
          </div>
        )}
      </div>

      {/* Compteurs */}
      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat n={aFaire.length} label="À faire" className="bg-orange-500" />
          <Stat n={enCours.length} label="En cours" className="bg-blue-500" />
          <Stat n={termine.length} label="Terminés" className="bg-green-500" />
        </div>
      )}

      {/* Exercices demandés */}
      <Section title="Mes exercices interactifs" icon={<MonitorPlay className="h-4 w-4" />}>
        {loadingEx ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/30 px-4 py-5 text-center">
            <p className="text-sm font-medium text-foreground">Pas encore d'exercice</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ton formateur t'enverra des exercices pendant la séance.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {[...aFaire, ...enCours, ...termine].map((ex) => (
              <ExerciceRow key={ex.key} ex={ex} onOpen={() => openExercice(ex)} />
            ))}
          </div>
        )}
      </Section>

      {/* Leçons à conserver */}
      <Section title="Leçons à conserver" icon={<GraduationCap className="h-4 w-4" />}>
        <SeanceLeconsList sessionIds={[seance.id]} studentId={user?.id ?? ""} />
      </Section>
    </div>
  );
};

function Header() {
  return (
    <div>
      <h1 className="text-[28px] font-extrabold tracking-tight text-[#0b234a]">Ma séance</h1>
      <p className="text-muted-foreground mt-1">Tes exercices et leçons du jour, au même endroit.</p>
    </div>
  );
}

function Stat({ n, label, className }: { n: number; label: string; className: string }) {
  return (
    <div className={cn("rounded-[0.625rem] p-4 text-center shadow-sm", className)}>
      <p className="text-3xl font-extrabold text-white">{n}</p>
      <p className="text-xs font-medium text-white/90 mt-0.5">{label}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        {icon}{title}
      </h2>
      {children}
    </div>
  );
}

function ExerciceRow({ ex, onOpen }: { ex: SeanceExercice; onOpen: () => void }) {
  const meta = STATUT_META[ex.statut];
  const Icon = meta.icon;
  const dejaFait = ex.statut === "termine";
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-[0.625rem] border cursor-pointer transition-colors shadow-sm",
        meta.ring,
      )}
      onClick={onOpen}
    >
      <div className={cn("flex items-center justify-center h-10 w-10 rounded-xl shrink-0", meta.iconWrap)}>
        <Icon className={cn("h-5 w-5", meta.iconColor)} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{ex.titre}</span>
          <Badge variant="outline" className={cn("text-xs", meta.badge)}>{meta.label}</Badge>
          <Badge className="text-xs border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 gap-1">
            <MonitorPlay className="h-3 w-3" /> Interactif
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {ex.competence && (
            <Badge variant="outline" className="text-xs"><CompetenceLabel code={ex.competence} /></Badge>
          )}
          {ex.statut === "termine" && ex.score !== null && (
            <span className="text-xs font-medium text-green-600">Score : {Math.round(ex.score)}%</span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        className="shrink-0 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <PlayCircle className="h-4 w-4" />
        {dejaFait ? "Revoir" : "Tester"}
      </Button>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

export default MaSeance;
