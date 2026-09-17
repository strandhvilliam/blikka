/** Temporary deployment profile. AWS remains the default. */
export function isVercelByCamera() {
  return process.env.DEPLOYMENT_PROFILE === 'vercel-by-camera'
}
