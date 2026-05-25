export const PUBLIC_RICH_CONTENT_CLASS = "public-rich-content";
export const PUBLIC_RICH_CONTENT_PRESERVE_LINES_CLASS = "public-rich-content--preserve-lines";

export default function PublicRichContentStyle() {
  return (
    <style>{`
      .${PUBLIC_RICH_CONTENT_CLASS} {
        white-space: normal;
      }
      .${PUBLIC_RICH_CONTENT_CLASS}.${PUBLIC_RICH_CONTENT_PRESERVE_LINES_CLASS} {
        white-space: pre-wrap;
      }
      .${PUBLIC_RICH_CONTENT_CLASS}.${PUBLIC_RICH_CONTENT_PRESERVE_LINES_CLASS} > * {
        white-space: normal;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} > :first-child {
        margin-top: 0;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} > :last-child {
        margin-bottom: 0;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} p {
        margin: 0.72em 0;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} h1,
      .${PUBLIC_RICH_CONTENT_CLASS} h2,
      .${PUBLIC_RICH_CONTENT_CLASS} h3,
      .${PUBLIC_RICH_CONTENT_CLASS} h4 {
        margin: 1.25em 0 0.5em;
        color: inherit;
        font-weight: 800;
        line-height: 1.32;
        letter-spacing: 0;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} h1 { font-size: 1.5em; }
      .${PUBLIC_RICH_CONTENT_CLASS} h2 { font-size: 1.28em; }
      .${PUBLIC_RICH_CONTENT_CLASS} h3 { font-size: 1.12em; }
      .${PUBLIC_RICH_CONTENT_CLASS} ul,
      .${PUBLIC_RICH_CONTENT_CLASS} ol {
        margin: 0.78em 0;
        padding-left: 1.35em;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} li + li {
        margin-top: 0.34em;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} a {
        color: #D4A04C;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} blockquote {
        margin: 1em 0;
        padding: 0.9em 1em;
        border-left: 3px solid #D4A04C;
        border-radius: 10px;
        background: rgba(212, 160, 76, 0.10);
        color: inherit;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 1em 0;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.24);
      }
      .${PUBLIC_RICH_CONTENT_CLASS} table {
        width: 100%;
        margin: 1em 0;
        border-collapse: collapse;
        overflow: hidden;
        border-radius: 10px;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} th,
      .${PUBLIC_RICH_CONTENT_CLASS} td {
        padding: 0.68em 0.78em;
        border: 1px solid rgba(148, 163, 184, 0.28);
        text-align: left;
        vertical-align: top;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} th {
        background: rgba(148, 163, 184, 0.12);
        font-weight: 800;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} code {
        padding: 0.15em 0.35em;
        border-radius: 6px;
        background: rgba(148, 163, 184, 0.14);
        font-size: 0.92em;
      }
      .${PUBLIC_RICH_CONTENT_CLASS} pre {
        overflow-x: auto;
        margin: 1em 0;
        padding: 1em;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.30);
      }
    `}</style>
  );
}
