import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  Booking,
  CreateBookingPayload,
  CreateResourcePayload,
  RemovalRequest,
  PromotionRequest,
  ResourceHistoryEntry,
  Resource,
  Stats,
  WhitelistEntry,
} from "../types";

function resolveApiBaseUrl() {
  if (process.env.REACT_APP_API_URL)
    return process.env.REACT_APP_API_URL.trim();
  if (process.env.NODE_ENV === "production") {
    // Fallback: if the frontend is served from the same origin as the API
    // (e.g. via a reverse proxy or custom domain), use the current origin.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    console.warn(
      "[API] REACT_APP_API_URL is not set! " +
        "Falling back to " +
        (origin || "empty string") +
        ". " +
        "Set REACT_APP_API_URL to the backend URL (e.g. https://your-api.onrender.com) for production.",
    );
    return origin;
  }
  return "http://localhost:4000";
}

export const API_BASE_URL = resolveApiBaseUrl();

// ── Backup API failover ───────────────────────────────────────────────────────
// REACT_APP_API_FALLBACK_URL points at a second copy of the backend that shares
// the primary's DATABASE_URL and JWT_SECRET, so either host can serve any
// request and a token issued by one is accepted by the other. When the primary
// (Render free tier) is asleep, blocked at its edge, or down, requests that are
// safe to repeat are retried on the backup, and the app keeps using the backup
// for a while. Leave the variable unset to disable failover entirely.
const FALLBACK_API_URL =
  process.env.REACT_APP_API_FALLBACK_URL?.trim() || null;
const FAILOVER_STORAGE_KEY = "api_failover_until";
const FAILOVER_DURATION_MS = 10 * 60 * 1000;
// Render's free tier takes 20–60 s to wake up; teachers should not wait on it.
const PRIMARY_TIMEOUT_MS = 12_000;
const READ_METHODS = new Set(["get", "head", "options"]);
// Writes that are harmless to send twice: logging in again just issues a new
// token, and a fresh passkey challenge simply replaces the unused one. The
// login page requests passkey options on load, so it must fail over too.
const REPLAYABLE_WRITE_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/passkeys/login/options",
]);

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _failedOver?: boolean;
  }
}

