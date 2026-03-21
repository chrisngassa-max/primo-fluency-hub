import { Link } from "react-router-dom";

const AppFooter = () => (
  <footer className="border-t py-4 text-center text-xs text-muted-foreground">
    © {new Date().getFullYear()} CAP TCF ·{" "}
    <Link to="/legal" className="underline hover:text-foreground transition-colors">
      Mentions légales
    </Link>
  </footer>
);

export default AppFooter;
