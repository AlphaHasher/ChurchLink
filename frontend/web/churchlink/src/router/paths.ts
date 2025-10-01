export const LOGIN_PATH = "/auth/login";

export function buildLoginPath(redirectTo?: string): string {
  if (!redirectTo) return LOGIN_PATH;
  const url = new URL(LOGIN_PATH, window.location.origin);
  url.searchParams.set("redirectTo", redirectTo);
  // Return pathname with query to avoid including origin
  return url.pathname + url.search;
}
