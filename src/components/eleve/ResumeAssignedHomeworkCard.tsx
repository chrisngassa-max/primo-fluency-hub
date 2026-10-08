import { Link } from "react-router-dom";
import type { AssignedHomeworkResume } from "../../../supabase/functions/_shared/assistant-pedagogique/assigned-homework.ts";
import { HOMEWORK_UUID } from "../../../supabase/functions/_shared/assistant-pedagogique/assigned-homework.ts";

const ALLOWED_RESUME = /^\/eleve\/devoirs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

type Props = {
  resume: AssignedHomeworkResume;
};

export default function ResumeAssignedHomeworkCard({ resume }: Props) {
  if (resume.status === "empty" || resume.status === "ambiguous") {
    return (
      <section
        className="rounded-2xl border border-[#d7dbe7] bg-white p-4 shadow-sm"
        aria-label="Reprendre une activité"
      >
        <p className="text-base font-semibold text-[#0b234a]">{resume.message}</p>
      </section>
    );
  }

  const allowed = ALLOWED_RESUME.test(resume.route) && HOMEWORK_UUID.test(resume.devoirId)
    && resume.route.endsWith(resume.devoirId);

  return (
    <section
      className="space-y-3 rounded-2xl border border-[#d7dbe7] bg-white p-4 shadow-sm"
      aria-label="Reprendre une activité"
    >
      <h2 className="text-lg font-bold text-[#0b234a]">Reprendre une activité</h2>
      {resume.reasonStudent ? (
        <p className="text-base text-[#0b234a]">{resume.reasonStudent}</p>
      ) : null}
      {allowed ? (
        <Link
          to={resume.route}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0b234a] px-4 py-3 text-base font-semibold text-white"
        >
          Reprendre cette activité
        </Link>
      ) : null}
      {resume.hasStoredAudio && resume.audioUrl ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#0b234a]">Écouter la consigne</p>
          <audio className="w-full" controls preload="none" src={resume.audioUrl} />
        </div>
      ) : null}
    </section>
  );
}
