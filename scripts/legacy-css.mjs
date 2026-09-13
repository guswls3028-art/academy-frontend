import postcss from "postcss";
import postcssPresetEnv from "postcss-preset-env";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// PostCSS's comma splitter understands nested functions (unlike a comma regex).
function replaceFunction(value, name, replacement) {
  let start = value.indexOf(`${name}(`);
  while (start !== -1) {
    let depth = 1;
    let end = start + name.length + 1;
    for (; end < value.length && depth; end += 1) {
      if (value[end] === "(") depth += 1;
      else if (value[end] === ")") depth -= 1;
    }
    if (depth) break;
    const args = postcss.list.comma(value.slice(start + name.length + 1, end - 1));
    value = value.slice(0, start) + replacement(args) + value.slice(end);
    start = value.indexOf(`${name}(`, start);
  }
  return value;
}

function dominantColor(args) {
  const colors = args.slice(1).map((argument) => {
    const percentage = argument.match(/\s+([\d.]+)%\s*$/);
    return {
      value: percentage ? argument.slice(0, percentage.index) : argument,
      percentage: percentage ? Number(percentage[1]) : null,
    };
  });
  if (colors.length !== 2) return colors[0]?.value || "transparent";
  const first = colors[0].percentage ?? (100 - (colors[1].percentage ?? 50));
  const second = colors[1].percentage ?? (100 - first);
  // Keep the runtime tenant/theme variable. Freezing custom properties at build
  // time would accidentally use another tenant's palette or the dark theme.
  return first >= second ? colors[0].value : colors[1].value;
}

