import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyGroups from "./tools/list_my_groups";
import listMySessions from "./tools/list_my_sessions";
import getMyProgression from "./tools/get_my_progression";

// Supabase project ref — hardcoded because the MCP plugin bundles this entry
// with its own Vite build, which does not inherit our root `define` map.
const projectRef = "gudcenhmzlcvhgbgklzw";

export default defineMcp({
  name: "captcf-mcp",
  title: "Cap CF — TCF IRN",
  version: "0.1.0",
  instructions:
    "Outils pour consulter les données pédagogiques de la plateforme Cap CF (TCF IRN). " +
    "Utilise `list_my_groups` et `list_my_sessions` côté formateur, " +
    "`get_my_progression` côté élève. L'accès est scopé par RLS à l'utilisateur connecté.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyGroups, listMySessions, getMyProgression],
});
