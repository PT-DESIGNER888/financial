/** ต่อลิงก์ชั่วคราวจากคำตอบของ Supabase Storage ให้เป็น URL เต็ม */
export function resolveSignedUrl(supabaseRoot: string, signed: string): string {
  const root = supabaseRoot.replace(/\/$/, '');
  if (/^https?:\/\//i.test(signed)) return signed;
  if (signed.startsWith('/storage/v1/')) return `${root}${signed}`;
  if (signed.startsWith('storage/v1/')) return `${root}/${signed}`;
  const path = signed.startsWith('/') ? signed : `/${signed}`;
  return `${root}/storage/v1${path}`;
}
