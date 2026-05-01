import { fetchAgent } from './agent';

export interface VersionRowData {
  id: string;
  label: string;
  current: string;
  latest: string | null;
  status: 'up-to-date' | 'update-available' | 'unknown';
  error?: string;
}

export interface VersionInfoResponse {
  rows: VersionRowData[];
  checkedAt: string;
}

export async function fetchVersionInfo(): Promise<VersionInfoResponse> {
  const res = await fetchAgent('/api/version-info');
  if (!res.ok) throw new Error(`Version info fetch failed: ${res.status}`);
  return res.json();
}
