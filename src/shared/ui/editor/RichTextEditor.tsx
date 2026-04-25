/**
 * PATH: src/shared/ui/editor/RichTextEditor.tsx
 * Lazy wrapper around the TipTap-based editor implementation.
 * Keeps the heavy @tiptap chunk out of the initial bundle — it only loads
 * when an editor is actually rendered.
 */
import { lazy, Suspense, type ComponentProps } from "react";
import type RichTextEditorImpl from "./RichTextEditor.impl";

export type { RichTextEditorProps } from "./RichTextEditor.impl";

const RichTextEditorLazy = lazy(() => import("./RichTextEditor.impl"));

type Props = ComponentProps<typeof RichTextEditorImpl>;

export default function RichTextEditor(props: Props) {
  const fallbackHeight = props.minHeight ?? 200;
  return (
    <Suspense
      fallback={
        <div
          className="rich-editor"
          style={{ minHeight: fallbackHeight }}
          aria-busy="true"
        />
      }
    >
      <RichTextEditorLazy {...props} />
    </Suspense>
  );
}
