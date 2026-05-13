# Changelog

All notable changes to `@githat/nextjs` are documented here.

## [0.18.1] - 2026-05-11

- Pre-auth endpoint allowlist in `fetchApi` — skips refresh-on-401 dance for /auth/login, /auth/signup, etc. so failed login shows "Invalid email or password" instead of "Session expired".

## [0.18.0] - 2026-05-10

- `audience` config option + per-app aud claim enforcement
- Removed deprecated `secretKey` option (HS256 path retired)

## [0.17.x] - earlier releases

- Cookie-mode tokens (httpOnly) — closes localStorage XSS-exfil class
- Same-origin proxy via `githatApiProxy()`
- RS256 JWT verification via JWKS

## Earlier

See npm: `npm view @githat/nextjs versions` for the full version list.
