export async function backend(action: string, body?: unknown, id?: string) {
  const url = `/api/netone?action=${encodeURIComponent(action)}${id ? `&id=${encodeURIComponent(id)}` : ''}`;
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const fallback = response.ok
    ? 'The server returned an invalid response. Please try again.'
    : `The server request failed (HTTP ${response.status}). Please try again.`;
  let data;
  try { data = JSON.parse(await response.text()); }
  catch { throw new Error(fallback); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(fallback);
  if (!response.ok) throw new Error(typeof data.error === 'string' && data.error ? data.error : fallback);
  return data;
}
