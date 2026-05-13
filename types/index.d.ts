import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

interface StorageObject {
    objectId: string;
    objectKey: string;
    contentType: string;
    size: number;
    isPublic: boolean;
    metadata: Record<string, unknown>;
    s3Bucket: string;
    s3Key: string;
    uploadedBy: string;
    uploadedAt: string;
    status: 'pending' | 'ready';
    finalUrl: string | null;
    downloadUrl?: string;
}
interface StorageUploadOptions {
    /** When true, the object is publicly accessible via a permanent URL. Default: false */
    isPublic?: boolean;
    /** Arbitrary key-value metadata attached to the object */
    metadata?: Record<string, unknown>;
}
interface StorageUploadResult {
    objectId: string;
    objectKey: string;
    finalUrl: string | null;
    size: number;
    contentType: string;
    status: 'ready';
}
interface StorageListOptions {
    /** Filter objects whose key starts with this prefix */
    prefix?: string;
    /** Filter by uploader userId */
    uploadedBy?: string;
    /** ISO timestamp — only return objects uploaded at or after this time */
    since?: string;
    /** Page size (default: 25, max: 100) */
    limit?: number;
    /** Pagination cursor from a previous list call */
    cursor?: string;
}
interface StorageListResult {
    items: StorageObject[];
    nextCursor: string | null;
}
/**
 * useStorage — browser-direct file storage for GitHat apps.
 *
 * The upload flow uses S3 presigned POST so files never route through the
 * GitHat API server:
 *   1. Client calls useStorage().upload(file, options)
 *   2. SDK calls POST /storage/presign-upload → gets {uploadUrl, fields, objectId}
 *   3. SDK POSTs file directly to S3 using the presigned fields
 *   4. SDK calls POST /storage/finalize/:objectId to confirm the upload
 *
 * This is static-export-friendly — no server actions required.
 *
 * @example
 * ```tsx
 * const { upload, list, getUrl, remove, update } = useStorage();
 *
 * // Upload a file
 * const obj = await upload(file, { isPublic: false, metadata: { tag: 'avatar' } });
 *
 * // List user's files
 * const { items } = await list({ prefix: 'avatars/' });
 *
 * // Get a temporary download URL
 * const { downloadUrl } = await getUrl(obj.objectId);
 *
 * // Delete
 * await remove(obj.objectId);
 * ```
 */
declare function useStorage(): {
    upload: (file: File, options?: StorageUploadOptions) => Promise<StorageUploadResult>;
    list: (opts?: StorageListOptions) => Promise<StorageListResult>;
    getUrl: (objectId: string) => Promise<StorageObject & {
        downloadUrl: string;
    }>;
    remove: (objectId: string) => Promise<{
        deleted: boolean;
        objectId: string;
    }>;
    update: (objectId: string, patch: {
        isPublic?: boolean;
        metadata?: Record<string, unknown>;
    }) => Promise<Partial<StorageObject>>;
};

interface GitHatUser {
    id: string;
    email: string | null;
    name: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    /**
     * Whether TOTP-based two-factor authentication is enabled for this
     * account. Surfaced from /auth/me so the security panel knows which
     * UI to render. The TOTP secret itself is never sent to the client.
     */
    mfaEnabled?: boolean;
    /**
     * Registered WebAuthn passkeys for this account. Server returns only the
     * non-secret fields (credentialId, deviceName, dates) — public keys and
     * signature counters are server-internal.
     */
    passkeys?: Array<{
        credentialId: string;
        deviceName: string;
        createdAt: string | null;
        lastUsedAt: string | null;
    }>;
    githubUsername?: string;
    googleId?: string;
    microsoftId?: string;
    facebookId?: string;
    appleId?: string;
    instagramId?: string;
    tiktokId?: string;
    authProvider?: 'email' | 'github' | 'google' | 'microsoft' | 'facebook' | 'apple' | 'instagram' | 'tiktok';
}
interface GitHatOrg {
    id: string;
    name: string;
    slug: string;
    role: string;
    tier: string;
}
interface GitHatConfig {
    publishableKey: string;
    /**
     * GitHat app ID (e.g., `app_abc123`). Required for app-scoped APIs
     * like email-domain management. The SDK can resolve this from the
     * publishable key on first auth call, but passing it explicitly
     * avoids the round-trip and is required for hooks that need it
     * synchronously (e.g., useEmailDomains).
     */
    appId?: string;
    /**
     * Display name of the customer app — shown on auth forms (sign-in,
     * sign-up). When set, "Sign in to {appName}" / "Create your {appName}
     * account". When omitted, the form falls back to a generic "Sign in" /
     * "Create your account" with no platform branding.
     *
     * Set this once on GitHatProvider so every form picks it up.
     *
     * @example "ClickReserv" → "Sign in to ClickReserv"
     * @example "QuantL" → "Sign in to QuantL"
     */
    appName?: string;
    apiUrl?: string;
    signInUrl?: string;
    signUpUrl?: string;
    afterSignInUrl?: string;
    afterSignOutUrl?: string;
    /**
     * URL the UserButton's "Security" / "Account" link points at. Defaults
     * to `/account/security`. Override per-app for templates that put the
     * security panel under a different route (e.g. /settings/security).
     */
    accountUrl?: string;
    /**
     * Token storage mode:
     * - 'cookie' (default): Tokens stored in httpOnly cookies via the
     *   same-origin /api/githat proxy. XSS-resistant, SSR-friendly.
     * - 'localStorage': Tokens stored in browser localStorage. Readable
     *   by any script running on the page (including third-party deps);
     *   only use this for static-host scenarios where httpOnly cookies
     *   are not an option.
     *
     * When using 'cookie' mode:
     * - Login/refresh automatically set httpOnly cookies
     * - SDK reads auth state from cookies (server-side)
     * - Better for apps with server-side rendering
     */
    tokenStorage?: 'localStorage' | 'cookie';
}
interface AuthState {
    user: GitHatUser | null;
    org: GitHatOrg | null;
    isSignedIn: boolean;
    isLoading: boolean;
    authError: string | null;
}
/**
 * Result of the password step of sign-in. When the account has MFA
 * enabled, the API returns `requiresMfa: true` plus a short-lived
 * challenge ticket; the SDK then needs the user's TOTP code to mint
 * real session tokens. When MFA is not enabled, sign-in completes
 * inline and `signIn` resolves to `void` (back-compat).
 */
interface MfaChallengeRequired {
    requiresMfa: true;
    mfaTicket: string;
}
type SignInResult = void | MfaChallengeRequired;
/**
 * Tokens + identity payload returned by /auth/login (no MFA) and by
 * /auth/2fa/login-verify (MFA flow). Exposed so callers of useMfa
 * can hand it to the provider's internal session-completer.
 */
interface SignInTokens {
    user: GitHatUser;
    org: GitHatOrg | null;
    accessToken?: string;
    refreshToken?: string;
}
interface AuthActions {
    signIn: (email: string, password: string) => Promise<SignInResult>;
    signUp: (data: SignUpData) => Promise<SignUpResult>;
    signOut: () => Promise<void>;
    switchOrg: (orgId: string) => Promise<void>;
    /**
     * Internal: complete a sign-in flow that came back through /auth/2fa/login-verify.
     * The MFA hooks/components call this after a successful TOTP verification so
     * the auth state lands in the same shape as a regular login.
     */
    completeSignIn: (tokens: SignInTokens) => void;
}
interface SignUpData {
    email: string;
    password: string;
    name: string;
    acceptMarketing?: boolean;
}
interface SignUpResult {
    requiresVerification: boolean;
    email: string;
}
interface GitHatContextValue extends AuthState, AuthActions {
    config: GitHatConfig;
}
interface PasswordResetResult {
    success: boolean;
}
interface EmailVerificationResult {
    success: boolean;
}
/** Props shared by all provider-specific OAuth button components. */
interface OAuthButtonPropsBase {
    children?: React.ReactNode;
    redirectUri?: string;
    onError?: (error: Error) => void;
    className?: string;
    variant?: 'default' | 'outline';
    disabled?: boolean;
}
/** Props shared by all provider-specific OAuth callback components. */
interface OAuthCallbackPropsBase {
    redirectUrl?: string;
    newUserRedirectUrl?: string;
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    onError?: (error: Error) => void;
    loadingComponent?: React.ReactNode;
    errorComponent?: (error: string) => React.ReactNode;
}
interface GoogleButtonProps$1 extends OAuthButtonPropsBase {
}
interface GoogleCallbackProps$1 extends OAuthCallbackPropsBase {
}
interface MicrosoftButtonProps$1 extends OAuthButtonPropsBase {
}
interface MicrosoftCallbackProps$1 extends OAuthCallbackPropsBase {
}
interface FacebookButtonProps$1 extends OAuthButtonPropsBase {
}
interface FacebookCallbackProps$1 extends OAuthCallbackPropsBase {
}
interface AppleButtonProps$1 extends OAuthButtonPropsBase {
}
interface AppleCallbackProps$1 extends OAuthCallbackPropsBase {
}
interface InstagramButtonProps$1 extends OAuthButtonPropsBase {
}
interface InstagramCallbackProps$1 extends OAuthCallbackPropsBase {
}
interface TikTokButtonProps$1 extends OAuthButtonPropsBase {
}
interface TikTokCallbackProps$1 extends OAuthCallbackPropsBase {
}

interface GitHatProviderProps {
    config: GitHatConfig;
    children: React.ReactNode;
}
declare function GitHatProvider({ config: rawConfig, children }: GitHatProviderProps): react_jsx_runtime.JSX.Element;

