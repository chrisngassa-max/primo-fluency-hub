import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";

// The MCP OAuth server redirects users to a real path (not a hash route).
// The rest of the app uses HashRouter, so we handle that path here, before mounting App.
const isConsentRoute = window.location.pathname === "/.lovable/oauth/consent";

createRoot(document.getElementById("root")!).render(
  isConsentRoute ? <OAuthConsent /> : <App />,
);
registerServiceWorker();
