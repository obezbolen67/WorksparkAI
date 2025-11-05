// src/utils/config.ts
// All public config is now provided via Vite environment variables at build time
// No runtime config fetching needed - more secure and faster

export type PublicConfig = {
  googleMapsApiKey?: string;
  stripePublicKey?: string;
  [key: string]: any;
};

export async function fetchPublicConfig(): Promise<PublicConfig> {
  // Return config from Vite environment variables (baked in at build time)
  return {
    googleMapsApiKey: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
    stripePublicKey: (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || '',
  };
}