function legacyValues() {
  return {
    postcssPlugin: "academy-legacy-values",
    Once(root) {
      root.walkRules((rule) => {
        // :where cannot retain zero specificity on Safari 10. Only the legacy
        // copy uses the equivalent matching selector; modern CSS stays intact.
        rule.selector = rule.selector
          .replace(/:where\(/g, ":is(")
          .replace(/(^|\s):is\(([^(),]+)\)/g, "$1$2")
          .replace(/:focus-visible\b/g, ":focus");
      });
      root.walkDecls((declaration) => {
        let value = declaration.value;
        value = replaceFunction(value, "color-mix", dominantColor);
        value = replaceFunction(value, "env", (args) => args[1] || "0px");
        value = replaceFunction(value, "clamp", (args) => args[0]);
        value = replaceFunction(value, "min", (args) => {
          // A relative width fits a narrow phone. max-width retains the desktop
          // bound when the common width:min(100%, Npx) idiom is encountered.
          const relative = args.find((part) => /%|v[wh]/.test(part));
          const fixed = args.find((part) => /^\d+(?:\.\d+)?(?:px|rem|em)$/.test(part));
          if (declaration.prop === "width" && relative && fixed) {
            declaration.cloneAfter({ prop: "max-width", value: fixed });
          }
          return relative || args[0];
        });
        value = replaceFunction(value, "max", (args) => args.find((part) => /%|v[wh]/.test(part)) || args[0]);
        value = value.replace(/(-?\d*\.?\d+)[dsl]v([wh])/g, "$1v$2");
        declaration.value = value;
      });
      // Registered custom properties are ignored on old engines. Tailwind's
      // initial values must still exist for transform/shadow utility variables.
      const defaults = postcss.rule({ selector: "*, ::before, ::after" });
      root.walkAtRules("property", (rule) => {
        const initial = rule.nodes?.find((node) => node.type === "decl" && node.prop === "initial-value");
        if (initial) defaults.append({ prop: rule.params, value: initial.value });
        rule.remove();
      });
      if (defaults.nodes.length) {
        const properties = postcss.atRule({ name: "layer", params: "properties" });
        properties.append(defaults);
        root.prepend(properties);
      }
    },
  };
}

function flexGapFallbacks() {
  return {
    postcssPlugin: "academy-legacy-flex-gap",
    Once(root) {
      const flexSelectors = new Map();
      const baseGaps = new Map();
      root.walkRules((rule) => {
        if (!rule.nodes?.some((node) => node.type === "decl" && node.prop === "display" && /^(?:inline-)?flex$/.test(node.value))) return;
        const direction = rule.nodes.find((node) => node.type === "decl" && node.prop === "flex-direction")?.value || "row";
        for (const selector of rule.selectors) {
          if (!flexSelectors.has(selector) || rule.parent?.type === "root") flexSelectors.set(selector, direction);
        }
      });
      root.walkRules((rule) => {
        const gap = rule.nodes?.find((node) => node.type === "decl" && node.prop === "gap");
        if (gap && rule.parent?.type === "root") {
          for (const selector of rule.selectors) baseGaps.set(selector, gap);
        }
      });
      root.walkRules((rule) => {
        const gap = rule.nodes?.find((node) => node.type === "decl" && node.prop === "gap");
        const override = rule.nodes?.find((node) => node.type === "decl" && node.prop === "flex-direction");
        if (!gap && !override) return;
        for (const selector of rule.selectors) {
          const direction = override?.value || flexSelectors.get(selector);
          const spacing = gap || baseGaps.get(selector);
          if (!flexSelectors.has(selector) || !direction || !spacing) continue;
          const values = postcss.list.space(spacing.value);
          const column = direction.startsWith("column");
          const fallback = postcss.rule({ selector: `${selector} > * + *` });
          if (override && rule.parent?.type !== "root") {
            fallback.append({ prop: column ? "margin-left" : "margin-top", value: "0", important: spacing.important });
          }
          fallback.append({ prop: column ? "margin-top" : "margin-left", value: column ? values[0] : (values[1] || values[0]), important: spacing.important });
          rule.after(fallback);
        }
      });
    },
  };
}

/** Compile all assets together so layer priority/specificity is shared. */
export async function createLegacyStylesheets(stylesheets) {
  if (!stylesheets.length) return new Map();
  const marker = "academy-legacy-css-file:";
  // Assets may be enumerated before the entry asset. Reserve Tailwind's exact
  // layer order before reading any lazy asset, including its property defaults.
  const combined = "@layer properties,theme,base,components,utilities;\n" +
    stylesheets.map(({ fileName, source }) => `/*${marker}${fileName}*/\n${source}`).join("\n");
  const result = await postcss([
    legacyValues(),
    flexGapFallbacks(),
    postcssPresetEnv({
      browsers: ["ios_saf 10.3", "chrome 64"],
      preserve: false,
      features: {
        "custom-properties": false,
        "has-pseudo-class": false,
        "focus-visible-pseudo-class": false,
        "focus-within-pseudo-class": false,
        "prefers-color-scheme-query": false,
      },
    }),
  ]).process(combined, { from: undefined, map: false });
  const outputs = new Map(stylesheets.map(({ fileName }) => [fileName, ""]));
  let current = stylesheets[0].fileName;
  for (const node of result.root.nodes) {
    if (node.type === "comment" && node.text.startsWith(marker)) {
      current = node.text.slice(marker.length);
    } else {
      outputs.set(current, outputs.get(current) + node.toString() + "\n");
    }
  }
  return outputs;
}

/** Extract SystemJS styles into cached, compatible stylesheets. */
export function legacyCssPlugin(buildVersion) {
  if (!buildVersion) throw new Error("Legacy CSS requires the compilation revision");
  const extracted = new Map();
  const transformIdentity = readFileSync(new URL(import.meta.url), "utf8") +
    readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");
  let base = "/";
  return {
    name: "academy-legacy-css",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      base = config.base;
    },
    renderChunk(code, chunk) {
      if (!chunk.fileName.includes("-legacy")) return null;
      // Vite deliberately injects CSS into SystemJS chunks. Extract before
      // Babel/minification, otherwise both modern @layer rules and hundreds of
      // KB of styles remain inside the legacy JavaScript entry.
      const injection = /var __vite_style__ = document\.createElement\('style'\);__vite_style__\.textContent = ("(?:[^"\\]|\\.)*");document\.head\.appendChild\(__vite_style__\);/g;
      const result = code.replace(injection, (_match, literal) => {
        const source = JSON.parse(literal);
        // Layer specificity is computed across every stylesheet. A change in
        // another asset can change this file's output, so bind its immutable
        // URL to the complete release revision, not only its local source.
        const hash = createHash("sha256").update(buildVersion).update(source).update(transformIdentity).digest("hex").slice(0, 12);
        const fileName = `assets/${chunk.name.replace(/[^a-zA-Z0-9_-]/g, "-")}-${hash}-legacy.css`;
        extracted.set(fileName, source);
        const url = base === "./" || base === ""
          ? `new URL(${JSON.stringify(`../${fileName}`)},import.meta.url).href`
          : JSON.stringify(`${base}${fileName}`);
        return `var __vite_style__ = document.createElement('link');__vite_style__.rel='stylesheet';__vite_style__.href=${url};document.head.appendChild(__vite_style__);`;
      });
      if (result.includes("__vite_style__.textContent")) {
        throw new Error("Legacy CSS injection changed; update the stylesheet extractor before releasing.");
      }
      return result === code ? null : { code: result, map: null };
    },
    async generateBundle(_options, bundle) {
      const legacyOutput = Object.values(bundle).some((chunk) => chunk.type === "chunk" && chunk.fileName.includes("-legacy"));
      if (!legacyOutput) return;
      const inputs = Array.from(extracted, ([fileName, source]) => ({ fileName, source }))
        .sort((a, b) => Number(b.source.includes("@layer utilities")) - Number(a.source.includes("@layer utilities")));
      const outputs = await createLegacyStylesheets(inputs);
      for (const [fileName, source] of outputs) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}
