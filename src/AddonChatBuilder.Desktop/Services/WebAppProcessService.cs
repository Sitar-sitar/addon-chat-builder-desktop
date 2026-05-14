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
    private readonly SemaphoreSlim _lifecycleLock = new(1, 1);

    private Process? _process;
    private ProcessJob? _processJob;
    private CancellationTokenSource? _startupCancellation;
    private bool _processReportedReady;

    public WebAppProcessService(LogService log)
    {
        _log = log;
    }

    public bool IsRunning => _process is { HasExited: false };
    public int? ProcessId => IsRunning ? _process?.Id : null;

    public async Task StartAsync(DesktopAppSettings settings, int port, IReadOnlyDictionary<string, string> env, CancellationToken cancellationToken)
    {
        await _lifecycleLock.WaitAsync(cancellationToken);
        Process? startedProcess = null;
        ProcessJob? startedJob = null;
        var processStarted = false;

        try
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
            startedJob = ProcessJob.CreateKillOnClose();
            startedProcess = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            startedProcess.OutputDataReceived += (_, e) => HandleWebOutput(e.Data);
            startedProcess.ErrorDataReceived += (_, e) => HandleWebOutput(e.Data);

            if (!startedProcess.Start())
            {
                throw new InvalidOperationException("Failed to start the web app process.");
            }

            processStarted = true;
            startedJob.Add(startedProcess);
            _process = startedProcess;
            _processJob = startedJob;
            startedProcess.BeginOutputReadLine();
            startedProcess.BeginErrorReadLine();
            await _log.InfoAsync($"Web app process started. Pid={startedProcess.Id}");

            using var startupCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            _startupCancellation = startupCts;
            await WaitUntilReadyAsync(startedProcess, port, startupCts.Token);
            _startupCancellation = null;
        }
        catch
        {
            _startupCancellation = null;
            if (startedProcess is not null && processStarted)
            {
                await StopProcessAsync(startedProcess, startedJob);
            }
            else
            {
                startedProcess?.Dispose();
                startedJob?.Dispose();
            }

            if (ReferenceEquals(_process, startedProcess))
            {
                _process = null;
                _processJob = null;
            }

            throw;
        }
        finally
        {
            _lifecycleLock.Release();
        }
    }

    public async Task StopAsync()
    {
        _startupCancellation?.Cancel();
        await _lifecycleLock.WaitAsync();
        try
        {
            if (_process is null)
            {
                return;
            }

            var process = _process;
            var job = _processJob;
            _process = null;
            _processJob = null;

            await StopProcessAsync(process, job);
        }
        finally
        {
            _lifecycleLock.Release();
        }
    }

    public void EmergencyStop()
    {
        _startupCancellation?.Cancel();

        if (!_lifecycleLock.Wait(TimeSpan.FromSeconds(10)))
        {
            return;
        }

        try
        {
            if (_process is null)
            {
                return;
            }

            var process = _process;
            var job = _processJob;
            _process = null;
            _processJob = null;
            StopProcess(process, job);
        }
        finally
        {
            _lifecycleLock.Release();
        }
    }

    private async Task StopProcessAsync(Process process, ProcessJob? job)
    {
        if (process.HasExited)
        {
            job?.Dispose();
            process.Dispose();
            return;
        }

        await _log.InfoAsync($"Stopping web app process. Pid={process.Id}");
        try
        {
            await KillAndWaitAsync(process);
            if (!process.HasExited)
            {
                await _log.ErrorAsync($"Web app process did not exit after kill. Pid={process.Id}");
            }
        }
        catch (Exception ex)
        {
            await _log.ErrorAsync("Failed while stopping web app process.", ex);
        }
        finally
        {
            job?.Dispose();
            process.Dispose();
        }
    }

    private static async Task KillAndWaitAsync(Process process)
    {
        if (process.HasExited)
        {
            return;
        }

        process.Kill(entireProcessTree: true);
        try
        {
            await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
            return;
        }
        catch (TimeoutException)
        {
            // Try one more time below.
        }

        if (process.HasExited)
        {
            return;
        }

        process.Kill(entireProcessTree: true);
        try
        {
            await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
        }
        catch (TimeoutException)
        {
            // Caller will log the final state.
        }
    }

    private static void StopProcess(Process process, ProcessJob? job)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                if (!process.WaitForExit(5000) && !process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                    process.WaitForExit(5000);
                }
            }
        }
        catch
        {
            // This is an emergency shutdown path; the job object remains the final guard.
        }
        finally
        {
            job?.Dispose();
            process.Dispose();
        }
    }

    private async Task WaitUntilReadyAsync(Process process, int port, CancellationToken cancellationToken)
    {
        using var timeoutCts = new CancellationTokenSource(StartupTimeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        while (!linkedCts.IsCancellationRequested)
        {
            if (process.HasExited)
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
        EmergencyStop();
        _lifecycleLock.Dispose();
        _httpClient.Dispose();
    }
}