function readStoredFailover(): number {
  try {
    return Number(localStorage.getItem(FAILOVER_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

let failoverUntil = readStoredFailover();

// Reloading or leaving the page aborts in-flight requests. That says nothing
// about the primary's health, so it must not flip the app onto the backup.
let leavingPage = false;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    leavingPage = true;
  });
}

function failoverActive(): boolean {
  return !!FALLBACK_API_URL && failoverUntil > Date.now();
}

function setFailover(active: boolean) {
  failoverUntil = active ? Date.now() + FAILOVER_DURATION_MS : 0;
  try {
    if (active) {
      localStorage.setItem(FAILOVER_STORAGE_KEY, String(failoverUntil));
    } else {
      localStorage.removeItem(FAILOVER_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable: failover still works for this page load.
  }
}

function isReplayable(config: InternalAxiosRequestConfig): boolean {
  const method = (config.method || "get").toLowerCase();
  return (
    READ_METHODS.has(method) ||
    (method === "post" && REPLAYABLE_WRITE_PATHS.has(config.url || ""))
  );
}

function shouldSwitchHost(error: AxiosError): boolean {
  const config = error.config;
  if (!FALLBACK_API_URL || !config || config._failedOver || leavingPage) {
    return false;
  }
  const status = error.response?.status;
  // A status we can read came from the backend itself (it sets CORS headers).
  // Its own 429s are login rate limits and must not be dodged by switching hosts.
  if (status !== undefined) {
    return [502, 503, 504].includes(status) && isReplayable(config);
  }
  // No readable response: network failure, timeout, or an edge error page
  // without CORS headers, which is how Render's own 429/503 responses look
  // to the browser.
  return true;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Pick the host, then attach the JWT token from localStorage if available
api.interceptors.request.use((config) => {
  if (FALLBACK_API_URL) {
    const useFallback = failoverActive();
    config.baseURL = useFallback ? FALLBACK_API_URL : API_BASE_URL;
    if (
      !useFallback &&
      !config._failedOver &&
      !config.timeout &&
      isReplayable(config)
    ) {
      config.timeout = PRIMARY_TIMEOUT_MS;
    }
  }
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const config = error.config;
    if (config && shouldSwitchHost(error)) {
      // Primary failed → use the backup for a while; backup failed → back to primary.
      setFailover(config.baseURL !== FALLBACK_API_URL);
      if (isReplayable(config)) {
        config._failedOver = true;
        config.timeout = 0;
        return api.request(config);
      }
      // A write whose fate is unknown is not repeated automatically; the
      // user's next attempt goes to the other host.
    }
    // Auto-logout on 401 responses (expired/invalid token)
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }
    return Promise.reject(error);
  },
);

// ── Resources ─────────────────────────────────────────────────────────────────

export async function fetchResources(schoolId?: string): Promise<Resource[]> {
  const res = await api.get<{ success: boolean; data: Resource[] }>(
    "/api/resources",
    {
      params: schoolId ? { schoolId } : undefined,
    },
  );
  return res.data.data;
}

export async function fetchResource(id: string): Promise<Resource> {
  const res = await api.get<{ success: boolean; data: Resource }>(
    `/api/resources/${id}`,
  );
  return res.data.data;
}

export async function fetchResourceHistory(
  resourceId: string,
): Promise<ResourceHistoryEntry[]> {
  const res = await api.get<{ success: boolean; data: ResourceHistoryEntry[] }>(
    `/api/resources/${resourceId}/history`,
  );
  return res.data.data;
}

export async function createResource(
  payload: CreateResourcePayload,
): Promise<Resource> {
  const res = await api.post<{ success: boolean; data: Resource }>(
    "/api/resources",
    payload,
  );
  return res.data.data;
}

export async function updateResource(
  id: string,
  payload: Partial<CreateResourcePayload>,
): Promise<Resource> {
  const res = await api.put<{ success: boolean; data: Resource }>(
    `/api/resources/${id}`,
    payload,
  );
  return res.data.data;
}

export async function deleteResource(id: string): Promise<void> {
  await api.delete(`/api/resources/${id}`);
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function fetchBookings(params?: {
  resourceId?: string;
  status?: string;
  search?: string;
  schoolId?: string;
}): Promise<Booking[]> {
  const res = await api.get<{ success: boolean; data: Booking[] }>(
    "/api/bookings",
    { params },
  );
  return res.data.data;
}

export async function createBooking(
  payload: CreateBookingPayload,
): Promise<Booking> {
  const res = await api.post<{ success: boolean; data: Booking }>(
    "/api/bookings",
    payload,
  );
  return res.data.data;
}

export async function returnBooking(id: string): Promise<Booking> {
  const res = await api.patch<{ success: boolean; data: Booking }>(
    `/api/bookings/${id}/return`,
  );
  return res.data.data;
}

export async function cancelBooking(id: string): Promise<Booking> {
  const res = await api.patch<{ success: boolean; data: Booking }>(
    `/api/bookings/${id}/cancel`,
  );
  return res.data.data;
}

/** Return all active bookings for a resource (authenticated via JWT) */
export async function returnAllForResource(
  resourceId: string,
): Promise<{ returned: number; bookings: Booking[] }> {
  const res = await api.post<{
    success: boolean;
    message: string;
    data: { returned: number; bookings: Booking[] };
  }>(`/api/resources/${resourceId}/return-all`);
  return res.data.data;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchStats(schoolId?: string): Promise<Stats> {
  const res = await api.get<{ success: boolean; data: Stats }>("/api/stats", {
    params: schoolId ? { schoolId } : undefined,
  });
  return res.data.data;
}

// ── Schools ───────────────────────────────────────────────────────────────────

export interface School {
  id: string;
  name: string;
  campus: string;
}

export async function fetchSchools(): Promise<School[]> {
  const res = await api.get<{ success: boolean; data: School[] }>(
    "/api/schools",
  );
  return res.data.data;
}

export async function createSchool(payload: {
  name: string;
  campus?: string;
}): Promise<School> {
  const res = await api.post<{ success: boolean; data: School }>(
    "/api/schools",
    payload,
  );
  return res.data.data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  schoolId: string;
  needsSecuritySetup?: boolean;
}

export async function loginWithEmail(
  email: string,
  password: string,
  rememberMe?: boolean,
): Promise<{ user: AuthUser; token: string }> {
  const res = await api.post<{
    success: boolean;
    data: { user: AuthUser; token: string };
  }>("/api/auth/login", { email, password, rememberMe });
  return res.data.data;
}

export async function signupWithEmail(
  email: string,
  password: string,
  name?: string,
  securityAnswers?: { food: string; book: string; color: string },
  rememberMe?: boolean,
): Promise<{ user: AuthUser; token: string }> {
  const res = await api.post<{
    success: boolean;
    data: { user: AuthUser; token: string };
  }>("/api/auth/signup", {
    email,
    password,
    name,
    securityAnswers,
    rememberMe,
  });
  return res.data.data;
}

/**
 * Verify security answers and get a password-reset token.
 * Returns the reset token directly (no email sent).
 */
export async function verifySecurityAnswers(
  email: string,
  food: string,
  book: string,
  color: string,
): Promise<{ token: string }> {
  const res = await api.post<{
    success: boolean;
    data: { token: string };
  }>("/api/auth/forgot-password", { email, food, book, color });
  return res.data.data;
}

/** Set security question answers for an existing account (requires auth). */
export async function setupSecurityQuestions(
  food: string,
  book: string,
  color: string,
): Promise<void> {
  await api.post("/api/auth/setup-security-questions", { food, book, color });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post("/api/auth/reset-password", { token, newPassword });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await api.get<{ success: boolean; data: AuthUser }>(
    "/api/auth/me",
  );
  return res.data.data;
}

export async function fetchWhitelist(): Promise<WhitelistEntry[]> {
  const res = await api.get<{ success: boolean; data: WhitelistEntry[] }>(
    "/api/auth/whitelist",
  );
  return res.data.data;
}

export async function fetchWhitelistRemovalRequests(): Promise<
  RemovalRequest[]
> {
  const res = await api.get<{ success: boolean; data: RemovalRequest[] }>(
    "/api/auth/whitelist/removals",
  );
  return res.data.data;
}

export async function addWhitelistEmail(
  email: string,
): Promise<WhitelistEntry> {
  const res = await api.post<{ success: boolean; data: WhitelistEntry }>(
    "/api/auth/whitelist",
    { email },
  );
  return res.data.data;
}

export async function removeWhitelistEmail(email: string): Promise<void> {
  await api.delete("/api/auth/whitelist", { data: { email } });
}

export async function requestAdminRemoval(
  email: string,
): Promise<RemovalRequest> {
  const res = await api.post<{ success: boolean; data: RemovalRequest }>(
    "/api/auth/whitelist/removals",
    { email },
  );
  return res.data.data;
}

export async function voteAdminRemoval(email: string): Promise<{
  status: "pending" | "removed";
  votes?: number;
  required?: number;
  email: string;
}> {
  const res = await api.post<{
    success: boolean;
    data: {
      status: "pending" | "removed";
      votes?: number;
      required?: number;
      email: string;
    };
  }>(`/api/auth/whitelist/removals/${encodeURIComponent(email)}/vote`);
  return res.data.data;
}

export async function fetchAdminPromotionRequests(): Promise<
  PromotionRequest[]
> {
  const res = await api.get<{ success: boolean; data: PromotionRequest[] }>(
    "/api/auth/whitelist/promotions",
  );
  return res.data.data;
}

export async function requestAdminPromotion(
  email: string,
): Promise<PromotionRequest | { status: "promoted"; email: string }> {
  const res = await api.post<{
    success: boolean;
    data: PromotionRequest | { status: "promoted"; email: string };
  }>("/api/auth/whitelist/promotions", { email });
  return res.data.data;
}

export async function voteAdminPromotion(email: string): Promise<{
  status: "pending" | "promoted";
  votes?: number;
  required?: number;
  email: string;
}> {
  const res = await api.post<{
    success: boolean;
    data: {
      status: "pending" | "promoted";
      votes?: number;
      required?: number;
      email: string;
    };
  }>(`/api/auth/whitelist/promotions/${encodeURIComponent(email)}/vote`);
  return res.data.data;
}

export async function cancelAdminPromotion(email: string): Promise<void> {
  await api.delete(
    `/api/auth/whitelist/promotions/${encodeURIComponent(email)}`,
  );
}

// ── Passkeys (WebAuthn) ───────────────────────────────────────────────────────

export interface PasskeySummary {
  credentialId: string;
  deviceLabel: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

/** Step 1 of adding a passkey. Requires an authenticated session. */
export async function fetchPasskeyRegistrationOptions(): Promise<{
  options: any;
  challengeId: string;
}> {
  const res = await api.post<{
    success: boolean;
    data: { options: any; challengeId: string };
  }>("/api/auth/passkeys/register/options");
  return res.data.data;
}

/** Step 2 of adding a passkey. */
export async function verifyPasskeyRegistration(
  response: any,
  challengeId: string,
): Promise<void> {
  await api.post("/api/auth/passkeys/register/verify", {
    response,
    challengeId,
  });
}

/**
 * Step 1 of signing in with a passkey. Omit the email to let the browser
 * offer whichever passkeys it already holds for this site (the one-tap flow).
 */
export async function fetchPasskeyLoginOptions(email?: string): Promise<{
  options: any;
  challengeId: string;
}> {
  const res = await api.post<{
    success: boolean;
    data: { options: any; challengeId: string };
  }>("/api/auth/passkeys/login/options", email ? { email } : {});
  return res.data.data;
}

/** Step 2 of signing in with a passkey. */
export async function verifyPasskeyLogin(
  response: any,
  challengeId: string,
  rememberMe?: boolean,
): Promise<{ user: AuthUser; token: string }> {
  const res = await api.post<{
    success: boolean;
    data: { user: AuthUser; token: string };
  }>("/api/auth/passkeys/login/verify", {
    response,
    challengeId,
    rememberMe,
  });
  return res.data.data;
}

export async function fetchPasskeys(): Promise<PasskeySummary[]> {
  const res = await api.get<{ success: boolean; data: PasskeySummary[] }>(
    "/api/auth/passkeys",
  );
  return res.data.data;
}

export async function deletePasskey(credentialId: string): Promise<void> {
  await api.delete(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`);
}

/** Public: apply to be added to the whitelist (no auth required). */
export async function applyForWhitelist(
  email: string,
  message?: string,
): Promise<void> {
  await api.post("/api/auth/whitelist/apply", { email, message });
}

// ── Admin User Management ─────────────────────────────────────────────────────

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  school_id?: string;
  has_security_questions?: boolean | number;
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const res = await api.get<{ success: boolean; data: ManagedUser[] }>(
    "/api/auth/users",
  );
  return res.data.data;
}

export async function adminCreateUser(payload: {
  email: string;
  password: string;
  name?: string;
  role?: "staff" | "admin";
}): Promise<ManagedUser> {
  const res = await api.post<{ success: boolean; data: ManagedUser }>(
    "/api/auth/users",
    payload,
  );
  return res.data.data;
}

export async function adminSetPassword(
  email: string,
  newPassword: string,
): Promise<void> {
  await api.patch(`/api/auth/users/${encodeURIComponent(email)}/password`, {
    newPassword,
  });
}

export async function adminDeleteUser(email: string): Promise<void> {
  await api.delete(`/api/auth/users/${encodeURIComponent(email)}`);
}

export default api;
