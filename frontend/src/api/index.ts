import axios from 'axios';
import { Booking, CreateBookingPayload, CreateResourcePayload, Resource, Stats, WhitelistEntry } from '../types';

function resolveApiBaseUrl() {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  // For split deployment (Vercel frontend + external API), this must be set in production.
  if (process.env.NODE_ENV === 'production') return 'http://localhost:4000';
  return 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Resources ─────────────────────────────────────────────────────────────────

export async function fetchResources(schoolId?: string): Promise<Resource[]> {
  const res = await api.get<{ success: boolean; data: Resource[] }>('/api/resources', {
    params: schoolId ? { schoolId } : undefined,
  });
  return res.data.data;
}

export async function fetchResource(id: string): Promise<Resource> {
  const res = await api.get<{ success: boolean; data: Resource }>(`/api/resources/${id}`);
  return res.data.data;
}

export async function createResource(payload: CreateResourcePayload): Promise<Resource> {
  const res = await api.post<{ success: boolean; data: Resource }>('/api/resources', payload);
  return res.data.data;
}

export async function updateResource(id: string, payload: Partial<CreateResourcePayload>): Promise<Resource> {
  const res = await api.put<{ success: boolean; data: Resource }>(`/api/resources/${id}`, payload);
  return res.data.data;
}

export async function deleteResource(id: string): Promise<void> {
  await api.delete(`/api/resources/${id}`);
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function fetchBookings(params?: { resourceId?: string; status?: string; search?: string; schoolId?: string }): Promise<Booking[]> {
  const res = await api.get<{ success: boolean; data: Booking[] }>('/api/bookings', { params });
  return res.data.data;
}

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  const res = await api.post<{ success: boolean; data: Booking }>('/api/bookings', payload);
  return res.data.data;
}

export async function returnBooking(id: string): Promise<Booking> {
  const res = await api.patch<{ success: boolean; data: Booking }>(`/api/bookings/${id}/return`);
  return res.data.data;
}

export async function cancelBooking(id: string): Promise<Booking> {
  const res = await api.patch<{ success: boolean; data: Booking }>(`/api/bookings/${id}/cancel`);
  return res.data.data;
}

/** Returns the URL for a booking's QR code image */
export function getBookingQrUrl(id: string, format: 'png' | 'svg' = 'svg'): string {
  return `${API_BASE_URL}/api/bookings/${id}/qr?format=${format}`;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchStats(schoolId?: string): Promise<Stats> {
  const res = await api.get<{ success: boolean; data: Stats }>('/api/stats', {
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
  const res = await api.get<{ success: boolean; data: School[] }>('/api/schools');
  return res.data.data;
}

export async function createSchool(payload: { name: string; campus?: string }): Promise<School> {
  const res = await api.post<{ success: boolean; data: School }>('/api/schools', payload);
  return res.data.data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  schoolId: string;
}

export async function loginWithEmail(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const res = await api.post<{ success: boolean; data: { user: AuthUser; token: string } }>('/api/auth/login', { email, password });
  return res.data.data;
}

export async function signupWithEmail(email: string, password: string, name?: string): Promise<{ user: AuthUser; token: string }> {
  const res = await api.post<{ success: boolean; data: { user: AuthUser; token: string } }>('/api/auth/signup', { email, password, name });
  return res.data.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/api/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/api/auth/reset-password', { token, newPassword });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await api.get<{ success: boolean; data: AuthUser }>('/api/auth/me');
  return res.data.data;
}

export async function fetchWhitelist(): Promise<WhitelistEntry[]> {
  const res = await api.get<{ success: boolean; data: WhitelistEntry[] }>('/api/auth/whitelist');
  return res.data.data;
}

export async function addWhitelistEmail(email: string): Promise<WhitelistEntry> {
  const res = await api.post<{ success: boolean; data: WhitelistEntry }>('/api/auth/whitelist', { email });
  return res.data.data;
}

export async function removeWhitelistEmail(email: string): Promise<void> {
  await api.delete('/api/auth/whitelist', { data: { email } });
}

export function getGoogleLoginUrl(): string {
  return `${API_BASE_URL}/api/auth/google`;
}

export default api;
