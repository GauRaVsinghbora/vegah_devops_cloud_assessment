export type User = { id: string; email: string };
export type AuthResult = { user: User; token: string };
export type ShortUrl = {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  status: 'ACTIVE' | 'DISABLED';
  clicks: number;
  createdAt: string;
};
export type Breakdown = { _id: string | null; count: number };
export type ClickDay = { _id: string; clicks: number };
export type Analytics = {
  totalUrls: number;
  activeUrls: number;
  totalClicks: number;
  topUrls: { shortCode: string; originalUrl?: string; clicks: number }[];
  clicksOverTime: ClickDay[];
  browsers: Breakdown[];
  devices: Breakdown[];
  referrers: Breakdown[];
  recentActivity: { short_code: string; browser: string; device_type: string; referrer: string | null; clicked_at: string }[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? `Request failed (${response.status})`);
  }
  return response.json();
}

export const api = {
  auth: (mode: 'login' | 'register', email: string, password: string) =>
    request<AuthResult>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email, password }) }),
  urls: (token: string, search = '') =>
    request<ShortUrl[]>(`/urls${search ? `?search=${encodeURIComponent(search)}` : ''}`, {}, token),
  createUrl: (token: string, originalUrl: string, customCode?: string) =>
    request<ShortUrl>('/urls', { method: 'POST', body: JSON.stringify({ originalUrl, customCode: customCode || undefined }) }, token),
  setStatus: (token: string, id: string, status: 'ACTIVE' | 'DISABLED') =>
    request<ShortUrl>(`/urls/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  deleteUrl: (token: string, id: string) =>
    request<{ deleted: boolean }>(`/urls/${id}`, { method: 'DELETE' }, token),
  analytics: (token: string) => request<Analytics>('/analytics', {}, token),
  urlAnalytics: (token: string, id: string) => request<Record<string, unknown>>(`/analytics/${id}`, {}, token),
};