interface OrgMetadata$1 {
    [key: string]: unknown;
}
declare function useAuth(): GitHatContextValue;
declare function useGitHat(): {
    fetch: <T = unknown>(endpoint: string, fetchOptions?: RequestInit) => Promise<T>;
    getUserOrgs: () => Promise<{
        orgs: GitHatOrg[];
    }>;
    verifyAgent: (wallet: string) => Promise<{
        verified: boolean;
    }>;
    getOrgMetadata: () => Promise<OrgMetadata$1>;
    updateOrgMetadata: (updates: OrgMetadata$1) => Promise<OrgMetadata$1>;
    forgotPassword: (email: string) => Promise<{
        success: boolean;
    }>;
    resetPassword: (token: string, newPassword: string) => Promise<{
        success: boolean;
    }>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<{
        success: boolean;
    }>;
    verifyEmail: (token: string) => Promise<{
        success: boolean;
    }>;
    resendVerificationEmail: (email: string) => Promise<{
        success: boolean;
    }>;
    getGitHubOAuthUrl: (options?: {
        redirectUri?: string;
        state?: string;
    }) => Promise<{
        url: string;
    }>;
    signInWithGitHub: (code: string, options?: {
        redirectUri?: string;
    }) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        isNewUser: boolean;
    }>;
    getGoogleOAuthUrl: (options?: {
        redirectUri?: string;
        state?: string;
    }) => Promise<{
        url: string;
    }>;
    signInWithGoogle: (code: string, options?: {
        redirectUri?: string;
    }) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        isNewUser: boolean;
    }>;
    getMicrosoftOAuthUrl: (options?: {
        redirectUri?: string;
        state?: string;
    }) => Promise<{
        url: string;
    }>;
    signInWithMicrosoft: (code: string, options?: {
        redirectUri?: string;
    }) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        isNewUser: boolean;
    }>;
    getFacebookOAuthUrl: (options?: {
        redirectUri?: string;
        state?: string;
    }) => Promise<{
        url: string;
    }>;
    signInWithFacebook: (code: string, options?: {
        redirectUri?: string;
    }) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        isNewUser: boolean;
    }>;
    getInstagramOAuthUrl: (options?: {
        redirectUri?: string;
        state?: string;
    }) => Promise<{
        url: string;
    }>;
    signInWithInstagram: (code: string, options?: {
        redirectUri?: string;
    }) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        isNewUser: boolean;
    }>;
    getTikTokOAuthUrl: (options?: {
        redirectUri?: string;
        state?: string;
    }) => Promise<{
        url: string;
    }>;
    signInWithTikTok: (code: string, options?: {
        redirectUri?: string;
    }) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        isNewUser: boolean;
    }>;
    getAppleOAuthUrl: (options?: {
        redirectUri?: string;
        state?: string;
    }) => Promise<{
        url: string;
    }>;
    signInWithApple: (code: string, options?: {
        redirectUri?: string;
        user?: string;
    }) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        isNewUser: boolean;
    }>;
};

interface ClerkCompatUser extends GitHatUser {
    /** Clerk-style: same as `name` split on space. Always populated. */
    firstName: string | null;
    lastName: string | null;
    /** Clerk-style: same as `email`. Avoids the destructure rename. */
    primaryEmailAddress: {
        emailAddress: string | null;
        verification: {
            status: 'verified' | 'unverified';
        };
    } | null;
    /** Clerk-style: same as `avatarUrl`. */
    imageUrl: string;
    /** Clerk-style: stable string id of the user. */
    fullName: string;
}
/**
 * Clerk-compatible `useUser()` shape.
 *
 * Returns `{ isSignedIn, isLoaded, user }`. The user object exposes
 * Clerk-style `firstName` / `lastName` / `primaryEmailAddress` /
 * `imageUrl` / `fullName` aliased from the GitHat user record.
 *
 * Clerk-only fields (`unsafeMetadata`, `publicMetadata`,
 * `privateMetadata`, `phoneNumbers`, etc.) are not yet exposed — they
 * land in a follow-up commit when the GitHat user-metadata endpoints
 * ship.
 */
declare function useUser(): {
    isSignedIn: boolean | undefined;
    isLoaded: boolean;
    user: ClerkCompatUser | null;
};
/**
 * Clerk-compatible `useAuth()` shape. GitHat already exports a
 * `useAuth` hook from `'./hooks'` that returns the GitHat
 * `GitHatContextValue` — this one re-exports under the same name from
 * the compat module, but a Clerk app calling `useAuth()` expects
 * specific fields. We map the GitHat shape onto Clerk's contract.
 *
 *   isSignedIn?: boolean        — undefined while loading
 *   isLoaded: boolean
 *   userId: string | null
 *   sessionId: string | null    — GitHat doesn't surface session id
 *                                  client-side; we return null and
 *                                  document that fact.
 *   orgId: string | null
 *   orgRole: string | null
 *   orgSlug: string | null
 *   getToken(): Promise<string | null>
 *   signOut(): Promise<void>
 */
declare function useAuthClerk(): {
    isSignedIn: boolean | undefined;
    isLoaded: boolean;
    userId: string | null;
    sessionId: string | null;
    orgId: string | null;
    orgRole: string | null;
    orgSlug: string | null;
    getToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
};
/**
 * Clerk-compatible `useSignIn()` returns a thin facade around the
 * GitHat client's auth.* methods. Apps using Clerk's `signIn.create({
 * identifier, password })` pattern can keep that call shape; the
 * `signIn` object here forwards to `client.login`.
 *
 * Unlike Clerk we don't yet model the multi-factor "first factor →
 * second factor" state machine here — GitHat handles that through the
 * <SignInForm /> component. If your app is using <SignInForm /> you
 * don't need this hook; it's here only for Clerk-codebase migrations
 * that drive the flow manually.
 */
declare function useSignIn(): {
    isLoaded: boolean;
    signIn: {
        create: (params: {
            identifier: string;
            password: string;
        }) => Promise<{
            status: 'complete' | 'needs_mfa' | 'failed';
            createdSessionId: string | null;
            error?: string;
        }>;
    };
    setActive: (params: {
        session: string;
    }) => Promise<void>;
};
/**
 * Clerk-compatible `useSignUp()`.
 *
 * Same-shape `create` + `prepareEmailAddressVerification` +
 * `attemptEmailAddressVerification` triple. GitHat does this in two
 * steps (register → verify-email), so `prepareEmailAddressVerification`
 * is a no-op (verification email is sent from /auth/register
 * automatically) and `attemptEmailAddressVerification` calls
 * /auth/verify-email.
 */
declare function useSignUp(): {
    isLoaded: boolean;
    signUp: {
        create: (params: {
            emailAddress: string;
            password: string;
            firstName?: string;
            lastName?: string;
        }) => Promise<{
            status: 'missing_requirements' | 'complete' | 'failed';
            createdSessionId: string | null;
            error?: string;
        }>;
        prepareEmailAddressVerification: () => Promise<void>;
        attemptEmailAddressVerification: (params: {
            code: string;
        }) => Promise<{
            status: 'complete' | 'failed';
            error?: string;
        }>;
    };
    setActive: (params: {
        session: string;
    }) => Promise<void>;
};
/**
 * Clerk-compatible `useClerk()`. In Clerk this returns the full Clerk
 * instance for low-level operations (`openSignIn`, `signOut`,
 * `redirectToSignIn`, etc.).
 *
 * GitHat exposes the relevant operations off `useAuth()` /
 * `useGitHat()` directly; this hook returns a façade that maps the
 * common Clerk-instance methods onto GitHat.
 */
declare function useClerk(): {
    signOut: () => Promise<void>;
    openSignIn: () => void;
    openSignUp: () => void;
    redirectToSignIn: () => void;
    redirectToSignUp: () => void;
    redirectToUserProfile: () => void;
    user: GitHatUser | null;
    session: {
        id: string | null;
    } | null;
    /** Escape hatch — full GitHat hook for anything Clerk doesn't model. */
    __githat: ReturnType<typeof useGitHat>;
};

interface DataItem {
    id: string;
    [key: string]: unknown;
    _createdAt?: string;
    _updatedAt?: string;
}
interface QueryOptions {
    limit?: number;
    cursor?: string;
    filter?: Record<string, unknown>;
}
interface QueryResult<T = DataItem> {
    items: T[];
    collection: string;
    nextCursor: string | null;
    count: number;
}
interface PutResult<T = DataItem> {
    item: T;
    collection: string;
    created: boolean;
}
interface DeleteResult {
    deleted: boolean;
    id: string;
    collection: string;
}
interface BatchOperation {
    type: 'put' | 'delete';
    id: string;
    data?: Record<string, unknown>;
}
interface BatchResult {
    processed: number;
    put: number;
    deleted: number;
    collection: string;
}
/**
 * Hook for interacting with GitHat's Customer Data API.
 * Provides CRUD operations for storing app data in GitHat's managed DynamoDB.
 *
 * @example
 * ```tsx
 * const { put, get, query, remove, batch } = useData();
 *
 * // Store data
 * await put('orders', { id: 'order_123', amount: 99.99, status: 'pending' });
 *
 * // Get single item
 * const order = await get('orders', 'order_123');
 *
 * // Query collection
 * const { items } = await query('orders', { filter: { status: 'pending' } });
 *
 * // Delete item
 * await remove('orders', 'order_123');
 * ```
 */
