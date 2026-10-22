/** Public viewing stays available after expiry; studio/editor routes are excluded. */
export function isPublicVideoLocation(): boolean {
  return /^\/landing(?:\/videos(?:\/[^/]+)?)?\/?$/.test(window.location.pathname);
}
