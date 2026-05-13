import { NextRequest, NextResponse } from 'next/server';

interface AuthHandlerOptions {
    /**
     * Routes that don't require authentication.
     * Supports exact paths ('/') and path prefixes ('/public/*').
     */
    publicRoutes?: string[];
    /**
     * URL to redirect to when authentication is required but not present.
     * @default '/sign-in'
     */
    signInUrl?: string;
    /**
     * Cookie name for the access token.
     * @default 'githat_access'
     */
    tokenCookie?: string;
    /**
     * Legacy localStorage token cookie name (for backward compatibility).
     * @default 'githat_access_token'
     */
    legacyTokenCookie?: string;
    /**
     * When true, decode the JWT and inject x-githat-* headers into the request.
     * This allows downstream API routes to access user/org info without re-verifying.
     *
     * Injected headers:
     * - x-githat-user-id: User's unique ID
     * - x-githat-email: User's email address
     * - x-githat-org-id: Current org ID (if any)
     * - x-githat-org-slug: Current org slug (if any)
     * - x-githat-role: User's role in the org (owner/admin/member)
     *
     * @default false
     */
    injectHeaders?: boolean;
    /**
     * GitHat API base URL. Used to resolve the JWKS endpoint
     * (`${apiUrl}/.well-known/jwks.json`) when verifying RS256 tokens.
     * Defaults to `https://api.githat.io`. Override only if you self-host
     * the GitHat backend or need to point at a staging environment.
     */
    apiUrl?: string;
    /**
     * When set + injectHeaders=true, the middleware/proxy will pass this
     * expected audience (the app's GitHat-Apps record id) to
     * `jose.jwtVerify`. Tokens whose `aud` doesn't match get a 401
     * redirect to `signInUrl`. Pass an array during the Phase 5
     * transition window to accept both pre-Phase-5 `'githat'` and
     * post-Phase-5 `<appId>` audiences.
     */
    audience?: string | string[];
    /**
     * When set + injectHeaders=true, enables CRYPTOGRAPHIC verification
     * via JWKS (RS256-only as of SDK 0.16; HS256/secretKey paths are
     * gone). When unset, the middleware injects headers from the
     * UNVERIFIED token payload — fine for trust-the-cookie-prefix
     * threat models but not a security boundary. Recommend `true` on
     * any route that gates real authorization.
     */
    verifyTokens?: boolean;
}

/**
 * Options for the authMiddleware function.
 * @see AuthHandlerOptions for detailed property documentation.
 */
interface AuthMiddlewareOptions extends AuthHandlerOptions {
}
/**
 * Creates an auth middleware handler for Next.js 14/15.
 *
 * @deprecated For Next.js 16+, use `authProxy` from `@githat/nextjs/proxy` instead.
 * Next.js 16 renamed middleware.ts to proxy.ts. This export continues to work
 * for Next.js 14/15 applications.
 *
 * @example
 * ```typescript
 * // middleware.ts (Next.js 14/15)
 * import { authMiddleware } from '@githat/nextjs/middleware';
 *
 * export default authMiddleware({
 *   publicRoutes: ['/', '/about', '/pricing'],
 *   signInUrl: '/sign-in',
 * });
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 *
 * @param options - Configuration options for the auth middleware
 * @returns A middleware function compatible with Next.js 14/15 middleware.ts convention
 */
declare function authMiddleware(options?: AuthMiddlewareOptions): (request: NextRequest) => Promise<NextResponse>;

export { type AuthHandlerOptions, type AuthMiddlewareOptions as AuthMiddlewareConfig, type AuthMiddlewareOptions, authMiddleware };
