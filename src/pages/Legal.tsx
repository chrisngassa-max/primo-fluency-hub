const Legal = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-foreground">
          Mentions légales & Politique de confidentialité
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Version v1.0 — captcf.fr</p>
      </header>

      {/* ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Éditeur</h2>
        <p className="text-muted-foreground">
          <strong>CAP TCF</strong> — Application de préparation à la certification TCF IRN
          (Test de Connaissance du Français — Intégration, Résidence et Nationalité)
          destinée aux apprenants FLE et aux formateurs.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. Hébergement</h2>
        <p className="text-muted-foreground">
          Application hébergée sur Lovable Cloud (infrastructure Supabase, UE).
        </p>
      </section>

      {/* ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Usage obligatoire de l'IA et de la voix</h2>
        <p className="text-muted-foreground">
          Le traitement IA et le traitement vocal sont nécessaires à l'exécution de la
          formation sur captcf.fr. Sans ces traitements, la formation ne peut pas être
          suivie sur la plateforme.
        </p>
        <div>
          <h3 className="font-medium">L'IA est utilisée pour :</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>corriger les exercices ;</li>
            <li>analyser les réponses ;</li>
            <li>suivre la progression ;</li>
            <li>générer ou adapter les devoirs ;</li>
            <li>permettre la pédagogie différenciée ;</li>
            <li>préparer des bilans ;</li>
            <li>aider le formateur à organiser les séances.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium">La voix de l'apprenant est utilisée pour :</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>les exercices d'expression orale ;</li>
            <li>l'enregistrement des réponses orales ;</li>
            <li>la transcription audio ;</li>
            <li>la correction orale ;</li>
            <li>le suivi de progression en expression orale.</li>
          </ul>
        </div>
        <p className="text-muted-foreground">
          <strong>Sans consentement IA et voix, la formation ne peut pas être suivie sur la plateforme.</strong>
        </p>
      </section>

      {/* ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Fournisseurs IA</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>Lovable AI Gateway (modèles Google Gemini, OpenAI GPT) ;</li>
          <li>Google Generative Language ;</li>
          <li>Google Cloud Speech-to-Text (transcription audio) ;</li>
          <li>Google Cloud Text-to-Speech (lecture vocale des consignes) ;</li>
          <li>Anthropic Claude (génération et révision d'exercices).</li>
        </ul>
      </section>

      {/* ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Données traitées</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>identifiants de compte (email, prénom, nom) ;</li>
          <li>réponses aux exercices, scores, statistiques de progression ;</li>
          <li>fichiers audio enregistrés par l'apprenant ;</li>
          <li>transcriptions générées à partir de ces fichiers audio ;</li>
          <li>corrections et analyses associées (textuelles ou orales) ;</li>
          <li>journaux techniques d'appels IA (sans contenu brut).</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          Avant envoi aux fournisseurs IA, les noms, prénoms, emails et identifiants
          sont pseudonymisés (HMAC déterministe avec secret serveur).
        </p>
      </section>

      {/* ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Finalités</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>évaluer l'expression orale et écrite ;</li>
          <li>suivre la progression pédagogique ;</li>
          <li>permettre au formateur de réécouter les réponses orales ;</li>
          <li>permettre à l'IA de corriger ou analyser les réponses ;</li>
          <li>préparer les bilans de séance et les devoirs personnalisés.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Accès aux données audio</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>seul le formateur responsable peut consulter les fichiers audio de ses apprenants ;</li>
          <li>seul le formateur responsable peut consulter les transcriptions ;</li>
          <li>aucun autre apprenant ne peut accéder à ces données.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Conservation</h2>
        <p className="text-muted-foreground">
          Les fichiers audio, transcriptions et données IA sont conservés pendant la
          durée de la formation, puis jusqu'à 12 mois après la fin de la formation,
          sauf demande d'effacement anticipée.
        </p>
      </section>

      {/* ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Vos droits (RGPD)</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>droit d'accès à vos données ;</li>
          <li>droit de rectification ;</li>
          <li>droit d'effacement (audio, transcriptions, journaux IA) ;</li>
          <li>droit de retirer votre consentement à tout moment.</li>
        </ul>
        <p className="text-muted-foreground">
          Pour exercer ces droits ou demander l'effacement de vos données IA, fichiers
          audio, transcriptions et logs associés : <strong>contact@tcfpro.fr</strong>.
        </p>
        <p className="text-muted-foreground text-sm">
          Conséquence du refus ou du retrait : sans consentement IA et voix, la
          formation ne peut pas être suivie sur la plateforme. L'accès aux exercices,
          devoirs, corrections, bilans, progression, séances, parcours et expression
          orale est désactivé.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">10. Cookies</h2>
        <p className="text-muted-foreground">
          L'application utilise uniquement des cookies techniques nécessaires à
          l'authentification. Aucun cookie publicitaire ou de tracking n'est utilisé.
        </p>
      </section>

      {/* ──────────────────────────────────────────────────── */}
      <section className="space-y-3 border-t pt-8">
        <h2 className="text-xl font-semibold">Version simplifiée (A1)</h2>
        <div className="rounded-md bg-muted p-4 text-foreground space-y-2 leading-relaxed">
          <p>Cette formation utilise une IA.</p>
          <p>L'IA corrige tes exercices et prépare ton travail.</p>
          <p>Pour les exercices à l'oral, tu dois enregistrer ta voix.</p>
          <p>Ton formateur peut écouter ta voix.</p>
          <p>L'IA peut transformer ta voix en texte pour corriger ton travail.</p>
          <p>Pour utiliser cette application, tu dois accepter l'IA et la voix.</p>
          <p>Si tu refuses, tu ne peux pas suivre la formation ici.</p>
          <p>Tu peux écrire à <strong>contact@tcfpro.fr</strong> pour effacer tes données.</p>
        </div>
      </section>

      <footer className="border-t pt-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CAP TCF · Mentions légales v1.0
      </footer>
    </div>
  </div>
);

export default Legal;
