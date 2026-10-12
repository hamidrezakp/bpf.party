/// <reference types="astro/client" />

// Custom public environment variables, loaded from website/.env (see
// website/.env.example). Astro exposes only PUBLIC_*-prefixed variables to
// browser code; everything else stays server/build-side only.
interface ImportMetaEnv {
  /**
   * Base URL of the execution backend the editor posts C source to.
   * Unset: `http://localhost:8081` in dev, same-origin ("") in builds.
   */
  readonly PUBLIC_API_BASE_URL?: string;
}
