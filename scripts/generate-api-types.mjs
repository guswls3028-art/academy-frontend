import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import url from "node:url";

import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "scripts", "openapi-backend-source.json");
const outputPath = path.join(root, "src", "shared", "api", "generated", "schema.d.ts");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function readSource(source) {
  if (/^https:\/\//.test(source)) {
    const response = await fetch(source, { redirect: "error" });
    if (!response.ok) throw new Error(`OpenAPI source returned HTTP ${response.status}`);
    return response.json();
  }
  const absolute = path.isAbsolute(source) ? source : path.resolve(root, source);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function configuredSource() {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!/^[0-9a-f]{40}$/.test(config.revision)) {
    throw new Error("OpenAPI backend source must use an immutable 40-character commit SHA");
  }
  return `https://raw.githubusercontent.com/${config.repository}/${config.revision}/${config.path}`;
}

const source = argument("--source") ?? configuredSource();
const schema = await readSource(source);
const nodes = await openapiTS(schema, { alphabetize: true });
const generated = `${COMMENT_HEADER}${astToString(nodes)}`;
const check = process.argv.includes("--check");

if (!check) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generated, "utf8");
  console.log(`wrote ${path.relative(root, outputPath)}`);
} else if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== generated) {
  console.error("OPENAPI_TYPES_FAIL: generated schema.d.ts is stale");
  process.exitCode = 1;
} else {
  console.log("OPENAPI_TYPES_PASS");
}
