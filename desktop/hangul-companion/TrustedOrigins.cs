namespace Academy.HangulCompanion;

internal static class TrustedOrigins
{
    private const string ApiHost = "api.hakwonplus.com";
    private const string StorageHost = "af4f2937d73db240e99864b8518265c5.r2.cloudflarestorage.com";
    private const string HandoffPathPrefix = "/api/v1/tools/problem-studio/hangul-handoffs/";

    internal static bool IsTrustedHandoff(Uri uri) =>
        IsDefaultHttps(uri)
        && uri.DnsSafeHost.Equals(ApiHost, StringComparison.OrdinalIgnoreCase)
        && uri.AbsolutePath.StartsWith(HandoffPathPrefix, StringComparison.Ordinal);

    internal static bool IsTrustedDownload(Uri uri) =>
        IsDefaultHttps(uri)
        && (uri.DnsSafeHost.Equals(ApiHost, StringComparison.OrdinalIgnoreCase)
            || uri.DnsSafeHost.Equals(StorageHost, StringComparison.OrdinalIgnoreCase));

    private static bool IsDefaultHttps(Uri uri) =>
        uri.IsAbsoluteUri
        && uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
        && uri.IsDefaultPort
        && string.IsNullOrEmpty(uri.UserInfo);
}
