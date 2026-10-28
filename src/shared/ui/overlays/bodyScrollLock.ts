// Custom dialogs share ownership so closing an outer dialog cannot unlock a
// still-open inner dialog, or leave the page locked after the last one closes.
const owners = new Set<symbol>();
let previousOverflow = "";

export function lockBodyScroll(): () => void {
  const owner = Symbol("dialog-scroll-lock");
  if (owners.size === 0) previousOverflow = document.body.style.overflow;
  owners.add(owner);
  document.body.style.overflow = "hidden";
  return () => {
    if (!owners.delete(owner) || owners.size > 0) return;
    if (document.body.style.overflow === "hidden") document.body.style.overflow = previousOverflow;
  };
}