declare function useData(): {
    /**
     * Store an item in a collection. If the item exists, it will be updated.
     * @param collection - Collection name (e.g., 'orders', 'users')
     * @param data - Data object with required `id` field
     */
    put: <T extends DataItem>(collection: string, data: T) => Promise<PutResult<T>>;
    /**
     * Get a single item from a collection.
     * @param collection - Collection name
     * @param id - Item ID
     */
    get: <T extends DataItem>(collection: string, id: string) => Promise<T | null>;
    /**
     * Query items from a collection with optional filters and pagination.
     * @param collection - Collection name
     * @param options - Query options (limit, cursor, filter)
     */
    query: <T extends DataItem>(collection: string, options?: QueryOptions) => Promise<QueryResult<T>>;
    /**
     * Delete an item from a collection.
     * @param collection - Collection name
     * @param id - Item ID
     */
    remove: (collection: string, id: string) => Promise<DeleteResult>;
    /**
     * Batch operations (put/delete) on a collection.
     * Maximum 100 operations per request.
     * @param collection - Collection name
     * @param operations - Array of operations
     */
    batch: (collection: string, operations: BatchOperation[]) => Promise<BatchResult>;
};

interface SendEmailOptions {
    /** Recipient email address(es). Single string or array of up to 50 addresses. */
    to: string | string[];
    /** Email subject line (max 998 characters). */
    subject: string;
    /** HTML body (optional if text is provided). */
    html?: string;
    /** Plain text body (optional if html is provided). */
    text?: string;
    /** Reply-to email address. Recipients can reply directly to this address. */
    replyTo?: string;
    /**
     * Custom From address. Must be in the form `"Display Name <addr@yourdomain.com>"`
     * or just `"addr@yourdomain.com"`.
     *
     * **The hostname of this address must be a verified sender domain registered for
     * the calling app via `setupEmailDomain` (or `githat email setup-domain` in the CLI).
     * The backend enforces this — unverified From hostnames are rejected with HTTP 422.**
     *
     * When omitted, emails are sent from `noreply@githat.io`.
     *
     * @example
     * ```tsx
     * // After joeshaircuts.com is verified:
     * await send({
     *   to: 'customer@example.com',
     *   subject: 'Your booking is confirmed',
     *   html: '<p>See you soon!</p>',
     *   from: "Joe's Hair Cuts <noreply@joeshaircuts.com>",
     * });
     * ```
     */
    from?: string;
}
interface SendEmailResult {
    /** SES message ID for tracking. */
    messageId: string;
    /** Recipient addresses the email was sent to. */
    to: string[];
    /** Subject line as sent. */
    subject: string;
    /** Whether the email was sent successfully. */
    sent: boolean;
}
interface DkimRecord {
    type: 'CNAME';
    name: string;
    value: string;
    ttl: number;
}
interface EmailDomainSetupResult {
    hostname: string;
    verificationStatus: 'pending' | 'verified' | 'failed';
    mailFromDomain: string;
    dnsRecords: {
        dkim: DkimRecord[];
        mailFrom: DkimRecord;
    };
    message: string;
}
interface EmailDomainStatus {
    hostname: string;
    verificationStatus: 'pending' | 'verified' | 'failed';
    dkimStatus: string;
    mailFromDomain: string;
    dkimTokens: string[];
    createdAt: string;
    verifiedAt: string | null;
}
/**
 * Hook for sending transactional emails via GitHat's Email API.
 *
 * By default, emails are sent from `noreply@githat.io`. To send from your own
 * domain (e.g. `noreply@joeshaircuts.com`), first verify the domain with
 * `setupEmailDomain('joeshaircuts.com')` or via the CLI:
 * `githat email setup-domain joeshaircuts.com`. Then pass `from` in the send
 * options. The backend enforces that the From hostname is verified for the app.
 *
 * @example Default sender
 * ```tsx
 * const { send } = useEmail();
 *
 * await send({
 *   to: 'user@example.com',
 *   subject: 'Your order is confirmed',
 *   html: '<h1>Order Confirmed</h1><p>Thank you!</p>',
 *   replyTo: 'support@myapp.com',
 * });
 * ```
 *
 * @example Custom sender domain (after domain is verified)
 * ```tsx
 * const { send } = useEmail();
 *
 * await send({
 *   to: 'user@example.com',
 *   subject: 'Booking confirmed',
 *   html: '<p>See you soon!</p>',
 *   from: "Joe's Hair Cuts <noreply@joeshaircuts.com>",
 * });
 * ```
 */
declare function useEmail(): {
    /**
     * Send a transactional email.
     *
     * @param options - Email options (to, subject, html/text, replyTo, from)
     *
     * If `from` is provided, its hostname must be a verified sender domain
     * registered for this app. See `setupEmailDomain`.
     */
    send: (options: SendEmailOptions) => Promise<SendEmailResult>;
};
/**
 * Hook for managing custom sender domains.
 *
 * Allows apps to register, inspect, and remove sender domains so that
 * transactional emails can be sent from addresses like `noreply@yourapp.com`
 * instead of the generic `noreply@githat.io`.
 *
 * @example
 * ```tsx
 * const { setupEmailDomain, listEmailDomains, getEmailDomainStatus, deleteEmailDomain } =
 *   useEmailDomains();
 *
 * // Register a domain and get DNS records to add
 * const setup = await setupEmailDomain('joeshaircuts.com');
 * console.log(setup.dnsRecords.dkim); // 3 CNAME records
 *
 * // Poll status later
 * const status = await getEmailDomainStatus('joeshaircuts.com');
 * console.log(status.verificationStatus); // 'verified'
 * ```
 */
declare function useEmailDomains(): {
    setupEmailDomain: (hostname: string) => Promise<EmailDomainSetupResult>;
    listEmailDomains: () => Promise<EmailDomainStatus[]>;
    getEmailDomainStatus: (hostname: string) => Promise<EmailDomainStatus>;
    deleteEmailDomain: (hostname: string) => Promise<{
        deleted: boolean;
        hostname: string;
    }>;
};

interface MfaSetupResult {
    /** Base32-encoded TOTP secret. Shown to users who can't scan the QR. */
    secret: string;
    /** Full otpauth:// URI — also encoded into the QR. */
    otpauthUrl: string;
    /** PNG data URL — drop into <img src=...>. */
    qrcode: string;
}
interface MfaEnableResult {
    /** Plaintext recovery codes. Shown EXACTLY ONCE. */
    recoveryCodes: string[];
}
interface MfaVerifyOpts {
    /** 6-digit TOTP code from the user's authenticator app. */
    code?: string;
    /** XXXX-XXXX recovery code (use one if you've lost your authenticator). */
    recoveryCode?: string;
}
/**
 * useMfa — TOTP enrollment, disable, recovery-code regen, and the
 * login-time challenge verifier.
 *
 * All requests honour the provider's `apiUrl`, publishable key, and
 * `tokenStorage` mode (cookie vs localStorage). On a successful
 * verifyLogin, we hand the resulting tokens to the provider's internal
 * completeSignIn so the auth state lands in the same shape as a
 * regular (non-MFA) login.
 */
declare function useMfa(): {
    setup: () => Promise<MfaSetupResult>;
    enable: (code: string) => Promise<MfaEnableResult>;
    disable: (password: string, code: string) => Promise<{
        success: boolean;
    }>;
    regenerateRecoveryCodes: (password: string) => Promise<MfaEnableResult>;
    verifyLogin: (mfaTicket: string, opts: MfaVerifyOpts) => Promise<{
        user: GitHatUser;
        org: GitHatOrg | null;
        accessToken?: string;
        refreshToken?: string;
        usedRecoveryCode?: boolean;
    }>;
};

interface MagicLinkRequestResult {
    /** Generic success message — the API never reveals whether the email is registered. */
    message: string;
}
interface MagicLinkMfaRequired {
    requiresMfa: true;
    /** Short-lived ticket — pass to <MfaChallenge mfaTicket={...}/> to finish sign-in. */
    mfaTicket: string;
}
interface MagicLinkVerifyResult {
    user: GitHatUser;
    org: GitHatOrg | null;
    accessToken?: string;
    refreshToken?: string;
}
/**
 * useMagicLink — passwordless sign-in via emailed one-time link.
 *
 * Flow:
 *   1. `request(email)` → backend emails the user a `/sign-in/magic?token=...`
 *      link branded for the calling app (Sebastn, Colmado, etc.).
 *   2. User clicks the link, lands on `<MagicLinkVerify/>`.
 *   3. That route calls `verify(token)`. If the user has no MFA, the
 *      provider auth state is updated and we return the tokens. If the
 *      user has TOTP enabled, we return `{ requiresMfa, mfaTicket }` and
 *      the route hands off to `<MfaChallenge/>`.
 *
 * All requests honour the provider's `apiUrl`, publishable key, and
 * `tokenStorage` mode (cookie vs localStorage). On a successful verify,
 * we hand the resulting tokens to the provider's internal completeSignIn
 * so auth state lands in the same shape as a regular login.
 */
declare function useMagicLink(): {
    request: (email: string) => Promise<MagicLinkRequestResult>;
    verify: (token: string) => Promise<MagicLinkVerifyResult | MagicLinkMfaRequired>;
};

interface PasskeyRecord {
    credentialId: string;
    deviceName: string;
    createdAt: string | null;
    lastUsedAt: string | null;
}
interface PasskeyRegisterResult {
    success: true;
    credentialId: string;
    deviceName: string;
}
interface PasskeySignInResult {
    user: GitHatUser;
    org: GitHatOrg | null;
    accessToken?: string;
    refreshToken?: string;
}
/**
 * usePasskey — WebAuthn-based passwordless / second-factor sign-in.
 *
 * Flow on register:
 *   1. POST /auth/passkey/register-options       (auth required)
 *   2. browser → navigator.credentials.create()  (Face ID / Touch ID / key)
 *   3. POST /auth/passkey/register-verify        — server stores credential
 *
 * Flow on signIn:
 *   1. POST /auth/passkey/login-options          (PUBLIC, ?email optional)
 *   2. browser → navigator.credentials.get()
 *   3. POST /auth/passkey/login-verify           — returns tokens
 *   4. provider.completeSignIn(tokens)
 *
 * Passkeys are inherently a strong second factor — the server treats a
 * successful sign-in as MFA-equivalent and skips the TOTP challenge even
 * for users who have it enabled.
 */
