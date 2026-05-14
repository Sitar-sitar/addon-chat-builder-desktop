using System.Diagnostics;
using System.IO;
using System.Net.Http;
using AddonChatBuilder.Desktop.Models;

namespace AddonChatBuilder.Desktop.Services;

public sealed class WebAppProcessService : IDisposable
{
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(45);

    private readonly LogService _log;
    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(2)
    };

    private Process? _process;
    private bool _processReportedReady;

    public WebAppProcessService(LogService log)
    {
        _log = log;
    }

    public bool IsRunning => _process is { HasExited: false };
    public int? ProcessId => IsRunning ? _process?.Id : null;

    public async Task StartAsync(DesktopAppSettings settings, int port, IReadOnlyDictionary<string, string> env, CancellationToken cancellationToken)
    {
        if (IsRunning)
        {
            await _log.InfoAsync($"Web app is already running. Pid={_process!.Id}");
            return;
        }

        ValidateWebApp(settings.WebAppPath);
        var nodePath = ResolveNodePath(settings.NodePath);
        var nextPath = Path.Combine(settings.WebAppPath, "node_modules", "next", "dist", "bin", "next");
        if (!File.Exists(nextPath))
        {
            throw new FileNotFoundException("Next.js entrypoint was not found.", nextPath);
        }

        var command = File.Exists(Path.Combine(settings.WebAppPath, ".next", "BUILD_ID")) ? "start" : "dev";
        var startInfo = new ProcessStartInfo
        {
            FileName = nodePath,
            WorkingDirectory = settings.WebAppPath,
            Arguments = $"\"{nextPath}\" {command} --hostname 127.0.0.1 --port {port}",
            CreateNoWindow = true,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        foreach (var (key, value) in env)
        {
            startInfo.Environment[key] = value;
        }

        startInfo.Environment["DEFAULT_OUTPUT_DIR"] = settings.DefaultOutputDir;
        startInfo.Environment["PORT"] = port.ToString();

        await _log.InfoAsync($"Starting web app. NodePath={nodePath}; WebAppPath={settings.WebAppPath}; Command={command}; Port={port}");
        _processReportedReady = false;
        _process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        _process.OutputDataReceived += (_, e) => HandleWebOutput(e.Data);
        _process.ErrorDataReceived += (_, e) => HandleWebOutput(e.Data);

        if (!_process.Start())
        {
            throw new InvalidOperationException("Failed to start the web app process.");
        }

        _process.BeginOutputReadLine();
        _process.BeginErrorReadLine();
        await _log.InfoAsync($"Web app process started. Pid={_process.Id}");
        await WaitUntilReadyAsync(port, cancellationToken);
    }

    public async Task StopAsync()
    {
        if (_process is null)
        {
            return;
        }

        var process = _process;
        _process = null;

        if (process.HasExited)
        {
            process.Dispose();
            return;
        }

        await _log.InfoAsync($"Stopping web app process. Pid={process.Id}");
        try
        {
            process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
        }
        catch (TimeoutException)
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (Exception ex)
        {
            await _log.ErrorAsync("Failed while stopping web app process.", ex);
        }
        finally
        {
            process.Dispose();
        }
    }

    private async Task WaitUntilReadyAsync(int port, CancellationToken cancellationToken)
    {
        using var timeoutCts = new CancellationTokenSource(StartupTimeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        while (!linkedCts.IsCancellationRequested)
        {
            if (_process is { HasExited: true })
            {
                throw new InvalidOperationException("The web app process exited before it became ready.");
            }

            if (await IsReadyAsync(port))
            {
                await _log.InfoAsync($"Web app is ready. Port={port}");
                return;
            }

            if (_processReportedReady)
            {
                await Task.Delay(500, linkedCts.Token).ConfigureAwait(false);
                await _log.InfoAsync($"Web app reported ready from process output. Port={port}");
                return;
            }

            await Task.Delay(1000, linkedCts.Token).ConfigureAwait(false);
        }

        throw new TimeoutException("Timed out while waiting for the web app to become ready.");
    }

    private async Task<bool> IsReadyAsync(int port)
    {
        try
        {
            var health = await _httpClient.GetAsync($"http://127.0.0.1:{port}/api/health");
            if (health.IsSuccessStatusCode)
            {
                return true;
            }
        }
        catch
        {
            // Next.js may still be compiling.
        }

        try
        {
            var home = await _httpClient.GetAsync($"http://127.0.0.1:{port}/");
            return home.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static void ValidateWebApp(string webAppPath)
    {
        if (!Directory.Exists(webAppPath))
        {
            throw new DirectoryNotFoundException(webAppPath);
        }

        if (!File.Exists(Path.Combine(webAppPath, "package.json")))
        {
            throw new FileNotFoundException("package.json was not found.", Path.Combine(webAppPath, "package.json"));
        }
    }

    private static string ResolveNodePath(string configuredPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath) && File.Exists(configuredPath))
        {
            return configuredPath;
        }

        var pathVariable = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (var directory in pathVariable.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmedDirectory = directory.Trim();
            if (string.IsNullOrWhiteSpace(trimmedDirectory))
            {
                continue;
            }

            var candidate = Path.Combine(trimmedDirectory, "node.exe");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException("Node.js was not found.", configuredPath);
    }

    private void HandleWebOutput(string? line)
    {
        if (line?.Contains("Ready in", StringComparison.OrdinalIgnoreCase) == true)
        {
            _processReportedReady = true;
        }

        _ = LogWebOutputAsync(line);
    }

    private async Task LogWebOutputAsync(string? line)
    {
        if (!string.IsNullOrWhiteSpace(line))
        {
            await _log.WebAppAsync(line);
        }
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        _process?.Dispose();
    }
}
