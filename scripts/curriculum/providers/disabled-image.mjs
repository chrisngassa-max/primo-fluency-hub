// IMAGE_PROVIDER=disabled (section 4.2) : seule la voie deterministe SVG
// reste disponible. Toute demande de rendu raster echoue explicitement,
// sans jamais produire un placeholder silencieux (section 12.2 :
// "echec image sans faux placeholder").
export class DisabledImageProvider {
  async generate({ brief }) {
    throw new Error(
      `IMAGE_PROVIDER=disabled : aucun rendu raster disponible pour ${brief?.resource_id ?? '?'}. Le visuel maitre SVG deterministe reste le support obligatoire.`,
    );
  }
}
