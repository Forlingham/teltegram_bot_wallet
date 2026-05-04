export const AUTH_SESSION_HEADER = 'x-session-token';
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 300;
export const AUTH_NONCE_TTL_SECONDS = 300;
export const AUTH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
// Login (session creation / renewal) may accept older initData because the
// nonce-replay check already prevents reuse.  This allows the frontend to
// silently refresh a session while the Mini App is still open.
export const AUTH_LOGIN_INITDATA_MAX_AGE_SECONDS = 24 * 60 * 60;
