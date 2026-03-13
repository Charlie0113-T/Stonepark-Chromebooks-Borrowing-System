import axios from 'axios';
import { Booking, CreateBookingPayload, Resource, Stats } from '../types';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
});

// ── Resources ─────────────────────────────────────────────────────────────────

export async function fetchResources(): Promise<Resource[]> {
  const res = await api.get<{ success: boolean; data: Resource[] }>('/api/resources');
  return res.data.data;
}

export async function fetchResource(id: string): Promise<Resource> {
  const res = await api.get<{ success: boolean; data: Resource }>(`/api/resources/${id}`);
  return res.data.data;
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function fetchBookings(params?: { resourceId?: string; status?: string }): Promise<Booking[]> {
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

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchStats(): Promise<Stats> {
  const res = await api.get<{ success: boolean; data: Stats }>('/api/stats');
  return res.data.data;
}

export default api;
