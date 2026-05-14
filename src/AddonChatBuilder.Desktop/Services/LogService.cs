using System.Globalization;
using System.IO;

namespace AddonChatBuilder.Desktop.Services;

public sealed class LogService
{
    private readonly string _logDirectory;
    private readonly SemaphoreSlim _lock = new(1, 1);

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

        var lines = message.Split(["\r\n", "\n"], StringSplitOptions.None);
        for (var i = 0; i < lines.Length; i++)
        {
            if (lines[i].Contains("API_KEY", StringComparison.OrdinalIgnoreCase) ||
                lines[i].Contains("OPENAI_", StringComparison.OrdinalIgnoreCase))
            {
                var equals = lines[i].IndexOf('=');
                lines[i] = equals >= 0 ? $"{lines[i][..(equals + 1)]}[redacted]" : "[redacted]";
            }
        }

        return string.Join(Environment.NewLine, lines);
    }
}
