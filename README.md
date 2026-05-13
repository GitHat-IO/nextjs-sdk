# @githat/nextjs

> Public home for the **@githat/nextjs** Next.js SDK — the auth and routing layer for apps built on the [GitHat platform](https://githat.io).

[![npm](https://img.shields.io/npm/v/@githat/nextjs?color=0b1320&logo=npm&logoColor=white)](https://www.npmjs.com/package/@githat/nextjs)
[![types](https://img.shields.io/npm/types/@githat/nextjs)](https://www.npmjs.com/package/@githat/nextjs)
[![GitHat](https://img.shields.io/badge/platform-GitHat-0b1320?logo=githhub)](https://githat.io)

## Install

```bash
npm install @githat/nextjs
```

## Quick start

```tsx
// app/layout.tsx
import { GitHatProvider } from '@githat/nextjs';
import '@githat/nextjs/styles';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <GitHatProvider config={{
          publishableKey: process.env.NEXT_PUBLIC_GITHAT_PUBLISHABLE_KEY!,
          apiUrl: '/api/githat',           // same-origin proxy (recommended)
          tokenStorage: 'cookie',          // httpOnly tokens
          signInUrl: '/sign-in',
          signUpUrl: '/sign-up',
          afterSignInUrl: '/dashboard',
          afterSignOutUrl: '/',
        }}>
          {children}
        </GitHatProvider>
      </body>
    </html>
  );
}
```

```ts
// app/api/githat/[...path]/route.ts
import { githatApiProxy } from '@githat/nextjs/server';
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = githatApiProxy();
```

That's it. You now have sign-in, sign-up, password reset, OAuth (Google/GitHub/Apple/Microsoft/Discord/Slack/X), passkeys, 2FA, organizations, and audit logging wired up.

For a from-scratch starter: `npx create-githat-app`

## What's in this repo

| Path | Contents |
|---|---|
| `types/` | TypeScript declaration files mirroring what ships in the npm package |
| `LICENSE` | License terms |
| `README.md` | This file |
| `CHANGELOG.md` | Release notes |

**This repo doesn't contain the SDK source code.** The SDK is built from a private monorepo (`GitHat-IO/MicroFrontEnds`) where engineering happens. Compiled binaries publish directly to npm — `npm install @githat/nextjs` is the canonical way to get the SDK.

This repo exists for:
- 🐛 **Bug reports + feature requests** — file an issue
- 📚 **Public type reference** — browse the `.d.ts` files if you want to know the API shape without `npm install`
- 📝 **Release notes** — see `CHANGELOG.md`
- 🔗 **The repository link on npm** points here (so clicking "Repository" on the npm page lands somewhere useful)

## Architecture

```
User browser
   │
   │  (1) sign-in POST  → /api/githat/auth/login
   ▼
Your Next.js app (using @githat/nextjs)
   │
   │  (2) proxied via githatApiProxy()
   ▼
api.githat.io  (Lambda backend, RS256 + KMS)
   │
   ▼  Set-Cookie re-emitted on your origin
Browser stores httpOnly cookie on YOUR domain
```

Key design points:
- **Same-origin proxy** — your app forwards SDK requests through `/api/githat/...` so cookies land on your domain (not on api.githat.io)
- **Cookie-mode tokens** — httpOnly, no `localStorage` (closes XSS-exfil class)
- **RS256 JWTs verified locally** — your app fetches GitHat's public JWKS once per cold container, verifies tokens without round-tripping
- **Audience claim** — tokens minted for `your-app-id` are rejected by sibling apps (no cross-tenant replay)

## Versions

See [CHANGELOG.md](./CHANGELOG.md) for release notes. Current: `v0.18.1`.

## Bug reports + feature requests

[Open an issue here](https://github.com/GitHat-IO/nextjs-sdk/issues). For security vulnerabilities, see [SECURITY.md](https://github.com/GitHat-IO/.github/blob/main/SECURITY.md) — email security@githat.io. Do not file public issues for security disclosures.

## License

See [LICENSE](./LICENSE).
