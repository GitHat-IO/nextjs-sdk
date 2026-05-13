/**
 * @githat/nextjs/server
 *
 * Server-side utilities for token verification in Next.js API routes and middleware.
 * This module runs on the server only — do not import in client components.
 */
interface AuthPayload {
    userId: string;
    email: string;
    orgId: string | null;
    orgSlug: string | null;
    role: 'owner' | 'admin' | 'member' | null;
    tier: 'free' | 'basic' | 'pro' | 'enterprise' | null;
    /**
     * Audience claim — the recipient app's GitHat-Apps record id
     * (UUID). Surfaced from the JWT so consumers can perform a
     * defense-in-depth check (`auth.aud === '<my-app-id>'`) in
     * addition to passing `audience` in {@link VerifyOptions}, which
     * makes `jose.jwtVerify` enforce it. Pre-Phase-5 tokens have
     * `aud='githat'`; new tokens have the appId.
     */
    aud: string | null;
    /**
     * The recipient app's GitHat-Apps record id, surfaced from the
     * `appId` claim if present. Same value as `aud` for post-Phase-5
     * tokens; `null` for pre-Phase-5 tokens that carry only the slug
     * in `app`.
     */
    appId: string | null;
}
interface VerifyOptions {
    /**
     * GitHat API base URL. Used to resolve the JWKS endpoint
     * (`${apiUrl}/.well-known/jwks.json`) for RS256 verification.
     * Defaults to `https://api.githat.io`. Override only if you
     * self-host the GitHat backend or point at a staging environment.
     */
    apiUrl?: string;
    /**
     * Expected audience (`aud` claim). When provided, `jose.jwtVerify`
     * enforces it — tokens minted for a different app are rejected.
     * Pass your app's GitHat-Apps record id (UUID).
     *
     * During the Phase 5 transition (post-2026-05-10), in-flight
     * tokens issued before Phase 5a have `aud='githat'`. Pass an
     * array `[<myAppId>, 'githat']` to accept both during the
     * transition window; drop `'githat'` after one refresh-token TTL.
     *
     * Omit this option entirely to accept any aud (back-compat).
     */
    audience?: string | string[];
    /**
     * Expected issuer (`iss` claim). Tokens minted by anything other
     * than this URL are rejected. Defaults to `https://api.githat.io`
     * (the same default `apiUrl` resolves to), which means consumers
     * get issuer pinning automatically — no extra opt-in required.
     *
     * Set this when you self-host the GitHat backend on a different
     * origin so the verifier accepts your own issuer's tokens. Pass
     * `null` to disable issuer validation entirely (NOT recommended —
     * the whole point of `iss` is to reject tokens minted by a
     * different signer that happens to share the same JWKS path).
     *
     * Why this exists separately from `apiUrl`: `apiUrl` controls
     * where the SDK FETCHES public keys; `issuer` controls what the
     * verified token must CLAIM about who minted it. They are usually
     * the same value but conceptually distinct (think federated
     * identity, where you fetch a JWKS from one host but the token's
     * `iss` is a different one).
     */
    issuer?: string | null;
}
interface OrgMetadata {
    [key: string]: unknown;
}
declare const COOKIE_NAMES: {
    readonly accessToken: "githat_access";
    readonly refreshToken: "githat_refresh";
};
/**
 * Verify a JWT token and return the decoded auth payload.
 *
 * As of 0.16 (Phase 5), this is the ONLY verification path: RS256
 * against the public JWKS at `${apiUrl}/.well-known/jwks.json`. The
 * `secretKey` option (deprecated since 0.15) is removed; HS256
 * verification is no longer supported on the consumer side because
 * the issuer no longer mints HS256 user tokens (Phase 3 cutover
 * 2026-05-10, in-flight HS256 refresh tokens drained out by
 * 2026-05-17). Server-to-server `/auth/verify` API fallback is also
 * gone — every consumer now has the JWKS path available.
 *
 * Audience enforcement: pass `audience` to reject tokens minted for
 * a different app. Use your app's GitHat-Apps record id (UUID) as
 * the expected audience. During the Phase 5 transition window, pass
 * an array `[<appId>, 'githat']` to accept both formats; drop the
 * `'githat'` fallback after one refresh-token TTL.
 *
 * @example Recommended
 * ```ts
 * const auth = await verifyToken(token, {
 *   apiUrl: 'https://api.githat.io',
 *   audience: 'd10c6fb5-00dd-40fe-9ecb-320d3808cd5e', // your appId
 * });
 * if (auth.aud !== MY_APP_ID) throw new Error('Wrong tenant');
 * ```
 *
 * @example Transition window (accept both pre- and post-Phase-5 aud)
 * ```ts
 * const auth = await verifyToken(token, {
 *   apiUrl: 'https://api.githat.io',
 *   audience: [MY_APP_ID, 'githat'],
 * });
 * ```
 */