declare function usePasskey(): {
    register: (deviceName?: string) => Promise<PasskeyRegisterResult>;
    signIn: (email?: string) => Promise<PasskeySignInResult>;
    list: () => PasskeyRecord[];
    remove: (credentialId: string) => Promise<{
        success: boolean;
    }>;
    isSupported: () => boolean;
};

type WebhookEventType = 'user.signed_in' | 'user.created' | 'user.mfa_enabled' | 'user.mfa_disabled' | 'user.passkey_added' | 'user.passkey_removed' | 'user.email_verified' | 'session.revoked' | 'audit.*' | '*';
interface Webhook {
    id: string;
    url: string;
    events: WebhookEventType[];
    isActive: boolean;
    createdAt: string;
    lastDeliveryStatus: string | null;
}
interface WebhookCreateResult extends Webhook {
    /** HMAC signing secret — returned EXACTLY ONCE. Store it safely. */
    secret: string;
}
interface WebhookDelivery {
    deliveryId: string;
    webhookId: string;
    event: string;
    statusCode: number;
    attemptCount: number;
    deliveredAt: string;
    response: string | null;
}
interface WebhooksListResult {
    webhooks: Webhook[];
}
interface WebhookDeliveriesResult {
    deliveries: WebhookDelivery[];
}
/**
 * useWebhooks — manage webhook subscriptions for the calling app.
 *
 * The X-GitHat-App-Key is sent on every request via the SDK client.
 * All operations target /webhooks/* on the GitHat API.
 */
declare function useWebhooks(): {
    list: () => Promise<WebhooksListResult>;
    get: (id: string) => Promise<{
        webhook: Webhook;
    }>;
    create: (url: string, events: WebhookEventType[]) => Promise<WebhookCreateResult>;
    update: (id: string, patch: Partial<Pick<Webhook, "url" | "events" | "isActive">>) => Promise<Webhook>;
    remove: (id: string) => Promise<{
        success: boolean;
    }>;
    listDeliveries: (id: string) => Promise<WebhookDeliveriesResult>;
};

interface Session {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    country: string | null;
    createdAt: string;
    lastActiveAt: string;
    /** True when this session matches the caller's current refresh token. */
    current: boolean;
}
interface SessionsListResult {
    sessions: Session[];
}
/**
 * useSessions — list and revoke active user sessions.
 *
 * All requests require user authentication (Authorization: Bearer or cookie).
 */
declare function useSessions(): {
    list: () => Promise<SessionsListResult>;
    revoke: (sessionId: string) => Promise<{
        success: boolean;
    }>;
    revokeAll: () => Promise<{
        success: boolean;
        revokedCount: number;
    }>;
};

type AuditEventType = 'login_success' | 'login_failed' | 'mfa_challenge_failed' | 'mfa_enabled' | 'mfa_disabled' | 'password_changed' | 'email_verified' | 'passkey_added' | 'passkey_removed' | 'magic_link_requested' | 'session_revoked' | 'account_locked' | 'user_created';
interface AuditEvent {
    pk: string;
    sk: string;
    event_type: AuditEventType;
    action: string;
    actor_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
}
interface AuditLogListResult {
    events: AuditEvent[];
    /** Base64-encoded cursor for next page; null when no more pages. */
    nextCursor: string | null;
}
interface AuditLogQueryOptions {
    /** Filter to a specific event type */
    type?: AuditEventType;
    /** ISO 8601 timestamp — only return events at or after this time */
    since?: string;
    /** Number of events to return (1–100, default 50) */
    limit?: number;
    /** Pagination cursor from a previous response's nextCursor */
    cursor?: string;
}
/**
 * useAuditLog — read the current user's sign-in activity log.
 *
 * All requests require user authentication.
 * Events are returned newest-first (descending sort key).
 */
declare function useAuditLog(): {
    list: (opts?: AuditLogQueryOptions) => Promise<AuditLogListResult>;
};

/**
 * Lifecycle status of the realtime WebSocket connection.
 *
 * - `idle`        — not yet started (no topic subscribed)
 * - `connecting`  — WebSocket is being established
 * - `connected`   — connection open and authenticated
 * - `reconnecting`— connection lost, back-off timer running
 * - `closed`      — permanently closed (e.g. auth failure, explicit close)
 */
type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
/** A message received from the WebSocket server. */
interface RealtimeMessage {
    topic: string;
    data: unknown;
    ts: string;
}
type TopicHandler = (message: RealtimeMessage) => void;
/**
 * `useRealtime()` — subscribe to live server-push events over WebSocket.
 *
 * Maintains a single multiplexed WebSocket connection per app.
 * Auto-reconnects with exponential back-off (1s/2s/4s/8s/30s cap).
 *
 * @example
 * ```tsx
 * const { subscribe, unsubscribe, status } = useRealtime();
 *
 * useEffect(() => {
 *   const unsub = subscribe(`audit.${user.id}`, (event) => {
 *     console.log('new audit event:', event.data);
 *   });
 *   return unsub;
 * }, [user.id]);
 * ```
 */
declare function useRealtime(): {
    subscribe: (topic: string, handler: TopicHandler) => (() => void);
    unsubscribe: (topic: string, handler: TopicHandler) => void;
    status: RealtimeStatus;
};

/** A single RLS predicate node in the JSON DSL. */
type RLSPredicate = {
    type: 'public';
} | {
    type: 'fieldEquals';
    field: string;
    context: 'callerUserId' | 'callerOrgId';
} | {
    type: 'fieldIn';
    field: string;
    contextList: 'callerOrgIds';
} | {
    type: 'orgRoleAtLeast';
    role: 'owner' | 'admin' | 'member';
} | {
    type: 'and';
    rules: RLSPredicate[];
} | {
    type: 'or';
    rules: RLSPredicate[];
} | {
    type: 'not';
    rules: [RLSPredicate];
};
/** A stored RLS policy for a collection. */
interface RLSPolicy {
    /** The app ID this policy belongs to (DynamoDB PK). */
    pk: string;
    /** The collection name (DynamoDB SK). */
    sk: string;
    collection: string;
    /** Field name in the row that identifies the owner. Default: 'userId'. */
    ownerField: string;
    readPolicy: RLSPredicate | null;
    writePolicy: RLSPredicate | null;
    enabled: boolean;
    updatedAt: string;
}
/** Returned by testPolicy — explains whether an operation would be allowed. */
interface RLSEvaluation {
    allowed: boolean;
    reasons: string[];
    policy: RLSPredicate | null;
}
/** Options for setPolicy. */
interface SetPolicyOptions {
    ownerField?: string;
    readPolicy?: RLSPredicate | null;
    writePolicy?: RLSPredicate | null;
    enabled?: boolean;
}
/** Options for testPolicy. */
interface TestPolicyOptions {
    collection: string;
    /** A sample data row to test the policy against. */
    row: Record<string, unknown>;
    operation: 'read' | 'write';
    context: {
        userId?: string;
        orgId?: string;
        orgRoles?: Record<string, 'owner' | 'admin' | 'member'>;
    };
}
/**
 * useRLS — manage Row-Level Security policies for the calling app.
 *
 * All operations target /rls/* on the GitHat API.
 * Requires an org admin JWT and the X-GitHat-App-Key header (sent
 * automatically via the SDK publishableKey).
 *
 * Phase 4.3.
 */
declare function useRLS(): {
    listPolicies: () => Promise<{
        policies: RLSPolicy[];
    }>;
    getPolicy: (collection: string) => Promise<{
        policy: RLSPolicy;
    }>;
    setPolicy: (collection: string, opts: SetPolicyOptions) => Promise<{
        policy: RLSPolicy;
    }>;
    deletePolicy: (collection: string) => Promise<{
        deleted: boolean;
        collection: string;
    }>;
    testPolicy: (opts: TestPolicyOptions) => Promise<RLSEvaluation>;
};

type DomainProvider = 'route53' | 'cloudflare' | 'godaddy' | 'namecheap' | 'generic';
type DomainVerificationStatus = 'pending_dns' | 'dns_verified' | 'cert_pending' | 'cert_issued' | 'cf_attaching' | 'live' | 'failed';
interface DnsRecord {
    type: 'CNAME' | 'A' | 'TXT';
    name: string;
    value: string;
    description?: string;
}
interface CertValidationRecord {
    name: string;
    type: string;
    value: string;
}
interface DomainOnboardingRecord {
    domain: string;
    appId: string;
    status: DomainVerificationStatus;
    provider: DomainProvider;
    dnsRecords: DnsRecord[];
    certArn: string | null;
    certStatus: string | null;
    certValidationRecord: CertValidationRecord | null;
    certAutoValidated: boolean;
    attachedToCfAt: string | null;
    failureReason: string | null;
    lastCheckedAt: string;
    createdAt: string;
}
interface OnboardResult {
    domain: string;
    appId: string;
    status: DomainVerificationStatus;
    provider: DomainProvider;
    dnsRecords: DnsRecord[];
    instructions: {
        summary: string;
        autoWrite: boolean;
        steps: string[];
        dnsRecords: DnsRecord[];
    };
    next: string;
}
interface DomainCheckResult {
    domain: string;
    status: DomainVerificationStatus;
    certStatus: string | null;
    certArn: string | null;
    certValidationRecord: CertValidationRecord | null;
    attachedToCfAt: string | null;
    lastCheckedAt: string;
}
interface DomainAvailability {
    domain: string;
    available: boolean;
    awsPriceUsd: number | null;
    platformFeeUsd: number;
    totalUsd: number | null;
    availability: string;
}
interface AvailabilityResult {
    name: string;
    domains: DomainAvailability[];
}
interface RegisterDomainOptions {
    domain: string;
    autoRenew?: boolean;
    contactInfo: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        address: string;
        city: string;
        state?: string;
        countryCode: string;
        zipCode: string;
    };
}
interface RegisterResult {
    domain: string;
    operationId: string;
    message: string;
}
interface RegistrationStatus {
    operationId: string;
    status: string;
    type: string;
    domainName: string;
    submittedDate: string;
    lastUpdatedDate: string;
    message: string | null;
}
/**
 * useDomains — manage custom domain onboarding for a GitHat app.
 *
 * Covers both Flow A (Bring Your Own Domain) and Flow B (register through GitHat).
 *
 * @example
 * const { addDomain, getStatus, checkAvailability } = useDomains();
 * const result = await addDomain('app_xyz', 'mystore.com');
 */
