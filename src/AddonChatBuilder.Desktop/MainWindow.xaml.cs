using System.Diagnostics;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using AddonChatBuilder.Desktop.Models;
using AddonChatBuilder.Desktop.Services;
using Microsoft.Web.WebView2.Core;

namespace AddonChatBuilder.Desktop;

public partial class MainWindow : Window
{
    private readonly LogService _log = new();
    private readonly PortService _ports = new();
    private readonly FolderDialogService _folders = new();
    private readonly ActivityMonitorService _activity = new();
    private readonly WebAppProcessService _webApp;
    private readonly AppSettingsService _settingsService;

    private DesktopAppSettings? _settings;
    private IReadOnlyDictionary<string, string> _env = new Dictionary<string, string>();
    private ServerState _state = ServerState.Starting;
    private int _port;
    private string _desktopApiToken = Guid.NewGuid().ToString("N");
    private int _activeLocalApiRequests;
    private bool _isClosing;
    private bool _isStarting;
    private bool _webViewConfigured;

    public MainWindow()
    {
        InitializeComponent();
        _webApp = new WebAppProcessService(_log);
        _settingsService = new AppSettingsService(_log);
        _activity.IdleTimeoutReached += Activity_IdleTimeoutReached;
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        await StartDesktopAsync(ServerState.Starting);
    }

