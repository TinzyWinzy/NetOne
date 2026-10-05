export async function backend(action: string, body?: unknown, id?: string) {
  const url = `/api/netone?action=${encodeURIComponent(action)}${id ? `&id=${encodeURIComponent(id)}` : ''}`;
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Backend request failed.');
  return data;
}