declare function useDomains(): {
    addDomain: (appId: string, domain: string, opts?: {
        provider?: DomainProvider;
        cfApiToken?: string;
    }) => Promise<OnboardResult>;
    getStatus: (appId: string, domain: string) => Promise<DomainOnboardingRecord>;
    checkDomain: (appId: string, domain: string) => Promise<DomainCheckResult>;
    removeDomain: (appId: string, domain: string) => Promise<{
        domain: string;
        deleted: boolean;
    }>;
    checkAvailability: (name: string, tlds?: string[]) => Promise<AvailabilityResult>;
    registerDomain: (opts: RegisterDomainOptions) => Promise<RegisterResult>;
    getRegistration: (operationId: string) => Promise<RegistrationStatus>;
};

type DeploymentStatus = 'queued' | 'building' | 'success' | 'failed';
interface Deployment {
    id: string;
    appId: string;
    orgId: string;
    commit: string;
    branch: string;
    repoUrl: string;
    status: DeploymentStatus;
    buildArn: string | null;
    buildId: string | null;
    triggeredBy?: string;
    createdAt: string;
    updatedAt: string;
    finishedAt?: string;
    errorMessage?: string;
}
interface DeploymentsListResult {
    deployments: Deployment[];
    total: number;
}
interface LogLine {
    timestamp: string;
    message: string;
}
interface DeploymentLogsResult {
    lines: LogLine[];
    buildId: string | null;
    deploymentId: string;
    message?: string;
}
interface RedeployResult {
    deploymentId: string;
    buildArn: string;
    buildId: string;
    commit: string;
    status: DeploymentStatus;
    message: string;
}
/**
 * useDeployments — list, inspect, and manage deployments for a GitHat app.
 *
 * @param appId  The app ID to scope operations to.
 *
 * @example
 * const { list, getLogs, redeployLatest } = useDeployments('app_xyz');
 * const { deployments } = await list({ limit: 10 });
 */
declare function useDeployments(appId: string): {
    list: (opts?: {
        limit?: number;
        since?: string;
    }) => Promise<DeploymentsListResult>;
    get: (deploymentId: string) => Promise<{
        deployment: Deployment;
    }>;
    getLogs: (deploymentId: string, opts?: {
        limit?: number;
    }) => Promise<DeploymentLogsResult>;
    redeployLatest: () => Promise<RedeployResult>;
};

interface AnalyticsOverview {
    signups: number;
    signins: number;
    apiCalls: number;
    storageMb: number;
    passkeys: number;
    since: string;
    until: string;
}
interface AnalyticsPoint {
    ts: string;
    value: number;
}
interface AnalyticsSeries {
    metric: string;
    granularity: 'day' | 'hour';
    since: string;
    until: string;
    points: AnalyticsPoint[];
}
interface AnalyticsFunnelStep {
    step: string;
    count: number;
    pct: number;
}
interface AnalyticsFunnel {
    funnel: AnalyticsFunnelStep[];
}
interface TopUser {
    userId: string;
    count: number;
}
interface TopUsersResult {
    metric: string;
    since: string;
    users: TopUser[];
}
interface OrgAnalyticsOverview {
    numApps: number;
    activeUsers: number;
    totalApiCalls: number;
    billingTier: string;
    since: string;
    until: string;
}
type TimeSeriesMetric = 'signups' | 'signins' | 'api_calls' | 'mfa_challenges' | 'audit_events' | 'webhook_deliveries' | 'storage_uploads';
interface TimeSeriesOptions {
    metric: TimeSeriesMetric;
    granularity?: 'day' | 'hour';
    since?: string;
    until?: string;
}
interface TopUsersOptions {
    metric?: 'signins' | 'mfa_challenges' | 'audit_events';
    limit?: number;
    since?: string;
}
/**
 * useAnalytics — access per-app analytics dashboards.
 *
 * @param appId  The app ID to scope analytics to.
 *
 * @example
 * const { getOverview, getTimeSeries, getFunnels } = useAnalytics('app_xyz');
 * const overview = await getOverview();
 */
declare function useAnalytics(appId: string): {
    getOverview: () => Promise<AnalyticsOverview>;
    getTimeSeries: (opts: TimeSeriesOptions) => Promise<AnalyticsSeries>;
    getTopUsers: (opts?: TopUsersOptions) => Promise<TopUsersResult>;
    getFunnels: () => Promise<AnalyticsFunnel>;
};
/**
 * useOrgAnalytics — access org-wide KPI overview.
 *
 * @param orgId  The organization ID.
 *
 * @example
 * const { getOverview } = useOrgAnalytics('org_abc');
 * const overview = await getOverview();
 */
declare function useOrgAnalytics(orgId: string): {
    getOverview: () => Promise<OrgAnalyticsOverview>;
};

interface DeployHealth {
    successPct: number;
    totalDeploys: number;
    failed: number;
    p50Duration: number;
    p95Duration: number;
    days: number;
    since: string;
}
interface RecentFailure {
    id: string;
    appId: string;
    commit: string;
    branch: string;
    createdAt: string;
    errorExcerpt: string;
}
interface RecentFailuresResult {
    failures: RecentFailure[];
    total: number;
}
interface PerAppDeploy {
    appId: string;
    total: number;
    success: number;
    failed: number;
    building: number;
}
interface PerAppDeploysResult {
    apps: PerAppDeploy[];
    since: string;
}
interface LambdaMetric {
    functionName: string;
    errors: number;
    throttles: number;
    durationP99Ms: number;
}
interface LambdaMetricsResult {
    functions: LambdaMetric[];
    since: string;
    until: string;
}
interface ApiGatewayMetrics {
    totalRequests: number;
    count4xx: number;
    count5xx: number;
    rate4xxPct: number;
    rate5xxPct: number;
    p50LatencyMs: number;
    p99LatencyMs: number;
    since: string;
    until: string;
}
/**
 * useObservability — pull deploy health and Lambda/API Gateway metrics.
 *
 * @example
 * const { getDeployHealth, getRecentFailures, getLambdaMetrics } = useObservability();
 * const health = await getDeployHealth();
 */
declare function useObservability(): {
    getDeployHealth: (days?: number) => Promise<DeployHealth>;
    getRecentFailures: (limit?: number) => Promise<RecentFailuresResult>;
    getPerAppDeploys: (since?: string) => Promise<PerAppDeploysResult>;
    getLambdaMetrics: (since?: string) => Promise<LambdaMetricsResult>;
    getApiMetrics: (since?: string) => Promise<ApiGatewayMetrics>;
};

type BillingPlan = 'free' | 'starter' | 'pro' | 'enterprise';
type BillingPlanStatus = 'active' | 'past_due' | 'canceling' | 'canceled';
interface BillingLimits {
    apps: number;
    seats: number;
    apiCallsPerMonth: number;
    emailsPerMonth: number;
}
interface BillingUsage {
    apps: number;
    seats: number;
}
interface BillingStatus {
    plan: BillingPlan;
    planStatus: BillingPlanStatus;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    limits: BillingLimits;
    usage: BillingUsage;
}
interface CheckoutResult {
    url: string;
}
interface PortalResult {
    url: string;
}
interface CancelResult {
    canceled: boolean;
    cancelAt: string;
}
/**
 * useBilling — manage the GitHat org-level subscription plan.
 *
 * Distinct from useAppBilling (which manages Stripe Connect for end-users).
 * This hook is for orgs paying GitHat for the platform.
 */
declare function useBilling(orgId: string): {
    getCurrentPlan: () => Promise<BillingStatus>;
    openCheckout: (plan: "starter" | "pro" | "enterprise") => Promise<CheckoutResult>;
    openPortal: () => Promise<PortalResult>;
    cancel: () => Promise<CancelResult>;
};

interface AppBillingStatus {
    connected: boolean;
    stripeAccountId: string | null;
    stripeAccountStatus: 'pending' | 'active' | 'restricted' | null;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    defaultCurrency: string;
    meters: Record<string, string>;
}
interface ConnectLinkResult {
    url: string;
    expiresAt: string;
}
interface LineItem {
    price: string;
    quantity: number;
}
interface AppCheckoutResult {
    url: string;
    sessionId: string;
}
interface AppPortalResult {
    url: string;
}
/**
 * useAppBilling — manage Stripe Connect for a customer app's end-users.
 *
 * Distinct from useBilling (which is for orgs paying GitHat for the platform).
 * This hook lets customer apps (sebastn, colmado, etc.) charge their own users.
 */
