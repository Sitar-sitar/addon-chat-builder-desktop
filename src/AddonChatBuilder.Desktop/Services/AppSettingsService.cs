using System.IO;
using System.Text.Json;
using AddonChatBuilder.Desktop.Models;

namespace AddonChatBuilder.Desktop.Services;

public sealed class AppSettingsService
{
    private const string SettingsDirectoryName = "AddonChatBuilderDesktop";
    private const string SettingsFileName = "settings.json";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private readonly LogService _log;

    public AppSettingsService(LogService log)
    {
        _log = log;
    }

    public async Task<DesktopAppSettings> LoadAsync()
    {
        var settings = await LoadBundledSettingsAsync();
        var userSettingsPath = GetUserSettingsPath();

        if (File.Exists(userSettingsPath))
        {
            var json = await File.ReadAllTextAsync(userSettingsPath);
            var userSettings = JsonSerializer.Deserialize<DesktopAppSettings>(json, JsonOptions);
            if (userSettings is not null)
            {
                settings = userSettings;
            }
        }
        else
        {
            Directory.CreateDirectory(Path.GetDirectoryName(userSettingsPath)!);
            await File.WriteAllTextAsync(userSettingsPath, JsonSerializer.Serialize(settings, JsonOptions));
        }

        await _log.InfoAsync($"Settings loaded. WebAppPath={settings.WebAppPath}; PreferredPort={settings.PreferredPort}; EnvFilePath={settings.EnvFilePath}");
        return settings;
    }

    public async Task SaveAsync(DesktopAppSettings settings)
    {
        var userSettingsPath = GetUserSettingsPath();
        Directory.CreateDirectory(Path.GetDirectoryName(userSettingsPath)!);
        await File.WriteAllTextAsync(userSettingsPath, JsonSerializer.Serialize(settings, JsonOptions));
        await _log.InfoAsync($"Settings saved. DefaultOutputDir={settings.DefaultOutputDir}");
    }

    public async Task<IReadOnlyDictionary<string, string>> LoadEnvAsync(DesktopAppSettings settings)
    {
        var envPath = settings.EnvFilePath;
        if (string.IsNullOrWhiteSpace(envPath) || !File.Exists(envPath))
        {
            await _log.InfoAsync($"Env file not found. EnvFilePath={envPath}");
            return new Dictionary<string, string>();
        }

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rawLine in await File.ReadAllLinesAsync(envPath))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var separator = line.IndexOf('=');
            if (separator <= 0)
            {
                continue;
            }

            var key = line[..separator].Trim();
            var value = line[(separator + 1)..].Trim().Trim('"');
            values[key] = value;
        }

        await _log.InfoAsync($"Env loaded from {envPath}. Keys={string.Join(",", values.Keys)}");
        return values;
    }

    private static async Task<DesktopAppSettings> LoadBundledSettingsAsync()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        if (!File.Exists(path))
        {
            path = Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json");
        }

        if (!File.Exists(path))
        {
            return new DesktopAppSettings();
        }

        var json = await File.ReadAllTextAsync(path);
        return JsonSerializer.Deserialize<DesktopAppSettings>(json, JsonOptions) ?? new DesktopAppSettings();
    }

    private static string GetUserSettingsPath()
    {
        return Path.Combine(AppDataPathService.GetWritableDirectory(), SettingsFileName);
    }
}
