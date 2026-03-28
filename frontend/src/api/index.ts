import axios from "axios";
import {
  Booking,
  CreateBookingPayload,
  CreateResourcePayload,
  RemovalRequest,
  Resource,
  Stats,
  WhitelistEntry,
} from "../types";

function resolveApiBaseUrl() {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[API] REACT_APP_API_URL is not set in production! API calls will fail. " +
        "Set this environment variable to the backend URL (e.g. https://your-api.onrender.com).",
    );
    return "";
  }
  return "http://localhost:4000";
}

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 responses (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
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

/** Returns the URL for a booking's QR code image */
export function getBookingQrUrl(
  id: string,
  format: "png" | "svg" = "svg",
): string {
  return `${API_BASE_URL}/api/bookings/${id}/qr?format=${format}`;
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
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ user: AuthUser; token: string }> {
  const res = await api.post<{
    success: boolean;
    data: { user: AuthUser; token: string };
  }>("/api/auth/login", { email, password });
  return res.data.data;
}

export async function signupWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<{ user: AuthUser; token: string }> {
  const res = await api.post<{
    success: boolean;
    data: { user: AuthUser; token: string };
  }>("/api/auth/signup", { email, password, name });
  return res.data.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/api/auth/forgot-password", { email });
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

export async function voteAdminRemoval(
  email: string,
): Promise<{
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

export function getGoogleLoginUrl(): string {
  return `${API_BASE_URL}/api/auth/google`;
}

export default api;