declare function useAppBilling(appId: string, orgId: string): {
    getStatus: () => Promise<AppBillingStatus>;
    connectOnboarding: (opts?: {
        refreshUrl?: string;
        returnUrl?: string;
    }) => Promise<ConnectLinkResult>;
    createCheckout: (opts: {
        lineItems: LineItem[];
        successUrl: string;
        cancelUrl: string;
        platformFeePercent?: number;
    }) => Promise<AppCheckoutResult>;
    openPortal: (opts: {
        customerId: string;
        returnUrl?: string;
    }) => Promise<AppPortalResult>;
};

type OAuthProvider = 'google' | 'apple' | 'microsoft' | 'facebook' | 'instagram' | 'tiktok' | 'github';
interface SignInFormProps {
    onSuccess?: () => void;
    signUpUrl?: string;
    forgotPasswordUrl?: string;
    /**
     * Display name of the app the user is signing into.
     * Resolution order: prop → GitHatProvider config.appName → undefined.
     * When undefined, the form renders "Sign in" with no platform branding.
     */
    appName?: string;
    /**
     * Optional logo / brand mark rendered above the title. Use for the
     * customer's app logo — keeps every GitHat-Way sign-in screen visually
     * branded by the app, not by GitHat.
     */
    logo?: React.ReactNode;
    /**
     * OAuth providers to render below the email/password form. Defaults to
     * the standard six (Google, Apple, Microsoft, Facebook, Instagram, TikTok).
     * Pass `[]` to hide the OAuth section entirely. Pass `['google', 'apple']`
     * for a minimal set. GitHub is opt-in (developer-focused apps).
     */
    oauth?: OAuthProvider[];
    /**
     * Footer rendered below the OAuth section. `'githat'` (default) shows
     * a small "A GitHat Company" link. `'none'` hides it. Pass any ReactNode
     * to render custom footer content.
     */
    footer?: 'githat' | 'none' | React.ReactNode;
    /**
     * Base URL used for OAuth redirect URIs. Each provider's callback is
     * appended as `/auth/{provider}/callback`. Defaults to
     * `window.location.origin` at click time.
     */
    oauthRedirectBase?: string;
    /**
     * Show the "Use a magic link instead" toggle. Defaults to `true` for
     * backward compatibility. Pass `false` when the host app has not (yet)
     * shipped a `/sign-in/magic` landing route — without that route, the
     * email's link target lands on a 404. The toggle was added in 0.10
     * but the matching landing route is consumer-side; this prop lets a
     * consumer ship the toggle when their landing route is ready, instead
     * of the audience seeing it before they can use it.
     */
    showMagicLink?: boolean;
}
declare function SignInForm({ onSuccess, signUpUrl, forgotPasswordUrl, appName, logo, oauth, footer, oauthRedirectBase, showMagicLink, }: SignInFormProps): react_jsx_runtime.JSX.Element;

interface SignUpFormProps {
    onSuccess?: (result: {
        requiresVerification: boolean;
        email: string;
    }) => void;
    signInUrl?: string;
    /** App/business name shown in the heading. Falls back to GitHatProvider config.appName. */
    appName?: string;
    /**
     * Optional logo / brand mark rendered above the title. Mirrors the
     * <SignInForm> logo prop so sign-in and sign-up screens stay visually
     * symmetric.
     */
    logo?: React.ReactNode;
    /**
     * OAuth providers to render below the form. Defaults to the standard six
     * (Google, Apple, Microsoft, Facebook, Instagram, TikTok). Pass `[]` to
     * hide the OAuth section. Pass `'github'` to opt in for developer apps.
     */
    oauth?: OAuthProvider[];
    /**
     * Footer below the OAuth section. `'githat'` (default) shows the small
     * "A GitHat Company" link; `'none'` hides it; pass any ReactNode for
     * custom footer content.
     */
    footer?: 'githat' | 'none' | React.ReactNode;
    /** Base URL used for OAuth redirects. Defaults to window.location.origin. */
    oauthRedirectBase?: string;
}
declare function SignUpForm({ onSuccess, signInUrl, appName, logo, oauth, footer, oauthRedirectBase, }: SignUpFormProps): react_jsx_runtime.JSX.Element;

interface SignInButtonProps {
    className?: string;
    children?: React.ReactNode;
    href?: string;
}
declare function SignInButton({ className, children, href }: SignInButtonProps): react_jsx_runtime.JSX.Element;

interface ContinueWithGitHatProps {
    /** Override the redirect URL after sign-in. Falls back to the parent
     *  <GitHatProvider>'s `afterSignInUrl`. */
    redirectUrl?: string;
    /** Override the GitHat-hosted sign-in URL. Defaults to
     *  `https://githat.io/signin`. */
    signInUrl?: string;
    /** Replace the entire className with your own — useful when an app's
     *  design system shouldn't inherit the default GitHat-green button. */
    className?: string;
    /** Replace the button text. Default: "Continue with GitHat". */
    children?: React.ReactNode;
    /** Disable the button (e.g. while a parent form is submitting). */
    disabled?: boolean;
}
declare function ContinueWithGitHat({ redirectUrl, signInUrl, className, children, disabled, }: ContinueWithGitHatProps): react_jsx_runtime.JSX.Element;

interface SignUpButtonProps {
    className?: string;
    children?: React.ReactNode;
    href?: string;
}
declare function SignUpButton({ className, children, href }: SignUpButtonProps): react_jsx_runtime.JSX.Element;

interface UserButtonProps {
    /** URL to redirect to after sign-out. Defaults to the config's afterSignOutUrl. */
    afterSignOutUrl?: string;
}
declare function UserButton({ afterSignOutUrl }?: UserButtonProps): react_jsx_runtime.JSX.Element | null;

declare function OrgSwitcher(): react_jsx_runtime.JSX.Element | null;

interface VerifiedBadgeProps {
    type: 'agent';
    identifier: string;
    label?: string;
}
declare function VerifiedBadge({ type, identifier, label }: VerifiedBadgeProps): react_jsx_runtime.JSX.Element | null;

interface ProtectedRouteProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}
declare function ProtectedRoute({ children, fallback }: ProtectedRouteProps): react_jsx_runtime.JSX.Element | null;

interface ForgotPasswordFormProps {
    onSuccess?: (email: string) => void;
    onError?: (error: Error) => void;
    signInUrl?: string;
}
declare function ForgotPasswordForm({ onSuccess, onError, signInUrl, }: ForgotPasswordFormProps): react_jsx_runtime.JSX.Element;

interface ResetPasswordFormProps {
    token: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    signInUrl?: string;
    minPasswordLength?: number;
}
declare function ResetPasswordForm({ token, onSuccess, onError, signInUrl, minPasswordLength, }: ResetPasswordFormProps): react_jsx_runtime.JSX.Element;

interface VerifyEmailStatusProps {
    token: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    signInUrl?: string;
    redirectDelay?: number;
}
declare function VerifyEmailStatus({ token, onSuccess, onError, signInUrl, redirectDelay, }: VerifyEmailStatusProps): react_jsx_runtime.JSX.Element;

interface ChangePasswordFormProps {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    minPasswordLength?: number;
}
declare function ChangePasswordForm({ onSuccess, onError, minPasswordLength, }: ChangePasswordFormProps): react_jsx_runtime.JSX.Element;

interface MfaSetupFormProps {
    /** Called once the user has acknowledged saving their recovery codes. */
    onComplete?: () => void;
    /** Called if the user closes the wizard partway through. */
    onCancel?: () => void;
}
/**
 * MfaSetupForm — 3-step TOTP enrollment wizard.
 *   1. Scan: shows QR + manual secret + 6-digit verify input.
 *   2. Backup: shows the 10 recovery codes once, with download/copy.
 *   3. Done: confirmation screen.
 */
declare function MfaSetupForm({ onComplete, onCancel }: MfaSetupFormProps): react_jsx_runtime.JSX.Element;

interface MfaChallengeResult {
    user: GitHatUser;
    org: GitHatOrg | null;
    accessToken?: string;
    refreshToken?: string;
    usedRecoveryCode?: boolean;
}
interface MfaChallengeProps {
    /** Ticket returned by /auth/login (or /auth/oauth/*) when requiresMfa was true. */
    mfaTicket: string;
    onSuccess: (result: MfaChallengeResult) => void;
    onError?: (err: Error) => void;
    /** Optional title override (default: "Two-factor authentication"). */
    title?: string;
}
/**
 * MfaChallenge — drop-in TOTP / recovery-code entry UI for the
 * MFA-gated half of sign-in. Renders a 6-digit segmented input with
 * paste support and auto-advance, plus a toggle to switch to a
 * recovery code if the user lost their authenticator.
 */
declare function MfaChallenge({ mfaTicket, onSuccess, onError, title }: MfaChallengeProps): react_jsx_runtime.JSX.Element;

/**
 * MfaManager — drop into the account/security panel. Reads
 * `useAuth().user.mfaEnabled` to decide which UI to show:
 *   - disabled → "Enable 2FA" button → opens <MfaSetupForm/>
 *   - enabled  → "Disable 2FA" + "Regenerate recovery codes" buttons
 *                (each opens a password+code prompt modal)
 */
declare function MfaManager(): react_jsx_runtime.JSX.Element;

