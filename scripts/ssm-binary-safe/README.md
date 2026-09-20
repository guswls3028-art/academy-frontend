# Binary-safe development port transport

This directory owns the narrow Academy build of AWS Session Manager plugin
1.2.814.0, commit `dcff8da8cdecd53789bd06a193bd2032665dccd8`. It is a custom
build, version `1.2.814.10001`, not an AWS published binary. Upstream source,
vendored dependencies, license and notices remain owned by AWS and their authors.

The upstream `SendInputDataMessage` converts a single LF to CR regardless of
session type. The multiplexed port path reads 1024-byte chunks; its 8-byte smux
header plus a 1017-byte HTTP request can leave a final standalone LF. Paired
development observations found a complete client header ending CR/LF/CR/LF and
a same-length server input ending CR/LF/CR/CR. Gunicorn then waits for the
missing header terminator and closes the connection. The same conversion is
present in upstream 1.2.835.0, so a version update alone does not fix this case.

`binary-safe-port.patch` restricts the conversion to the existing shell session
type. The real serialization regression checks Port/unknown/unset LF preservation,
shell and command-session Enter compatibility, general binary input, and the
1024/1 split. The original source fails these Port/boundary cases; the patch passes.
The test never logs payloads. Source reference:
[upstream conversion](https://github.com/aws/session-manager-plugin/blob/1.2.814.0/src/datachannel/streaming.go#L284-L287).

`pins.json` fixes the source, patch, test, Go version, custom version and reviewed
Windows/Linux amd64 executable digests. `../binary-safe-ssm.mjs` checks inputs,
creates a fresh LF checkout, builds with the vendored GOPATH and network module
resolution disabled, runs relevant regression/upstream tests, and checks the
result against the reviewed digest. It copies LICENSE, NOTICE and THIRD-PARTY.
No upstream installer, global PATH change, application request change or AWS
operation is part of the build. Go is supplied by the commit-pinned official
setup action in CI; local builds need the same verified Go 1.26.8 toolchain.

```text
node scripts/binary-safe-ssm.mjs <new absolute output directory>
```

The builder refuses existing output directories. Retain a failed directory as
diagnostic evidence and choose a new owned directory after correcting the cause.
Do not bypass digest checks or silently fall back to the system plugin.

The canary verifies manifest, executable digest and custom version before
creating QA rows. Only the fixed API port session receives a child PATH prefixed
with this binary. Setup/Cleanup command sessions use the unchanged system tools.
The required PR/main quality job builds and executes the Linux binary before
any AWS role is assumed. Development downloads only that workflow run's
`binary-safe-ssm` artifact, restores its fixed executable mode, and verifies it
again. The final evidence
records the fixed provenance as `binarySafePortTransport`; request/credential
data is never part of the manifest. Existing document/IAM checks, same-artifact
tests, timeout, cleanup-zero and production approval requirements remain in force.

Windows and Linux digests originate from the same reviewed source and compiler
inputs. The official Linux job must reproduce and execute its binary, then pass
all real-use and cleanup gates. A cross-compiled Linux binary or passing local
regression is not successful release evidence. On any build/provenance/runtime
failure, keep the currently deployed frontend and diagnose the failed gate.

For an upstream replacement, verify the Port boundary and shell compatibility,
update exact pins and regression evidence, and complete the same release gates.
Do not remove this patch merely because the published version is newer. Release
ownership and runtime evidence live in [DEPLOYMENT-OPERATIONS.md](../../docs/DEPLOYMENT-OPERATIONS.md)
and the backend hardening handoff, rather than a separate release log here.
