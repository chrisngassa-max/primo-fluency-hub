import React from "react";
import { Link } from "react-router-dom";

const AppFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (props, ref) => (
    <footer ref={ref} className="border-t py-4 text-center text-xs text-muted-foreground" {...props}>
      © {new Date().getFullYear()} CAP TCF ·{" "}
      <Link to="/legal" className="underline hover:text-foreground transition-colors">
        Mentions légales
      </Link>
    </footer>
  )
);
AppFooter.displayName = "AppFooter";

export default AppFooter;
