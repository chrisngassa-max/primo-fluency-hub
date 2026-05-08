import React from "react";
import { Link } from "react-router-dom";
import { CapLogo } from "@/components/CapBrand";

const AppFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (props, ref) => (
    <footer ref={ref} className="mt-auto border-t border-white/10 bg-primary" {...props}>
      <div className="mx-auto max-w-4xl space-y-7 px-6 py-8">
        <CapLogo
          className="justify-center"
          markClassName="h-7 w-7 text-[#f47b20]"
          textClassName="text-2xl text-white [&_span]:text-white"
        />

        <div className="mx-auto grid max-w-sm grid-cols-2 gap-10">
          <div className="space-y-2">
            <p className="text-lg font-bold text-white">Élèves</p>
            <ul className="space-y-1">
              {[
                { label: "Se connecter", to: "/eleve/login" },
                { label: "Créer un compte", to: "/eleve/login" },
                { label: "Test de niveau", to: "/eleve/login" },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-base leading-tight text-white/60 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-lg font-bold text-white">Formateurs</p>
            <ul className="space-y-1">
              {[
                { label: "Espace formateur", to: "/formateur/login" },
                { label: "Contact", to: "/legal" },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-base leading-tight text-white/60 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 pt-5 text-center">
          <p className="text-sm text-white/55">© 2024 CAP TCF. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  )
);

AppFooter.displayName = "AppFooter";

export default AppFooter;