declare function verifyToken(token: string, options?: VerifyOptions): Promise<AuthPayload>;
/**
 * Extract and verify the auth token from a Next.js request.
 * Checks cookies first (for httpOnly cookie mode), then Authorization header.
 *
 * Returns null if no token is found (unauthenticated request).
 * Throws if a token is found but is invalid/expired.
 *
 * @example In a Next.js API route
 * ```ts
 * import { getAuth } from '@githat/nextjs/server';
 *
 * export async function GET(request: Request) {
 *   const auth = await getAuth(request, {
 *     secretKey: process.env.GITHAT_SECRET_KEY
 *   });
 *
 *   if (!auth) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   return Response.json({ userId: auth.userId });
 * }
 * ```
 */
declare function getAuth(request: Request, options?: VerifyOptions): Promise<AuthPayload | null>;
/**
 * Read the current session inside a Next.js Server Component, layout,
 * or server action. Returns the verified AuthPayload or null when
 * the visitor is unauthenticated.
 *
 * @example
 * ```ts
 * import { auth } from '@githat/nextjs/server';
 *
 * export default async function Dashboard() {
 *   const session = await auth();
 *   if (!session) redirect('/sign-in');
 *   return <div>Hello {session.userId}</div>;
 * }
 * ```
 *
 * Inside an API route or middleware where you have a `Request`, use
 * `getAuth(request, options)` instead — this helper is for the cases
 * where you don't.
 */
declare function auth(options?: VerifyOptions): Promise<AuthPayload | null>;
/**
 * Return the current user profile alongside the session. Convenience
 * wrapper over `auth()` + a single `/auth/me` fetch. Cached for the
 * lifetime of the Server Component render via React's `cache()` so
 * multiple `currentUser()` calls in one render coalesce.
 *
 * Returns null when the visitor is unauthenticated OR when the token
 * is valid but the user record has been deleted.
 *
 * @example
 * ```ts
 * import { currentUser } from '@githat/nextjs/server';
 *
 * export default async function Page() {
 *   const user = await currentUser();
 *   if (!user) redirect('/sign-in');
 *   return <h1>Hi {user.email}</h1>;
 * }
 * ```
 */
declare function currentUser(options?: VerifyOptions): Promise<{
    id: string;
    email: string | null;
    orgId: string | null;
    orgRole: string | null;
    raw: AuthPayload;
} | null>;
/**
 * Get organization metadata from the server.
 *
 * @example
 * ```ts
 * import { getOrgMetadata } from '@githat/nextjs/server';
 *
 * const meta = await getOrgMetadata(orgId, {
 *   token: accessToken,
 *   apiUrl: 'https://api.githat.io'
 * });
 * console.log(meta.stripeAccountId);
 * ```
 */
declare function getOrgMetadata(orgId: string, options: {
    token: string;
    apiUrl?: string;
}): Promise<OrgMetadata>;
/**
 * Update organization metadata from the server.
 *
 * @example
 * ```ts
 * import { updateOrgMetadata } from '@githat/nextjs/server';
 *
 * await updateOrgMetadata(orgId, { stripeAccountId: 'acct_xxx' }, {
 *   token: accessToken,
 *   apiUrl: 'https://api.githat.io'
 * });
 * ```
 */