    private async Task StartDesktopAsync(ServerState startState)
    {
        if (_isClosing || _isStarting)
        {
            return;
        }

        _isStarting = true;
        try
        {
            SetState(startState, startState == ServerState.Restarting ? "アプリを再開しています..." : "Addon Chat Builder を起動しています...", "少しだけお待ちください。");

            _settings ??= await _settingsService.LoadAsync();
            _env = AddDesktopApiToken(await _settingsService.LoadEnvAsync(_settings));
            _activity.Configure(TimeSpan.FromMinutes(_settings.IdleStopMinutes));
            _port = _ports.FindAvailablePort(_settings.PreferredPort, _settings.MaxPort);
            _activeLocalApiRequests = 0;

            await EnsureWebView2Async();
            await ConfigureWebViewAsync();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(50));
            await _webApp.StartAsync(_settings, _port, _env, cts.Token);

            WebView.Source = new Uri($"http://127.0.0.1:{_port}");
            WebView.Visibility = Visibility.Visible;
            Overlay.Visibility = Visibility.Collapsed;
            _activity.Start();
            SetState(ServerState.Running, "準備できました。", "続けて入力できます。");
        }
        catch (Exception ex)
        {
            await _log.ErrorAsync("Startup failed.", ex);
            await _webApp.StopAsync();
            if (_isClosing)
            {
                return;
            }

            SetState(ServerState.Error, "起動できませんでした", "Node.js または addon-chat-builder の構成を確認してください。");
        }
        finally
        {
            _isStarting = false;
        }
    }

    private async Task ConfigureWebViewAsync()
    {
        if (WebView.CoreWebView2 is null)
        {
            return;
        }

        WebView.CoreWebView2.Settings.AreDevToolsEnabled = false;
        WebView.CoreWebView2.WebMessageReceived -= CoreWebView2_WebMessageReceived;
        WebView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

        if (_webViewConfigured)
        {
            return;
        }

        var script = """
            (() => {
              if (window.__addonChatBuilderDesktopBridgeInstalled) return;
              window.__addonChatBuilderDesktopBridgeInstalled = true;

              const desktopApiToken = "__DESKTOP_API_TOKEN__";
              const originalFetch = window.fetch.bind(window);
              let nextRequestId = 1;
              const pending = new Map();

              window.chrome?.webview?.addEventListener("message", (event) => {
                const message = event.data;
                if (!message || message.type !== "outputFolderSelected") return;

                const requestId = message.requestId;
                const resolver = pending.get(requestId);
                if (!resolver) return;

                pending.delete(requestId);
                resolver(new Response(JSON.stringify({
                  canceled: !message.path,
                  path: message.path || ""
                }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
                }));
              });

              window.fetch = (input, init) => {
                const url = typeof input === "string" ? input : input?.url;
                const method = (init?.method || "GET").toUpperCase();
                const localPath = getLocalPath(url);

                if (localPath === "/api/select-folder" && method === "POST" && window.chrome?.webview) {
                  let currentPath = "";
                  try {
                    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
                    currentPath = typeof body.currentPath === "string" ? body.currentPath : "";
                  } catch {
                    currentPath = "";
                  }

                  const requestId = nextRequestId++;
                  const promise = new Promise((resolve) => pending.set(requestId, resolve));
                  window.chrome.webview.postMessage({
                    type: "selectOutputFolder",
                    requestId,
                    currentPath
                  });
                  return promise;
                }

                if ((localPath === "/api/chat" || localPath === "/api/build") && method === "POST") {
                  return retryLocalApi(input, withDesktopToken(init), localPath);
                }

                return originalFetch(input, init);
              };

              function getLocalPath(url) {
                try {
                  const parsed = new URL(url, window.location.origin);
                  return parsed.origin === window.location.origin ? parsed.pathname : "";
                } catch {
                  return "";
                }
              }

              function withDesktopToken(init) {
                const nextInit = { ...(init || {}) };
                const headers = new Headers(init?.headers || {});
                headers.set("X-Desktop-Token", desktopApiToken);
                nextInit.headers = headers;
                return nextInit;
              }

              async function retryLocalApi(input, init, url) {
                const maxAttempts = 3;
                let lastResponse = null;

                window.chrome?.webview?.postMessage({ type: "localApiRequest", active: true, url });
                try {
                  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    lastResponse = await originalFetch(input, init);
                    if (lastResponse.ok || lastResponse.status < 500 || attempt === maxAttempts) {
                      break;
                    }

                    await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
                  }

                  if (!lastResponse || lastResponse.ok || lastResponse.status < 500) {
                    return lastResponse;
                  }

                  let body = null;
                  try {
                    body = await lastResponse.clone().json();
                  } catch {
                    body = null;
                  }

                  const rawError = typeof body?.error === "string" ? body.error : "";
                  if (rawError.includes("OpenAI API") || rawError.includes("Codex API")) {
                    const label = url === "/api/build" ? "生成" : "AI応答";
                    return new Response(JSON.stringify({
                      error: `${label}の取得中に OpenAI 側で一時的なエラーが発生しました。少し時間を置いて、もう一度送信してください。`
                    }), {
                      status: lastResponse.status,
                      headers: { "Content-Type": "application/json" }
                    });
                  }

                  return lastResponse;
                } finally {
                  window.chrome?.webview?.postMessage({ type: "localApiRequest", active: false, url });
                }
              }
            })();
            """;
        script = script.Replace("\"__DESKTOP_API_TOKEN__\"", JsonSerializer.Serialize(_desktopApiToken));
        await WebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        _webViewConfigured = true;
    }

    private async Task EnsureWebView2Async()
    {
        var userDataFolder = AppDataPathService.GetWritableDirectory("WebView2UserData");
        var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
        await WebView.EnsureCoreWebView2Async(environment);
    }

    private IReadOnlyDictionary<string, string> AddDesktopApiToken(IReadOnlyDictionary<string, string> env)
    {
        var values = new Dictionary<string, string>(env, StringComparer.OrdinalIgnoreCase)
        {
            ["DESKTOP_API_TOKEN"] = _desktopApiToken
        };
        return values;
    }

    private async void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        _activity.MarkActivity();

        JsonDocument? document = null;
        try
        {
            document = JsonDocument.Parse(e.WebMessageAsJson);
            if (!document.RootElement.TryGetProperty("type", out var typeProperty))
            {
                return;
            }

            var type = typeProperty.GetString();
            if (type == "localApiRequest")
            {
                var active = document.RootElement.TryGetProperty("active", out var activeProperty) && activeProperty.GetBoolean();
                _activeLocalApiRequests = active ? _activeLocalApiRequests + 1 : Math.Max(0, _activeLocalApiRequests - 1);
                _activity.MarkActivity();
                return;
            }

            if (type != "selectOutputFolder")
            {
                return;
            }

            var currentPath = _settings?.DefaultOutputDir;
            if (document.RootElement.TryGetProperty("currentPath", out var currentPathProperty))
            {
                currentPath = currentPathProperty.GetString();
            }

            var requestId = 0;
            if (document.RootElement.TryGetProperty("requestId", out var requestIdProperty))
            {
                requestId = requestIdProperty.GetInt32();
            }

            var selectedPath = _folders.SelectFolder(currentPath);
            if (WebView.CoreWebView2 is null)
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(selectedPath) && _settings is not null)
            {
                _settings.DefaultOutputDir = selectedPath;
                await _settingsService.SaveAsync(_settings);
            }

            var response = JsonSerializer.Serialize(new
            {
                type = "outputFolderSelected",
                requestId,
                path = selectedPath ?? string.Empty
            });
            WebView.CoreWebView2.PostWebMessageAsJson(response);
            await _log.InfoAsync(string.IsNullOrWhiteSpace(selectedPath) ? "Output folder selection canceled." : $"Output folder selected. Path={selectedPath}");
        }
        catch (Exception ex)
        {
            await _log.ErrorAsync("Failed to handle WebView message.", ex);
        }
        finally
        {
            document?.Dispose();
        }
    }

    private async void Activity_IdleTimeoutReached(object? sender, EventArgs e)
    {
        if (_state != ServerState.Running || _isClosing)
        {
            return;
        }

        if (_activeLocalApiRequests > 0)
        {
            await _log.InfoAsync("Idle timeout skipped because a local API request is still running.");
            _activity.MarkActivity();
            return;
        }

        await _log.InfoAsync("Idle timeout reached. Stopping web app.");
        _activity.Stop();
        await _webApp.StopAsync();
        WebView.Visibility = Visibility.Collapsed;
        SetState(ServerState.StoppedByIdle, "しばらく操作がなかったため、アプリの処理を一時停止しました。", "入力またはクリックすると再開します。");
        ResumeButton.Visibility = Visibility.Visible;
    }

    private async void RetryButton_Click(object sender, RoutedEventArgs e)
    {
        await StartDesktopAsync(ServerState.Starting);
    }

    private async void ResumeButton_Click(object sender, RoutedEventArgs e)
    {
        await ResumeFromIdleAsync();
    }

    private async void Overlay_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (_state == ServerState.StoppedByIdle)
        {
            await ResumeFromIdleAsync();
        }
    }

    private async Task ResumeFromIdleAsync()
    {
        if (_state != ServerState.StoppedByIdle)
        {
            return;
        }

        ResumeButton.Visibility = Visibility.Collapsed;
        await StartDesktopAsync(ServerState.Restarting);
    }

    private void Window_Activity(object sender, InputEventArgs e)
    {
        if (_state == ServerState.StoppedByIdle)
        {
            _ = ResumeFromIdleAsync();
            return;
        }

        _activity.MarkActivity();
    }

    private void WebView_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        _activeLocalApiRequests = 0;
        _activity.MarkActivity();
    }

    private void WebView_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        _activity.MarkActivity();

        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri))
        {
            e.Cancel = true;
            return;
        }

        if (uri.Host == "127.0.0.1" && uri.Port == _port)
        {
            return;
        }

        e.Cancel = true;
        if (uri.Scheme is not ("http" or "https"))
        {
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = e.Uri,
                UseShellExecute = true
            });
        }
        catch
        {
            // External navigation is best effort only.
        }
    }

    private async void Window_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_isClosing)
        {
            return;
        }

        _isClosing = true;
        e.Cancel = true;
        _activity.Stop();
        SetState(ServerState.Stopped, "終了しています...", "起動した処理を停止しています。");
        await _webApp.StopAsync();
        await _log.InfoAsync("Desktop app closed.");
        e.Cancel = false;
        Close();
    }

    public void EmergencyStopWebApp()
    {
        _activity.Stop();
        _webApp.EmergencyStop();
    }

    private void SetState(ServerState state, string title, string message)
    {
        _state = state;
        OverlayTitle.Text = title;
        OverlayMessage.Text = message;
        StatusText.Text = _port > 0 ? $"{title}  Port: {_port}" : title;

        if (state is ServerState.Running)
        {
            Overlay.Visibility = Visibility.Collapsed;
            OverlayButtons.Visibility = Visibility.Collapsed;
            RetryButton.Visibility = Visibility.Collapsed;
            ResumeButton.Visibility = Visibility.Collapsed;
            return;
        }

        Overlay.Visibility = Visibility.Visible;
        WebView.Visibility = Visibility.Collapsed;
        OverlayButtons.Visibility = state is ServerState.Error or ServerState.StoppedByIdle ? Visibility.Visible : Visibility.Collapsed;
        RetryButton.Visibility = state == ServerState.Error ? Visibility.Visible : Visibility.Collapsed;
        ResumeButton.Visibility = state == ServerState.StoppedByIdle ? Visibility.Visible : Visibility.Collapsed;
    }
}
