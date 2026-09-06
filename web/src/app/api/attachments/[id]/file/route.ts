import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function apiRoot(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}

/** Same-origin proxy so identity photos load on Railway without CORS or public bucket URLs. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('access_token') ||
    '';
  const upstream = await fetch(`${apiRoot()}/attachments/${encodeURIComponent(id)}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!upstream.ok) {
    const body = await upstream.text();
    return new Response(body || 'โหลดรูปไม่สำเร็จ', {
      status: upstream.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type':
        upstream.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
