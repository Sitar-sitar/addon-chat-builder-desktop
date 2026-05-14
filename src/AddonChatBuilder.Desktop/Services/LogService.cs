using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;

namespace AddonChatBuilder.Desktop.Services;

public sealed class LogService
{
    private static readonly TimeSpan Retention = TimeSpan.FromDays(30);
    private static readonly Regex AssignmentSecretRegex = new(
        @"(?i)\b(api[_-]?key|openai[_a-z0-9-]*|authorization|bearer|token)\b\s*[:=]\s*[""']?[^""'\s;]+",
        RegexOptions.Compiled);
    private static readonly Regex OpenAiKeyRegex = new(
        @"\bsk-[A-Za-z0-9_-]{16,}\b",
        RegexOptions.Compiled);
    private static readonly Regex BearerRegex = new(
        @"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+",
        RegexOptions.Compiled);

    private readonly string _logDirectory;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private bool _cleanupDone;

    public LogService()
    {
        _logDirectory = AppDataPathService.GetWritableDirectory("logs");
    }

    public Task InfoAsync(string message) => WriteAsync("INFO", message);

    public Task ErrorAsync(string message, Exception? exception = null)
    {
        var detail = exception is null ? message : $"{message} {exception.GetType().Name}: {exception.Message}";
        return WriteAsync("ERROR", detail);
    }

    public Task WebAppAsync(string message) => WriteAsync("WEBAPP", message, "webapp");

    private async Task WriteAsync(string level, string message, string prefix = "desktop")
    {
        var now = DateTimeOffset.Now;
        var fileName = $"{prefix}-{now:yyyy-MM-dd}.log";
        var path = Path.Combine(_logDirectory, fileName);
        var sanitized = RedactSecrets(message);
        var line = string.Create(
            CultureInfo.InvariantCulture,
            $"{now:yyyy-MM-dd HH:mm:ss.fff zzz} [{level}] {sanitized}{Environment.NewLine}");

        await _lock.WaitAsync();
        try
        {
            CleanupOldLogs();
            await File.AppendAllTextAsync(path, line);
        }
        finally
        {
            _lock.Release();
        }
    }

    private static string RedactSecrets(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return message;
        }

        var redacted = AssignmentSecretRegex.Replace(message, match =>
        {
            var separatorIndex = match.Value.IndexOf('=');
            if (separatorIndex < 0)
            {
                separatorIndex = match.Value.IndexOf(':');
            }

            return separatorIndex >= 0 ? $"{match.Value[..(separatorIndex + 1)]}[redacted]" : "[redacted]";
        });

        redacted = BearerRegex.Replace(redacted, "Bearer [redacted]");
        redacted = OpenAiKeyRegex.Replace(redacted, "[redacted]");
        return redacted;
    }

    private void CleanupOldLogs()
    {
        if (_cleanupDone)
        {
            return;
        }

        _cleanupDone = true;
        var cutoff = DateTime.UtcNow - Retention;
        foreach (var path in Directory.EnumerateFiles(_logDirectory, "*.log"))
        {
            try
            {
                if (File.GetLastWriteTimeUtc(path) < cutoff)
                {
                    File.Delete(path);
                }
            }
            catch
            {
                // Logging must never fail because old log cleanup failed.
            }
        }
    }
}
