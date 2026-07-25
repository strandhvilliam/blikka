/**
 * Shared environment gate for the three Sentry inits (client, server, edge).
 *
 * Only production traffic should reach Sentry — local dev and preview deploys would otherwise
 * burn quota on errors nobody triages. Every `process.env.X` below is spelled out literally so
 * Next.js can inline it into the client bundle.
 */

/**
 * `VERCEL_ENV` is server-only; `NEXT_PUBLIC_VERCEL_ENV` is its client-visible twin (requires
 * "Automatically expose System Environment Variables" on the Vercel project). Undefined off-Vercel.
 */
const deploymentEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV

/** Production means a production build that is not a preview/branch deploy. */
export const isProductionEnvironment =
  process.env.NODE_ENV === 'production' && (!deploymentEnv || deploymentEnv === 'production')

/** Tag events with where they came from, so anything that does slip through is filterable. */
export const sentryEnvironment =
  deploymentEnv || (process.env.NODE_ENV === 'production' ? 'production' : 'development')
