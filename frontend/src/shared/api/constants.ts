/**
 * Base URL of the REST API backing every resource.
 *
 * <p>Read from `VITE_API_URL` so a deployment can repoint it without a code
 * change; the fallback is the `backend/` Spring Boot app in this repo running
 * with its default port and context path. `.env` is gitignored, so the fallback
 * — not the env file — is what a fresh checkout gets, which is why it has to
 * track `server.port` in `backend/src/main/resources/application.properties`:
 * moving the backend's port and leaving this one behind gives a dashboard
 * whose every request fails, on a machine that never had a `.env` to correct it.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8888/api";