interface MagicLinkVerifyProps {
    /**
     * Where to send the user after a successful sign-in. Defaults to the
     * provider's `afterSignInUrl`. Falls back to `/` if neither is set.
     */
    afterSignInUrl?: string;
    /**
     * Optional logo / brand mark rendered above the status block.
     */
    logo?: React.ReactNode;
    /**
     * URL to send users back to when the link is invalid or expired.
     * Defaults to `/sign-in`.
     */
    signInUrl?: string;
}
/**
 * MagicLinkVerify — drop-in route component for `/sign-in/magic`.
 *
 * Reads `?token=` from the URL, calls /auth/magic-link/verify, and:
 *   - on success (no MFA) → redirects to afterSignInUrl
 *   - on success (MFA on) → renders <MfaChallenge/> inline
 *   - on failure          → shows "invalid or expired" with a retry link
 *
 * MUST be wrapped in <Suspense> by the host app — `useSearchParams`
 * requires it under Next.js static export.
 */
declare function MagicLinkVerify({ afterSignInUrl, logo, signInUrl, }: MagicLinkVerifyProps): react_jsx_runtime.JSX.Element;

interface PasskeyButtonProps {
    /**
     * 'register' — enroll a new passkey for the current signed-in user.
     * 'signIn'   — sign in via an existing passkey (PUBLIC, no auth needed).
     */
    mode: 'register' | 'signIn';
    /**
     * Optional email for the explicit sign-in flow. When omitted, the OS
     * prompts the user to pick a discoverable credential — better UX.
     */
    email?: string;
    /** Optional friendly device label for register mode ("MacBook Pro"). */
    deviceName?: string;
    /**
     * Fires after a successful register or signIn. The verify endpoint has
     * already pushed auth state on signIn — callers usually use this to
     * navigate the user forward.
     */
    onSuccess?: (result: PasskeyRegisterResult | PasskeySignInResult) => void;
    /** Called on any failure (incl. user-cancelled prompt). */
    onError?: (err: Error) => void;
    /** Custom button text. Defaults adjust per mode. */
    children?: React.ReactNode;
    /** className passthrough for the rendered <button>. */
    className?: string;
    /** Tailwind-/inline-friendly style override. */
    style?: React.CSSProperties;
    /** Render as full-width primary, or as a smaller secondary control. */
    variant?: 'primary' | 'outline';
}
/**
 * <PasskeyButton/> — drop-in WebAuthn button. Hidden when the browser
 * doesn't expose `window.PublicKeyCredential` (no graceful fallback exists
 * for credentials.create / .get).
 */
declare function PasskeyButton({ mode, email, deviceName, onSuccess, onError, children, className, style, variant, }: PasskeyButtonProps): react_jsx_runtime.JSX.Element | null;

interface GitHubButtonProps {
    /** Text to display on the button */
    children?: React.ReactNode;
    /** Custom redirect URI after GitHub auth */
    redirectUri?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Additional class names */
    className?: string;
    /** Button variant */
    variant?: 'default' | 'outline';
    /** Disable the button */
    disabled?: boolean;
}
declare function GitHubButton({ children, redirectUri, onSuccess, onError, className, variant, disabled, }: GitHubButtonProps): react_jsx_runtime.JSX.Element;

interface GitHubCallbackProps {
    /** URL to redirect to after successful auth */
    redirectUrl?: string;
    /** URL for new users (onboarding) */
    newUserRedirectUrl?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: (error: string) => React.ReactNode;
}
declare function GitHubCallback({ redirectUrl, newUserRedirectUrl, onSuccess, onError, loadingComponent, errorComponent, }: GitHubCallbackProps): react_jsx_runtime.JSX.Element;

interface GoogleButtonProps {
    /** Text to display on the button */
    children?: React.ReactNode;
    /** Custom redirect URI after Google auth */
    redirectUri?: string;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Additional class names */
    className?: string;
    /** Button variant */
    variant?: 'default' | 'outline';
    /** Disable the button */
    disabled?: boolean;
}
declare function GoogleButton({ children, redirectUri, onError, className, variant, disabled, }: GoogleButtonProps): react_jsx_runtime.JSX.Element;

interface GoogleCallbackProps {
    /** URL to redirect to after successful auth */
    redirectUrl?: string;
    /** URL for new users (onboarding) */
    newUserRedirectUrl?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: (error: string) => React.ReactNode;
}
declare function GoogleCallback({ redirectUrl, newUserRedirectUrl, onSuccess, onError, loadingComponent, errorComponent, }: GoogleCallbackProps): react_jsx_runtime.JSX.Element;

interface MicrosoftButtonProps {
    /** Text to display on the button */
    children?: React.ReactNode;
    /** Custom redirect URI after Microsoft auth */
    redirectUri?: string;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Additional class names */
    className?: string;
    /** Button variant */
    variant?: 'default' | 'outline';
    /** Disable the button */
    disabled?: boolean;
}
declare function MicrosoftButton({ children, redirectUri, onError, className, variant, disabled, }: MicrosoftButtonProps): react_jsx_runtime.JSX.Element;

interface MicrosoftCallbackProps {
    /** URL to redirect to after successful auth */
    redirectUrl?: string;
    /** URL for new users (onboarding) */
    newUserRedirectUrl?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: (error: string) => React.ReactNode;
}
declare function MicrosoftCallback({ redirectUrl, newUserRedirectUrl, onSuccess, onError, loadingComponent, errorComponent, }: MicrosoftCallbackProps): react_jsx_runtime.JSX.Element;

interface FacebookButtonProps {
    /** Text to display on the button */
    children?: React.ReactNode;
    /** Custom redirect URI after Facebook auth */
    redirectUri?: string;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Additional class names */
    className?: string;
    /** Button variant */
    variant?: 'default' | 'outline';
    /** Disable the button */
    disabled?: boolean;
}
declare function FacebookButton({ children, redirectUri, onError, className, variant, disabled, }: FacebookButtonProps): react_jsx_runtime.JSX.Element;

interface FacebookCallbackProps {
    /** URL to redirect to after successful auth */
    redirectUrl?: string;
    /** URL for new users (onboarding) */
    newUserRedirectUrl?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: (error: string) => React.ReactNode;
}
declare function FacebookCallback({ redirectUrl, newUserRedirectUrl, onSuccess, onError, loadingComponent, errorComponent, }: FacebookCallbackProps): react_jsx_runtime.JSX.Element;

interface AppleButtonProps {
    /** Text to display on the button */
    children?: React.ReactNode;
    /** Custom redirect URI after Apple auth */
    redirectUri?: string;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Additional class names */
    className?: string;
    /** Button variant */
    variant?: 'default' | 'outline';
    /** Disable the button */
    disabled?: boolean;
}
declare function AppleButton({ children, redirectUri, onError, className, variant, disabled, }: AppleButtonProps): react_jsx_runtime.JSX.Element;

interface AppleCallbackProps {
    /** URL to redirect to after successful auth */
    redirectUrl?: string;
    /** URL for new users (onboarding) */
    newUserRedirectUrl?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: (error: string) => React.ReactNode;
}
/**
 * Handles the OAuth callback for Sign in with Apple.
 *
 * **IMPORTANT — Apple uses `response_mode=form_post`, not a GET redirect.**
 *
 * Unlike Google/Microsoft/Facebook/GitHub (which redirect back with `?code=...` in the
 * URL query string), Apple POSTs the authorization response as `application/x-www-form-urlencoded`
 * form data to your callback URL. This means:
 *
 * 1. **You cannot use a plain Next.js page component** as the callback route. You must use a
 *    Next.js Route Handler (App Router) or API Route (Pages Router) that reads the POST body.
 *
 * 2. Your Route Handler should extract `code`, `state`, and (on first sign-in only) `user`
 *    from the POST body, then redirect the browser to an intermediate page — e.g.:
 *    ```
 *    /auth/apple/callback?code=...&state=...&user=<url-encoded-JSON>
 *    ```
 *
 * 3. Mount this `<AppleCallback>` component on that intermediate page. It reads `code`,
 *    `state`, and `user` from `window.location.search` and calls `signInWithApple`.
 *
 * 4. The `user` field is a JSON-stringified object `{ name: { firstName, lastName }, email }`
 *    that Apple sends **only on the very first authorization**. On subsequent sign-ins the
 *    `user` field is absent — this is normal Apple behavior.
 *
 * Example Route Handler (`app/auth/apple/callback/route.ts`):
 * ```ts
 * import { NextRequest, NextResponse } from 'next/server';
 *
 * export async function POST(req: NextRequest) {
 *   const body = await req.formData();
 *   const code = body.get('code') as string;
 *   const state = body.get('state') as string | null;
 *   const user = body.get('user') as string | null;
 *
 *   const params = new URLSearchParams({ code });
 *   if (state) params.set('state', state);
 *   if (user) params.set('user', user);
 *
 *   return NextResponse.redirect(
 *     new URL(`/auth/apple/done?${params}`, req.url)
 *   );
 * }
 * ```
 * Then mount `<AppleCallback>` on `/auth/apple/done`.
 */
declare function AppleCallback({ redirectUrl, newUserRedirectUrl, onSuccess, onError, loadingComponent, errorComponent, }: AppleCallbackProps): react_jsx_runtime.JSX.Element;

interface InstagramButtonProps {
    /** Text to display on the button */
    children?: React.ReactNode;
    /** Custom redirect URI after Instagram auth */
    redirectUri?: string;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Additional class names */
    className?: string;
    /** Button variant */
    variant?: 'default' | 'outline';
    /** Disable the button */
    disabled?: boolean;
}
declare function InstagramButton({ children, redirectUri, onError, className, variant, disabled, }: InstagramButtonProps): react_jsx_runtime.JSX.Element;

