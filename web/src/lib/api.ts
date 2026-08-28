'use client';

import { useAuthStore } from './auth-store';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function refreshTokens(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;
  let res: Response;
  try {
    res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return false;
  }
  if (!res.ok) {
    clear();
    return false;
  }
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

function networkError(err: unknown): never {
  throw new ApiError(
    0,
    err instanceof TypeError
      ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจว่า API รันอยู่ที่พอร์ต 3001'
      : err instanceof Error
        ? err.message
        : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
  );
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    networkError(err);
  }

  if (res.status === 401 && retry && (await refreshTokens())) {
    return api<T>(path, options, false);
  }
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError(401, 'กรุณาเข้าสู่ระบบใหม่');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `เกิดข้อผิดพลาด (${res.status})`);
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** อัปโหลดไฟล์ (multipart) แนบ token — ไม่ตั้ง Content-Type เอง ให้ browser ใส่ boundary */
export async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  } catch (err) {
    networkError(err);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `อัปโหลดไม่สำเร็จ (${res.status})`);
    throw new ApiError(res.status, msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** ดาวน์โหลดไฟล์จาก API (แนบ token) เช่น XLSX/CSV export */
export async function downloadFile(path: string, filename: string) {
  const { accessToken } = useAuthStore.getState();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
  } catch (err) {
    networkError(err);
  }
  if (!res.ok) throw new ApiError(res.status, 'ดาวน์โหลดไม่สำเร็จ');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
