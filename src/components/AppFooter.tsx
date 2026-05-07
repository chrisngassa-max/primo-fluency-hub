import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

const AppFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (props, ref) => (
    <footer
      ref={ref}
      className="border-t border-white/10 mt-auto"
      style={{ backgroundColor: "hsl(215 65% 12%)" }}
      {...props}
    >
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* Logo centré */}
        <div className="flex items-center justify-center gap-2">
          <GraduationCap className="h-6 w-6 text-accent" />
          <span className="font-extrabold text-lg tracking-tight text-white">
            CAP TCF
          </span>
        </div>

        {/* Deux colonnes */}
        <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
          <div className="space-y-2">
            <p className="font-bold text-sm text-white">Élèves</p>
            <ul className="space-y-1.5">
              {[
                { label: "Se connecter", to: "/eleve/login" },
                { label: "Créer un compte", to: "/eleve/login" },
                { label: "Test de niveau", to: "/eleve/login" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-sm text-white">Formateurs</p>
            <ul className="space-y-1.5">
              {[
                { label: "Espace formateur", to: "/formateur/login" },
                { label: "Contact", to: "/legal" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 pt-5 text-center">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} CAP TCF. Tous droits réservés.
          </p>
        </div>

      </div>
    </footer>
  )
);
AppFooter.displayName = "AppFooter";

export default AppFooter;