interface InstagramCallbackProps {
    /** URL to redirect to after successful auth */
    redirectUrl?: string;
    /** URL for new users (onboarding) */
    newUserRedirectUrl?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: (error: string) => React.ReactNode;
}
declare function InstagramCallback({ redirectUrl, newUserRedirectUrl, onSuccess, onError, loadingComponent, errorComponent, }: InstagramCallbackProps): react_jsx_runtime.JSX.Element;

interface TikTokButtonProps {
    /** Text to display on the button */
    children?: React.ReactNode;
    /** Custom redirect URI after TikTok auth */
    redirectUri?: string;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Additional class names */
    className?: string;
    /** Button variant */
    variant?: 'default' | 'outline';
    /** Disable the button */
    disabled?: boolean;
}
declare function TikTokButton({ children, redirectUri, onError, className, variant, disabled, }: TikTokButtonProps): react_jsx_runtime.JSX.Element;

interface TikTokCallbackProps {
    /** URL to redirect to after successful auth */
    redirectUrl?: string;
    /** URL for new users (onboarding) */
    newUserRedirectUrl?: string;
    /** Callback on successful auth */
    onSuccess?: (result: {
        user: any;
        org: any;
        isNewUser: boolean;
    }) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: (error: string) => React.ReactNode;
}
declare function TikTokCallback({ redirectUrl, newUserRedirectUrl, onSuccess, onError, loadingComponent, errorComponent, }: TikTokCallbackProps): react_jsx_runtime.JSX.Element;

interface StorageDropzoneProps {
    /** Called when an upload finishes successfully */
    onUpload?: (result: StorageUploadResult) => void;
    /** Called when an upload fails */
    onError?: (error: Error) => void;
    /** Override upload options (isPublic, metadata). Default: private */
    uploadOptions?: StorageUploadOptions;
    /**
     * Accepted MIME types (same format as <input accept>).
     * Example: "image/*,application/pdf"
     */
    accept?: string;
    /** Maximum file size in bytes. Default: 100 MB */
    maxSize?: number;
    /** Replace the default UI by rendering children inside the dropzone */
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}
/**
 * StorageDropzone — drag-drop + click-to-browse file upload with progress.
 *
 * Uses useStorage() internally — presigns via the GitHat API then uploads
 * directly to S3. Works with Next.js static export (no server actions).
 *
 * @example
 * ```tsx
 * <StorageDropzone
 *   accept="image/*"
 *   onUpload={(obj) => console.log('uploaded:', obj.objectId)}
 * />
 * ```
 */
declare function StorageDropzone({ onUpload, onError, uploadOptions, accept, maxSize, children, className, disabled, }: StorageDropzoneProps): react_jsx_runtime.JSX.Element;

interface DomainOnboardingWizardProps {
    appId: string;
    /** Called when domain reaches 'live' status */
    onLive?: (domain: string) => void;
    /** Called when user closes/cancels the wizard */
    onClose?: () => void;
    className?: string;
}
declare function DomainOnboardingWizard({ appId, onLive, onClose, className, }: DomainOnboardingWizardProps): react_jsx_runtime.JSX.Element;

interface DeploymentListProps {
    appId: string;
    /** Max deployments to show at once (default 20) */
    limit?: number;
    /** Called when user clicks "Redeploy" and it succeeds */
    onRedeployed?: (deploymentId: string) => void;
    className?: string;
}
declare function DeploymentList({ appId, limit, onRedeployed, className, }: DeploymentListProps): react_jsx_runtime.JSX.Element;

interface PricingTableProps {
    /** GitHat org ID for billing context */
    orgId: string;
    /** Currently active plan (from useBilling().getCurrentPlan()) */
    currentPlan?: string;
    /** Called after openCheckout resolves with URL — defaults to window.location.href redirect */
    onCheckout?: (url: string, plan: string) => void;
    /** Optional extra CSS class on the container */
    className?: string;
}
/**
 * PricingTable — renders all GitHat tiers with price, features, and upgrade CTA.
 *
 * ```tsx
 * <PricingTable orgId={org.id} currentPlan={billing.plan} />
 * ```
 */
declare function PricingTable({ orgId, currentPlan, onCheckout, className }: PricingTableProps): react_jsx_runtime.JSX.Element;

interface AnalyticsDashboardProps {
    appId: string;
    /** Optional CSS class added to the root element */
    className?: string;
}
declare function AnalyticsDashboard({ appId: id, className }: AnalyticsDashboardProps): react_jsx_runtime.JSX.Element;

interface ObservabilityPanelProps {
    /** Optional CSS class added to the root element */
    className?: string;
}
declare function ObservabilityPanel({ className }: ObservabilityPanelProps): react_jsx_runtime.JSX.Element;

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

export { AnalyticsDashboard, type AnalyticsDashboardProps, type AnalyticsFunnel, type AnalyticsFunnelStep, type AnalyticsOverview, type AnalyticsSeries, type ApiGatewayMetrics, type AppBillingStatus, type AppCheckoutResult, type AppPortalResult, AppleButton, type AppleButtonProps$1 as AppleButtonProps, AppleCallback, type AppleCallbackProps$1 as AppleCallbackProps, type AuditEvent, type AuditEventType, type AuditLogListResult, type AuditLogQueryOptions, type AuthActions, type AuthPayload, type AuthState, type AuthenticatedHandler, type AvailabilityResult, type BatchOperation, type BatchResult, type BillingLimits, type BillingPlan, type BillingPlanStatus, type BillingStatus, type BillingUsage, type CancelResult, type CertValidationRecord, ChangePasswordForm, type CheckoutResult, type ClerkCompatUser, type ConnectLinkResult, ContinueWithGitHat, type ContinueWithGitHatProps, type DataItem, type DeleteResult, type DeployHealth, type Deployment, DeploymentList, type DeploymentListProps, type DeploymentLogsResult, type DeploymentStatus, type DeploymentsListResult, type DkimRecord, type DnsRecord, type DomainAvailability, type DomainCheckResult, type DomainOnboardingRecord, DomainOnboardingWizard, type DomainOnboardingWizardProps, type DomainProvider, type DomainVerificationStatus, type EmailDomainSetupResult, type EmailDomainStatus, type EmailVerificationResult, FacebookButton, type FacebookButtonProps$1 as FacebookButtonProps, FacebookCallback, type FacebookCallbackProps$1 as FacebookCallbackProps, ForgotPasswordForm, type GitHatConfig, type GitHatContextValue, type GitHatOrg, GitHatProvider, type GitHatUser, GitHubButton, GitHubCallback, GoogleButton, type GoogleButtonProps$1 as GoogleButtonProps, GoogleCallback, type GoogleCallbackProps$1 as GoogleCallbackProps, InstagramButton, type InstagramButtonProps$1 as InstagramButtonProps, InstagramCallback, type InstagramCallbackProps$1 as InstagramCallbackProps, type LambdaMetric, type LambdaMetricsResult, type LineItem, type LogLine, type MagicLinkMfaRequired, type MagicLinkRequestResult, MagicLinkVerify, type MagicLinkVerifyProps, type MagicLinkVerifyResult, MfaChallenge, type MfaChallengeProps, type MfaChallengeRequired, type MfaChallengeResult, type MfaEnableResult, MfaManager, MfaSetupForm, type MfaSetupFormProps, type MfaSetupResult, type MfaVerifyOpts, MicrosoftButton, type MicrosoftButtonProps$1 as MicrosoftButtonProps, MicrosoftCallback, type MicrosoftCallbackProps$1 as MicrosoftCallbackProps, type OAuthProvider, ObservabilityPanel, type ObservabilityPanelProps, type OnboardResult, type OrgAnalyticsOverview, type OrgMetadata, OrgSwitcher, PasskeyButton, type PasskeyButtonProps, type PasskeyRecord, type PasskeyRegisterResult, type PasskeySignInResult, type PasswordResetResult, type PerAppDeploy, type PerAppDeploysResult, type PortalResult, PricingTable, type PricingTableProps, ProtectedRoute, type PutResult, type QueryOptions, type QueryResult, type RLSEvaluation, type RLSPolicy, type RLSPredicate, type RealtimeMessage, type RealtimeStatus, type RecentFailure, type RecentFailuresResult, type RedeployResult, type RegisterDomainOptions, type RegisterResult, type RegistrationStatus, ResetPasswordForm, type SendEmailOptions, type SendEmailResult, type ServerSendEmailOptions, type ServerSendEmailResult, type Session, type SessionsListResult, type SetPolicyOptions, SignInButton, SignInForm, type SignInResult, type SignInTokens, SignUpButton, type SignUpData, SignUpForm, type SignUpResult, StorageDropzone, type StorageDropzoneProps, type StorageListOptions, type StorageListResult, type StorageObject, type StorageUploadOptions, type StorageUploadResult, type TestPolicyOptions, TikTokButton, type TikTokButtonProps$1 as TikTokButtonProps, TikTokCallback, type TikTokCallbackProps$1 as TikTokCallbackProps, type TimeSeriesMetric, type TimeSeriesOptions, type TopUser, type TopUsersOptions, type TopUsersResult, UserButton, VerifiedBadge, VerifyEmailStatus, type VerifyOptions, type Webhook, type WebhookCreateResult, type WebhookDeliveriesResult, type WebhookDelivery, type WebhookEventType, type WebhooksListResult, type WithAuthOptions, useAnalytics, useAppBilling, useAuditLog, useAuth, useAuthClerk, useBilling, useClerk, useData, useDeployments, useDomains, useEmail, useEmailDomains, useGitHat, useMagicLink, useMfa, useObservability, useOrgAnalytics, usePasskey, useRLS, useRealtime, useSessions, useSignIn, useSignUp, useStorage, useUser, useWebhooks };
