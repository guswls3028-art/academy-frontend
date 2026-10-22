/** Shared by auth redirects and chunk recovery; keep this module dependency-free. */
export let isSessionEnding = false;

export function markSessionEnding() {
  isSessionEnding = true;
}

export function resetSessionEnding() {
  isSessionEnding = false;
}
