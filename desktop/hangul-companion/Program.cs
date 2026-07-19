using System.Diagnostics;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows.Forms;

namespace Academy.HangulCompanion;

internal static class Program
{
    private const string Scheme = "academy-hangul";
    private const string ReviewFile = "03_자체양식_문제검수본.hwpx";

    [STAThread]
    private static async Task Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            if (args.Length != 1)
                throw new InvalidOperationException("Academy 도구에서 '한글에서 열기'를 다시 눌러 주세요.");

            var handoffUri = ParseHandoffUri(args[0]);
            using var handler = new HttpClientHandler { AllowAutoRedirect = false };
            using var http = new HttpClient(handler) { Timeout = TimeSpan.FromMinutes(5) };
            var handoff = await ReadHandoffAsync(http, handoffUri);
            CleanupOldTempDirectories();
            var tempRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Academy", "HangulCompanion", "Temp", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);

            var zipPath = Path.Combine(tempRoot, SafeFileName(handoff.FileName, "problem-studio.zip"));
            await DownloadAsync(http, handoff.DownloadUrl, zipPath, handoff.SizeBytes);
            VerifySha256(zipPath, handoff.Sha256);
            var hwpxPath = ExtractReviewHwpx(zipPath, tempRoot);

            if (TryInsertIntoVisibleEditableHangul(hwpxPath, out var reason))
            {
                MessageBox.Show(
                    "현재 한글 문서의 커서 위치에 검수본을 넣었습니다.\n수식·표·도형은 원본과 대조해 주세요.",
                    "Academy 한글 연결",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            Process.Start(new ProcessStartInfo { FileName = hwpxPath, UseShellExecute = true });
            MessageBox.Show(
                $"현재 편집 가능한 한글 문서에 넣지 못해 검수본을 새로 열었습니다.\n\n{reason}",
                "Academy 한글 연결",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Academy 한글 연결", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static Uri ParseHandoffUri(string raw)
    {
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var protocolUri)
            || !protocolUri.Scheme.Equals(Scheme, StringComparison.OrdinalIgnoreCase)
            || !protocolUri.Host.Equals("insert", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("잘못된 Academy 한글 연결 주소입니다.");

        var query = protocolUri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Split('=', 2))
            .FirstOrDefault(parts => parts.Length == 2 && parts[0] == "handoff");
        if (query is null || !Uri.TryCreate(Uri.UnescapeDataString(query[1]), UriKind.Absolute, out var handoffUri))
            throw new InvalidOperationException("한글 연결 코드가 없습니다.");
        if (!TrustedOrigins.IsTrustedHandoff(handoffUri))
            throw new InvalidOperationException("승인된 Academy 서버의 한글 연결만 사용할 수 있습니다.");
        return handoffUri;
    }

    private static async Task<HandoffResponse> ReadHandoffAsync(HttpClient http, Uri uri)
    {
        using var response = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("연결 코드가 만료되었거나 이미 사용되었습니다. 웹에서 다시 시도해 주세요.");
        var payload = await JsonSerializer.DeserializeAsync<HandoffResponse>(
            await response.Content.ReadAsStreamAsync(),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        return payload ?? throw new InvalidOperationException("서버 응답을 읽을 수 없습니다.");
    }

    private static async Task DownloadAsync(HttpClient http, string rawUrl, string target, long expectedSize)
    {
        BoundedDownload.ValidateExpectedSize(expectedSize);
        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var url) || !TrustedOrigins.IsTrustedDownload(url))
            throw new InvalidOperationException("검수본 다운로드 주소가 안전하지 않습니다.");
        using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        BoundedDownload.ValidateContentLength(response.Content.Headers.ContentLength, expectedSize);
        await using var source = await response.Content.ReadAsStreamAsync();
        try
        {
            await using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await BoundedDownload.CopyToAsync(source, output, expectedSize);
        }
        catch
        {
            try { File.Delete(target); } catch { }
            throw;
        }
    }

    private static void VerifySha256(string path, string expected)
    {
        if (string.IsNullOrWhiteSpace(expected) || expected.Length != 64)
            throw new InvalidOperationException("검수본 무결성 정보가 없습니다.");
        using var stream = File.OpenRead(path);
        var actual = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        if (!CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(actual), Convert.FromHexString(expected)))
            throw new InvalidOperationException("검수본 무결성 확인에 실패했습니다.");
    }

