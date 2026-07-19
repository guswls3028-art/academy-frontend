using Academy.HangulCompanion;

static void Assert(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

Assert(
    TrustedOrigins.IsTrustedHandoff(new Uri("https://api.hakwonplus.com/api/v1/tools/problem-studio/hangul-handoffs/token/")),
    "production handoff URL must be trusted");
Assert(
    !TrustedOrigins.IsTrustedHandoff(new Uri("https://evil.example/api/v1/tools/problem-studio/hangul-handoffs/token/")),
    "foreign handoff host must be rejected");
Assert(
    !TrustedOrigins.IsTrustedHandoff(new Uri("https://api.hakwonplus.com.evil.example/api/v1/tools/problem-studio/hangul-handoffs/token/")),
    "lookalike handoff host must be rejected");
Assert(
    !TrustedOrigins.IsTrustedHandoff(new Uri("https://api.hakwonplus.com:444/api/v1/tools/problem-studio/hangul-handoffs/token/")),
    "non-default HTTPS port must be rejected");
Assert(
    !TrustedOrigins.IsTrustedHandoff(new Uri("https://user@api.hakwonplus.com/api/v1/tools/problem-studio/hangul-handoffs/token/")),
    "handoff userinfo must be rejected");
Assert(
    !TrustedOrigins.IsTrustedHandoff(new Uri("https://api.hakwonplus.com/api/v1/other/token/")),
    "unrelated API path must be rejected");
Assert(
    TrustedOrigins.IsTrustedDownload(new Uri("https://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com/academy-storage/review.zip?X-Amz-Signature=test")),
    "production R2 download must be trusted");
Assert(
    !TrustedOrigins.IsTrustedDownload(new Uri("https://another-account.r2.cloudflarestorage.com/academy-storage/review.zip")),
    "foreign R2 account must be rejected");
Assert(
    !TrustedOrigins.IsTrustedDownload(new Uri("http://af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com/review.zip")),
    "plain HTTP download must be rejected");
Assert(
    !TrustedOrigins.IsTrustedDownload(new Uri("https://user@af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com/review.zip")),
    "download userinfo must be rejected");

AssertThrows(
    () => BoundedDownload.ValidateExpectedSize(0),
    "missing expected size must be rejected");
AssertThrows(
    () => BoundedDownload.ValidateExpectedSize(BoundedDownload.MaxArchiveBytes + 1),
    "oversized expected size must be rejected");
AssertThrows(
    () => BoundedDownload.ValidateContentLength(4, 3),
    "mismatched Content-Length must be rejected");
BoundedDownload.ValidateContentLength(null, 3);

await using (var exactSource = new MemoryStream([1, 2, 3]))
await using (var exactTarget = new MemoryStream())
{
    await BoundedDownload.CopyToAsync(exactSource, exactTarget, 3);
    Assert(exactTarget.Length == 3, "exact bounded download must succeed");
}

await using (var overrunSource = new MemoryStream([1, 2, 3, 4]))
await using (var overrunTarget = new MemoryStream())
{
    await AssertThrowsAsync(
        () => BoundedDownload.CopyToAsync(overrunSource, overrunTarget, 3),
        "stream overrun must be rejected");
    Assert(overrunTarget.Length <= 3, "stream overrun must not write beyond the declared size");
}

await using (var shortSource = new MemoryStream([1, 2]))
await using (var shortTarget = new MemoryStream())
{
    await AssertThrowsAsync(
        () => BoundedDownload.CopyToAsync(shortSource, shortTarget, 3),
        "truncated stream must be rejected");
}

Console.WriteLine("Hangul companion trust-boundary tests passed.");

static void AssertThrows(Action action, string message)
{
    try
    {
        action();
    }
    catch (InvalidOperationException)
    {
        return;
    }
    throw new InvalidOperationException(message);
}

static async Task AssertThrowsAsync(Func<Task> action, string message)
{
    try
    {
        await action();
    }
    catch (InvalidOperationException)
    {
        return;
    }
    throw new InvalidOperationException(message);
}
