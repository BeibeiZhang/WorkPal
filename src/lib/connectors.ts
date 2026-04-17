/** One row from `GET /api/connectors`. Tokens never leave the server, so the
 *  client only sees the status + metadata. */
export interface ConnectorStatus {
  id: string;
  status: 'connected' | 'disconnected';
  connectedAt: string | null;
  metadata: Record<string, unknown>;
}

export class ConnectorAuthError extends Error {
  constructor(msg = 'Invalid password') {
    super(msg);
    this.name = 'ConnectorAuthError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new ConnectorAuthError();
  if (!res.ok) {
    let detail = `Connector API ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

/** Public GET — no auth. */
export async function fetchConnectors(): Promise<ConnectorStatus[]> {
  const res = await fetch('/api/connectors');
  const data = await handleResponse<{ connectors: ConnectorStatus[] }>(res);
  return data.connectors;
}

/** Mock-connect a non-OAuth connector (anything other than gmail / google-cal).
 *  Rejects with ConnectorAuthError when the password is wrong. */
export async function connectMock(id: string, password: string): Promise<ConnectorStatus> {
  const res = await fetch(`/api/connectors/${encodeURIComponent(id)}/connect`, {
    method: 'POST',
    headers: { 'x-memory-password': password },
  });
  const data = await handleResponse<{ connector: ConnectorStatus }>(res);
  return data.connector;
}

export async function disconnect(id: string, password: string): Promise<ConnectorStatus> {
  const res = await fetch(`/api/connectors/${encodeURIComponent(id)}/disconnect`, {
    method: 'POST',
    headers: { 'x-memory-password': password },
  });
  const data = await handleResponse<{ connector: ConnectorStatus }>(res);
  return data.connector;
}

/** URL for the Google OAuth start — opened in a popup window. */
export function googleAuthStartUrl(connector: 'gmail' | 'google-cal'): string {
  return `/api/auth/google/start?connector=${encodeURIComponent(connector)}`;
}
