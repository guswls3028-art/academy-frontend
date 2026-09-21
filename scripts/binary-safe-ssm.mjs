import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const inputs = fileURLToPath(new URL("./ssm-binary-safe/", import.meta.url));
export const SSM_PINS = JSON.parse(fs.readFileSync(path.join(inputs, "pins.json"), "utf8"));
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const packageName = "github.com/aws/session-manager-plugin";

function supportedPlatform(platform = process.platform) {
  assert.ok(["win32", "linux"].includes(platform) && process.arch === "x64", "Unsupported SSM build platform");
  assert.match(SSM_PINS.binarySha256[platform], /^[a-f0-9]{64}$/, "Missing reviewed SSM binary digest");
  return platform;
}

export function expectedSsmManifest(platform) {
  supportedPlatform(platform);
  return {
    schema: "academy-binary-safe-ssm/v1",
    customBuild: true,
    upstreamCommit: SSM_PINS.upstreamCommit,
    upstreamVersion: SSM_PINS.upstreamVersion,
    version: SSM_PINS.version,
    goVersion: SSM_PINS.goVersion,
    patchSha256: SSM_PINS.patchSha256,
    regressionSha256: SSM_PINS.regressionSha256,
    platform,
    arch: "amd64",
    binarySha256: SSM_PINS.binarySha256[platform],
  };
}

export function assertSsmManifest(value, platform) {
  assert.ok(isDeepStrictEqual(value, expectedSsmManifest(platform)), "Unreviewed SSM build provenance");
}

function regularFile(file) {
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), "SSM input must be a regular file");
}

export function verifyBinarySafeSsm(directory) {
  const platform = supportedPlatform();
  assert.ok(typeof directory === "string" && path.isAbsolute(directory), "Pinned SSM directory is required");
  const root = fs.lstatSync(directory);
  assert.ok(root.isDirectory() && !root.isSymbolicLink(), "SSM directory must be owned and direct");
  const manifestFile = path.join(directory, "manifest.json");
  regularFile(manifestFile);
  assert.ok(fs.statSync(manifestFile).size <= 4096, "SSM provenance exceeds limit");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  assertSsmManifest(manifest, platform);
  const binary = path.join(directory, "bin", platform === "win32" ? "session-manager-plugin.exe" : "session-manager-plugin");
  regularFile(binary);
  assert.equal(hash(binary), manifest.binarySha256, "SSM executable digest differs");
  assert.equal(execFileSync(binary, ["--version"], {
    encoding: "utf8", windowsHide: true, timeout: 15_000, maxBuffer: 4096,
  }).trim(), manifest.version, "SSM custom version differs");
  return { binary, manifest };
}

export function binarySafeSsmEnvironment(directory, inherited = process.env) {
  const { binary, manifest } = verifyBinarySafeSsm(directory);
  const pathKeys = Object.keys(inherited).filter((key) => key.toUpperCase() === "PATH");
  assert.ok(pathKeys.length <= 1, "Ambiguous inherited executable path");
  const previousPath = pathKeys.length ? inherited[pathKeys[0]] : "";
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => key.toUpperCase() !== "PATH"));
  env.PATH = [path.dirname(binary), previousPath].filter(Boolean).join(path.delimiter);
  return { env, manifest };
}

// No installer, global environment change, unpinned dependency fetch, or AWS call.
export function buildBinarySafeSsm(directory) {
  const platform = supportedPlatform();
  assert.ok(path.isAbsolute(directory), "Build directory must be absolute");
  assert.equal(fs.existsSync(directory), false, "Refusing to overwrite an existing SSM build");
  const patchFile = path.join(inputs, "binary-safe-port.patch");
  const testFile = path.join(inputs, "binary_safe_regression_test.go");
  assert.equal(hash(patchFile), SSM_PINS.patchSha256, "SSM patch input differs");
  assert.equal(hash(testFile), SSM_PINS.regressionSha256, "SSM regression input differs");
  assert.equal(execFileSync("go", ["version"], { encoding: "utf8", windowsHide: true, timeout: 15_000 }).trim(),
    `go version ${SSM_PINS.goVersion} ${platform === "win32" ? "windows" : "linux"}/amd64`, "Pinned Go compiler required");
  fs.mkdirSync(directory, { recursive: true });
  const gopath = path.join(directory, "gopath");
  const source = path.join(gopath, "src", ...packageName.split("/"));
  fs.mkdirSync(source, { recursive: true });
  const git = (...args) => execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.longpaths=true", ...args], {
    cwd: source, encoding: "utf8", windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
  });
  git("init", "-q");
  git("remote", "add", "origin", SSM_PINS.upstreamRepository);
  git("fetch", "--depth=1", "origin", SSM_PINS.upstreamCommit);
  git("checkout", "--detach", "FETCH_HEAD");
  assert.equal(git("rev-parse", "HEAD").trim(), SSM_PINS.upstreamCommit);
  assert.equal(git("status", "--porcelain").trim(), "", "Source checkout must begin clean");
  git("apply", "--check", patchFile);
  git("apply", patchFile);
  const regression = path.join(source, "src", "datachannel", "binary_safe_regression_test.go");
  assert.equal(fs.existsSync(regression), false);
  fs.copyFileSync(testFile, regression, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(source, "VERSION"), SSM_PINS.version, "utf8");
  const env = {
    ...process.env, GO111MODULE: "off", GOTOOLCHAIN: "local", GOENV: "off", GOFLAGS: "", GOWORK: "off",
    CGO_ENABLED: "0", GOPROXY: "off", GOSUMDB: "off", GOAMD64: "v1", GOEXPERIMENT: "",
    GOPATH: [gopath, path.join(source, "vendor")].join(path.delimiter),
    GOCACHE: path.join(directory, "go-cache"), GOOS: platform === "win32" ? "windows" : "linux", GOARCH: "amd64",
  };
  const go = (args) => execFileSync("go", args, {
    cwd: source, env, encoding: "utf8", windowsHide: true, timeout: 300_000, maxBuffer: 4 * 1024 * 1024,
  });
  go(["run", `${packageName}/src/version/versiongenerator`]);
  const result = go(["test", "-count=1", "-run",
    "^(TestBinarySafe|TestSendInputDataMessage$|TestProcessSessionTypeHandshakeActionFor(InteractiveCommands|NonInteractiveCommands)$)",
    `${packageName}/src/datachannel`]);
  fs.writeFileSync(path.join(directory, "regression.log"), result);
  const bin = path.join(directory, "bin");
  fs.mkdirSync(bin);
  const binary = path.join(bin, platform === "win32" ? "session-manager-plugin.exe" : "session-manager-plugin");
  go(["build", "-p=4", "-trimpath", "-buildvcs=false", "-ldflags", "-s -w -buildid=", "-o", binary,
    `${packageName}/src/sessionmanagerplugin-main`]);
  assert.equal(hash(binary), SSM_PINS.binarySha256[platform], "Rebuilt SSM digest differs from reviewed binary");
  for (const name of ["LICENSE", "NOTICE", "THIRD-PARTY"]) fs.copyFileSync(path.join(source, name), path.join(bin, name));
  fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(expectedSsmManifest(platform), null, 2)}\n`, { flag: "wx" });
  return verifyBinarySafeSsm(directory).manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, "Usage: node scripts/binary-safe-ssm.mjs <new absolute output directory>");
  console.log(JSON.stringify(buildBinarySafeSsm(process.argv[2])));
}