    private static string ExtractReviewHwpx(string zipPath, string tempRoot)
    {
        using var archive = ZipFile.OpenRead(zipPath);
        var entry = archive.Entries.FirstOrDefault(item =>
            item.Name.Equals(ReviewFile, StringComparison.OrdinalIgnoreCase));
        if (entry is null)
            throw new InvalidOperationException("ZIP에서 한글 HWPX 검수본을 찾을 수 없습니다.");
        if (entry.Length <= 0 || entry.Length > 50 * 1024 * 1024)
            throw new InvalidOperationException("HWPX 검수본 크기가 안전 범위를 벗어났습니다.");
        var target = Path.Combine(tempRoot, ReviewFile);
        using var source = entry.Open();
        using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.Read);
        source.CopyTo(output);
        return target;
    }

    private static void CleanupOldTempDirectories()
    {
        try
        {
            var root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Academy", "HangulCompanion", "Temp");
            if (!Directory.Exists(root)) return;
            foreach (var directory in Directory.EnumerateDirectories(root))
            {
                if (Directory.GetCreationTimeUtc(directory) < DateTime.UtcNow.AddDays(-1))
                    Directory.Delete(directory, recursive: true);
            }
        }
        catch
        {
            // Temp cleanup must never block the requested handoff.
        }
    }

    private static bool TryInsertIntoVisibleEditableHangul(string hwpxPath, out string reason)
    {
        object? hwp = null;
        try
        {
            hwp = FindVisibleEditableHangul();
            if (hwp is null)
            {
                reason = "열려 있는 일반 편집 모드의 한글 문서를 찾지 못했습니다.";
                return false;
            }

            dynamic automation = hwp;
            var moduleName = Environment.GetEnvironmentVariable("ACADEMY_HWP_FILE_PATH_MODULE");
            if (!string.IsNullOrWhiteSpace(moduleName))
                automation.RegisterModule("FilePathCheckDLL", moduleName);

            dynamic action = automation.CreateAction("InsertFile");
            dynamic set = action.CreateSet();
            action.GetDefault(set);
            set.SetItem("FileName", hwpxPath);
            set.SetItem("KeepSection", 0);
            set.SetItem("KeepCharshape", 0);
            set.SetItem("KeepParashape", 0);
            set.SetItem("KeepStyle", 0);
            if (!(bool)action.Execute(set))
            {
                reason = "한글이 파일 삽입을 허용하지 않았습니다.";
                return false;
            }
            reason = "";
            return true;
        }
        catch (Exception ex)
        {
            reason = $"직접 삽입 실패: {ex.GetBaseException().Message}";
            return false;
        }
        finally
        {
            if (hwp is not null && Marshal.IsComObject(hwp)) Marshal.FinalReleaseComObject(hwp);
        }
    }

    private static object? FindVisibleEditableHangul()
    {
        GetRunningObjectTable(0, out var rot);
        rot.EnumRunning(out var monikerEnum);
        var monikers = new IMoniker[1];
        while (monikerEnum.Next(1, monikers, IntPtr.Zero) == 0)
        {
            CreateBindCtx(0, out var bindContext);
            monikers[0].GetDisplayName(bindContext, null, out var name);
            if (!name.StartsWith("!HwpObject", StringComparison.OrdinalIgnoreCase)) continue;
            rot.GetObject(monikers[0], out var candidate);
            try
            {
                dynamic hwp = candidate;
                bool visible = hwp.XHwpWindows.Active_XHwpWindow.Visible;
                int editMode = hwp.XHwpDocuments.Active_XHwpDocument.EditMode;
                if (visible && editMode == 1) return candidate;
                if (Marshal.IsComObject(candidate)) Marshal.FinalReleaseComObject(candidate);
            }
            catch
            {
                if (Marshal.IsComObject(candidate)) Marshal.FinalReleaseComObject(candidate);
            }
        }
        return null;
    }

    private static string SafeFileName(string value, string fallback)
    {
        var name = Path.GetFileName(value);
        return string.IsNullOrWhiteSpace(name) ? fallback : name;
    }

    [DllImport("ole32.dll")]
    private static extern int GetRunningObjectTable(int reserved, out IRunningObjectTable runningObjectTable);

    [DllImport("ole32.dll")]
    private static extern int CreateBindCtx(int reserved, out IBindCtx bindContext);

    private sealed record HandoffResponse(
        [property: System.Text.Json.Serialization.JsonPropertyName("download_url")] string DownloadUrl,
        [property: System.Text.Json.Serialization.JsonPropertyName("filename")] string FileName,
        [property: System.Text.Json.Serialization.JsonPropertyName("sha256")] string Sha256,
        [property: System.Text.Json.Serialization.JsonPropertyName("size_bytes")] long SizeBytes);
}
