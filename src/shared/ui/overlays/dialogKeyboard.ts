/** ProseMirror otherwise consumes Escape even when it has no popup to close.
 * Returning true from handleDOMEvents skips that handler without preventing
 * the enclosing dialog from handling Escape. Enter remains editor-owned.
 */
export function delegateEditorEscape(element: HTMLElement, event: KeyboardEvent): boolean {
  return event.key === "Escape" && !event.isComposing && !event.defaultPrevented
    && Boolean(element.closest('[role="dialog"], [role="alertdialog"]'));
}
