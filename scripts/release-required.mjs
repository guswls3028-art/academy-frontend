import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Only prose whose location is outside the runtime can skip release stages.
// Unknown input, executable docs and policy/config data keep the full chain.
export function requiresRelease(paths) {
  return paths.length === 0 || paths.some((file) => !(
    /^(?:AGENTS|README)\.md$/.test(file)
    || /^docs\/.+\.md$/.test(file)
    || /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(file)
  ));
}

export function classifyRelease({ eventName, event, head, cwd = process.cwd() }) {
  if (eventName === "workflow_dispatch") return { required: true, reason: "explicit-release" };
  const base = eventName === "push" ? event.before
    : eventName === "pull_request" ? event.pull_request?.base?.sha : null;
  const sha = /^[0-9a-f]{40}$/;
  if (!sha.test(base || "") || /^0+$/.test(base) || !sha.test(head || "")) {
    return { required: true, reason: "unknown-comparison" };
  }
  const diff = spawnSync("git", ["diff", "--name-only", "--no-renames", "-z", base, head, "--"], {
    cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  if (diff.status !== 0) return { required: true, reason: "unavailable-comparison" };
  const paths = diff.stdout.split("\0").filter(Boolean);
  const required = requiresRelease(paths);
  return { required, reason: required ? "release-inputs" : "prose-only" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = classifyRelease({
    eventName: process.env.GITHUB_EVENT_NAME,
    event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    head: process.env.GITHUB_SHA,
  });
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `required=${result.required}\n`);
  console.log(`Release required: ${result.required} (${result.reason}). Required quality checks still run.`);
}
