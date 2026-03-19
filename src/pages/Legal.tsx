const Legal = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <h1 className="text-3xl font-bold text-foreground">
        Mentions légales & Politique de confidentialité
      </h1>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">1. Éditeur</h2>
        <p className="text-muted-foreground">
          <strong>TCF Pro</strong> — Application de préparation à la certification TCF IRN
          (Test de Connaissance du Français — Intégration, Résidence et Nationalité)
          destinée aux apprenants FLE et aux formateurs.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">2. Hébergement</h2>
        <p className="text-muted-foreground">
          Application hébergée sur Lovable Cloud (infrastructure Supabase).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          3. Données personnelles (RGPD)
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>
            Les données collectées (email, prénom, résultats aux exercices) sont utilisées
            uniquement dans le cadre de la préparation TCF IRN.
          </li>
          <li>Aucune donnée n'est transmise à des tiers.</li>
          <li>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de
            suppression de vos données. Pour exercer ce droit, contactez-nous à l'adresse :
            <strong> contact@tcfpro.fr</strong>.
          </li>
          <li>
            Les données sont conservées pendant la durée de l'utilisation du service.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">4. Cookies</h2>
        <p className="text-muted-foreground">
          L'application utilise uniquement des cookies techniques nécessaires à
          l'authentification. Aucun cookie publicitaire ou de tracking n'est utilisé.
        </p>
      </section>

      <footer className="border-t pt-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TCF Pro ·{" "}
        <span className="text-foreground font-medium">Mentions légales</span>
      </footer>
    </div>
  </div>
);

export default Legal;