declare function updateOrgMetadata(orgId: string, metadata: OrgMetadata, options: {
    token: string;
    apiUrl?: string;
}): Promise<OrgMetadata>;
/**
 * Handler function that receives the request and verified auth payload.
 */
type AuthenticatedHandler = (request: Request, auth: AuthPayload) => Promise<Response> | Response;
/**
 * Options for the withAuth wrapper.
 */
interface WithAuthOptions {
    /**
     * GitHat API base URL for JWKS verification.
     * Defaults to `https://api.githat.io`.
     */
    apiUrl?: string;
    /**
     * Expected audience claim (your app's GitHat-Apps record id, UUID).
     * When set, the wrapper enforces `aud === audience`. Pass an array
     * during the Phase 5 transition window to accept both pre- and
     * post-Phase-5 audiences. Omit to accept any aud (back-compat).
     */
    audience?: string | string[];
    /**
     * Custom response to return when authentication fails.
     * Defaults to JSON { error: 'Unauthorized' } with status 401.
     */
    onUnauthorized?: () => Response;
}
/**
 * Wrap an API route handler with authentication.
 * The handler will only be called if the request has a valid auth token.
 *
 * @example
 * ```ts
 * // app/api/orders/route.ts
 * import { withAuth } from '@githat/nextjs/server';
 *
 * export const GET = withAuth(async (request, auth) => {
 *   // auth.userId, auth.orgId, auth.role available
 *   const orders = await db.orders.findMany({ where: { orgId: auth.orgId } });
 *   return Response.json({ orders });
 * }, { audience: process.env.GITHAT_APP_ID });
 * ```
 *
 * @example With custom unauthorized response
 * ```ts
 * export const GET = withAuth(
 *   async (request, auth) => {
 *     return Response.json({ userId: auth.userId });
 *   },
 *   {
 *     audience: process.env.GITHAT_APP_ID,
 *     onUnauthorized: () => Response.redirect('/sign-in'),
 *   }
 * );
 * ```
 */
declare function withAuth(handler: AuthenticatedHandler, options?: WithAuthOptions): (request: Request) => Promise<Response>;
interface WithGitHatOptions {
    /**
     * The GitHat API base URL. Defaults to https://api.githat.io.
     * Override only if you are self-hosting the GitHat backend.
     */
    apiUrl?: string;
    /** Additional connect-src entries to merge into the CSP. */
    extraConnectSrc?: string[];
    /** Additional img-src entries to merge into the CSP. */
    extraImgSrc?: string[];
    /** Additional script-src entries to merge into the CSP. */
    extraScriptSrc?: string[];
    /** Additional style-src entries to merge into the CSP. */
    extraStyleSrc?: string[];
    /** Additional font-src entries to merge into the CSP. */
    extraFontSrc?: string[];
    /** Additional frame-src entries (e.g., Stripe Checkout iframes). */
    extraFrameSrc?: string[];
    /** Additional frame-ancestors entries (controls who can iframe your app). */
    extraFrameAncestors?: string[];
    /** CSP violation report URI (legacy). */
    reportUri?: string;
    /** Report-To group name for CSP violation reports (modern). */
    reportTo?: string;
    /**
     * Set to false to skip CSP injection entirely.
     * Useful if you manage your own Content-Security-Policy header.
     * @default true
     */
    csp?: boolean;
    /**
     * Set to false to skip injecting the non-CSP security headers
     * (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
     * @default true
     */
    securityHeaders?: boolean;
}
/**
 * A Next.js config helper that merges GitHat's required CSP and security
 * headers into your existing `next.config` so the SDK works out of the box
 * without customers needing to manually edit their Content-Security-Policy.
 *
 * **Why this exists**: The SDK calls `https://api.githat.io` from the
 * browser. Without `connect-src https://api.githat.io` in the CSP every
 * SDK fetch will be blocked by the browser and surfaces as the misleading
 * "API request failed. Verify your publishable key and app domain" error.
 *
 * **Env-aware**: CSP is detected at build time via `process.env.NODE_ENV`.
 * - `development` — adds `'unsafe-eval'` to `script-src` (required by
 *   Next.js HMR) and localhost websocket/http entries to `connect-src`.
 * - `production` — no `unsafe-eval`, no localhost entries (tighter policy).
 *
 * @example Basic usage
 * ```ts
 * // next.config.ts
 * import { withGitHat } from "@githat/nextjs/server";
 * const nextConfig = { output: "standalone" };
 * export default withGitHat(nextConfig);
 * ```
 *
 * @example Advanced usage
 * ```ts
 * export default withGitHat(nextConfig, {
 *   extraConnectSrc: ["wss://*.myapp.com"],
 *   extraImgSrc: ["https://cdn.myapp.com"],
 * });
 * ```
 */
