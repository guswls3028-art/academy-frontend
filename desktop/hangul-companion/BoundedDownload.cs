namespace Academy.HangulCompanion;

internal static class BoundedDownload
{
    internal const long MaxArchiveBytes = 1024L * 1024 * 1024;

    internal static void ValidateExpectedSize(long expectedSize)
    {
        if (expectedSize <= 0 || expectedSize > MaxArchiveBytes)
            throw new InvalidOperationException("검수본 크기 정보가 안전 범위를 벗어났습니다.");
    }

    internal static void ValidateContentLength(long? contentLength, long expectedSize)
    {
        if (contentLength is not null && contentLength.Value != expectedSize)
            throw new InvalidOperationException("검수본 응답 크기가 서버 정보와 다릅니다.");
    }

    internal static async Task CopyToAsync(
        Stream source,
        Stream destination,
        long expectedSize,
        CancellationToken cancellationToken = default)
    {
        ValidateExpectedSize(expectedSize);
        var buffer = new byte[81920];
        long written = 0;
        while (true)
        {
            var read = await source.ReadAsync(buffer.AsMemory(), cancellationToken);
            if (read == 0) break;
            if (written > expectedSize - read || written > MaxArchiveBytes - read)
                throw new InvalidOperationException("검수본 다운로드 크기가 안전 범위를 초과했습니다.");
            await destination.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            written += read;
        }
        if (written != expectedSize)
            throw new InvalidOperationException("다운로드한 검수본 크기가 서버 정보와 다릅니다.");
    }
}
