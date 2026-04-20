/**
 * Demo-mode labels for connector cards. In demo all connectors flip via
 * local setState — neither the real OAuth popup nor the Phase 2 password-
 * gated mock can complete on a Vercel project that has no GOOGLE_* /
 * MEMORY_PASSWORD / SUPABASE_* env vars. Swapping the labels tells visitors
 * that the state they're seeing isn't a real integration.
 */

/** Bilingual label shown in place of "Connect" on every connector in demo. */
export const DEMO_CONNECT_LABEL = 'Try with demo data / 使用 Demo 数据';

/** Replacement for the "Connected" pill so HRs can tell the demo state
 *  apart from a real OAuth connection. */
export const DEMO_CONNECTED_LABEL = 'Connected (Demo)';