declare function withGitHat<T extends Record<string, unknown>>(nextConfig: T, options?: WithGitHatOptions): T;
interface ServerSendEmailOptions {
    /** Recipient email address(es). */
    to: string | string[];
    /** Email subject line. */
    subject: string;
    /** HTML body. */
    html?: string;
    /** Plain text body. */
    text?: string;
    /** Reply-to email address. */
    replyTo?: string;
}
interface ServerSendEmailResult {
    messageId: string;
    to: string[];
    subject: string;
    sent: boolean;
}
/**
 * Send a transactional email from the server.
 * Use this in Next.js API routes, server actions, or any server-side code.
 *
 * @example
 * ```ts
 * import { sendEmail } from '@githat/nextjs/server';
 *
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome aboard</h1>',
 *   replyTo: 'support@myapp.com'
 * }, {
 *   token: accessToken
 * });
 * ```
 */
declare function sendEmail(options: ServerSendEmailOptions, config: {
    token: string;
    apiUrl?: string;
}): Promise<ServerSendEmailResult>;
interface GitHatApiProxyOptions {
    /**
     * Upstream GitHat API URL. Defaults to `https://api.githat.io`.
     * Override for local dev or staging environments.
     */
    apiUrl?: string;
}
interface GitHatApiProxyHandlers {
    GET: (request: Request, ctx: {
        params: Promise<{
            path: string[];
        }>;
    }) => Promise<Response>;
    POST: (request: Request, ctx: {
        params: Promise<{
            path: string[];
        }>;
    }) => Promise<Response>;
    PUT: (request: Request, ctx: {
        params: Promise<{
            path: string[];
        }>;
    }) => Promise<Response>;
    PATCH: (request: Request, ctx: {
        params: Promise<{
            path: string[];
        }>;
    }) => Promise<Response>;
    DELETE: (request: Request, ctx: {
        params: Promise<{
            path: string[];
        }>;
    }) => Promise<Response>;
    OPTIONS: (request: Request, ctx: {
        params: Promise<{
            path: string[];
        }>;
    }) => Promise<Response>;
}
/**
 * Build a Next.js App Router catch-all route that proxies every request to
 * the GitHat API while keeping cookies on the consumer's domain.
 *
 * @example
 * ```ts
 * // src/app/api/githat/[...path]/route.ts
 * import { githatApiProxy } from '@githat/nextjs/server';
 * export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = githatApiProxy();
 * ```
 *
 * Pair with `<GitHatProvider config={{ apiUrl: '/api/githat' }}>`.
 */
declare function githatApiProxy(options?: GitHatApiProxyOptions): GitHatApiProxyHandlers;

export { type AuthPayload, type AuthenticatedHandler, COOKIE_NAMES, type OrgMetadata, type ServerSendEmailOptions, type ServerSendEmailResult, type VerifyOptions, type WithAuthOptions, type WithGitHatOptions, auth, currentUser, getAuth, getOrgMetadata, githatApiProxy, sendEmail, updateOrgMetadata, verifyToken, withAuth, withGitHat };
