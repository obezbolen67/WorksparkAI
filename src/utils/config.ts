// src/utils/config.ts
import { API_BASE_URL } from './api';

export type PublicConfig = {
  googleMapsApiKey?: string;
  stripePublicKey?: string;
  [key: string]: any;
};

let cachedConfig: PublicConfig | null = null;

function readWindowConfig(): PublicConfig | null {
  if (typeof window !== 'undefined' && (window as any).__APP_CONFIG__) {
    return (window as any).__APP_CONFIG__ as PublicConfig;
  }
  return null;
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  if (cachedConfig) return cachedConfig;

  // Prefer a server-provided config endpoint if available
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`, { credentials: 'include' });
    if (res.ok) {
      cachedConfig = await res.json();
      return cachedConfig || {};
    }
  } catch {}

  // Fallback: a static config file served with the app (optional)
  try {
    const res = await fetch(`/app-config.json`, { cache: 'no-store' });
    if (res.ok) {
      cachedConfig = await res.json();
      return cachedConfig || {};
    }
  } catch {}

  // Fallback: a global injected at runtime (optional)
  const winCfg = readWindowConfig();
  if (winCfg) {
    cachedConfig = winCfg;
    return cachedConfig || {};
  }

  return {};
}
