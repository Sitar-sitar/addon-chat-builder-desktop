using System.IO;
using System.Text.Json;
using AddonChatBuilder.Desktop.Models;

namespace AddonChatBuilder.Desktop.Services;

public sealed class AppSettingsService
{
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
        var shouldSave = false;

        if (File.Exists(userSettingsPath))
        {
            try
            {
                var json = await File.ReadAllTextAsync(userSettingsPath);
                var userSettings = JsonSerializer.Deserialize<DesktopAppSettings>(json, JsonOptions);
                if (userSettings is not null)
                {
                    settings = userSettings;
                }
            }
            catch (JsonException ex)
            {
                await BackupBrokenSettingsAsync(userSettingsPath, ex);
                shouldSave = true;
            }
        }
        else
        {
            shouldSave = true;
        }

        if (ApplyPortableDefaults(settings))
        {
            shouldSave = true;
        }

        if (shouldSave)
        {
            await SaveSettingsFileAsync(userSettingsPath, settings);
        }

        await _log.InfoAsync($"Settings loaded. WebAppPath={settings.WebAppPath}; PreferredPort={settings.PreferredPort}; EnvFilePath={settings.EnvFilePath}");
        return settings;
    }

    public async Task SaveAsync(DesktopAppSettings settings)
    {
        var userSettingsPath = GetUserSettingsPath();
        ApplyPortableDefaults(settings);
        await SaveSettingsFileAsync(userSettingsPath, settings);
        await _log.InfoAsync($"Settings saved. DefaultOutputDir={settings.DefaultOutputDir}");
    }

    private static async Task SaveSettingsFileAsync(string userSettingsPath, DesktopAppSettings settings)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(userSettingsPath)!);
        var tempPath = $"{userSettingsPath}.tmp";
        await File.WriteAllTextAsync(tempPath, JsonSerializer.Serialize(settings, JsonOptions));
        File.Move(tempPath, userSettingsPath, overwrite: true);
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

        try
        {
            var json = await File.ReadAllTextAsync(path);
            return JsonSerializer.Deserialize<DesktopAppSettings>(json, JsonOptions) ?? new DesktopAppSettings();
        }
        catch (JsonException)
        {
            return new DesktopAppSettings();
        }
    }

    private async Task BackupBrokenSettingsAsync(string settingsPath, JsonException exception)
    {
        var backupPath = $"{settingsPath}.broken-{DateTimeOffset.Now:yyyyMMddHHmmss}";
        try
        {
            File.Move(settingsPath, backupPath, overwrite: true);
            await _log.ErrorAsync($"Settings file was invalid and moved to {backupPath}.", exception);
        }
        catch (Exception backupException)
        {
            await _log.ErrorAsync("Settings file was invalid, but backup failed.", backupException);
        }
    }

    private static bool ApplyPortableDefaults(DesktopAppSettings settings)
    {
        var changed = false;

        if (string.IsNullOrWhiteSpace(settings.WebAppPath) || !Directory.Exists(settings.WebAppPath))
        {
            var webAppPath = FindWebAppPath();
            if (!string.IsNullOrWhiteSpace(webAppPath) && settings.WebAppPath != webAppPath)
            {
                settings.WebAppPath = webAppPath;
                changed = true;
            }
        }

        if (string.IsNullOrWhiteSpace(settings.DefaultOutputDir) || !CanCreateDirectory(settings.DefaultOutputDir))
        {
            var defaultOutputDir = AppDataPathService.GetWritableDirectory("mcpack");
            if (settings.DefaultOutputDir != defaultOutputDir)
            {
                settings.DefaultOutputDir = defaultOutputDir;
                changed = true;
            }
        }

        if (string.IsNullOrWhiteSpace(settings.EnvFilePath) || !File.Exists(settings.EnvFilePath))
        {
            var envFilePath = FindEnvFilePath();
            if (settings.EnvFilePath != envFilePath)
            {
                settings.EnvFilePath = envFilePath;
                changed = true;
            }
        }

        if (settings.PreferredPort < 1024 || settings.PreferredPort > 65535)
        {
            settings.PreferredPort = 3031;
            changed = true;
        }

        if (settings.MaxPort < settings.PreferredPort || settings.MaxPort > 65535)
        {
            settings.MaxPort = Math.Min(65535, settings.PreferredPort + 9);
            changed = true;
        }

        if (settings.IdleStopMinutes <= 0)
        {
            settings.IdleStopMinutes = 5;
            changed = true;
        }

        return changed;
    }

    private static string FindWebAppPath()
    {
        foreach (var root in EnumerateSearchRoots())
        {
            foreach (var candidate in new[]
            {
                Path.Combine(root, "addon-chat-builder"),
                Path.Combine(root, "..", "addon-chat-builder")
            })
            {
                var fullPath = Path.GetFullPath(candidate);
                if (File.Exists(Path.Combine(fullPath, "package.json")))
                {
                    return fullPath;
                }
            }
        }

        return string.Empty;
    }

    private static string FindEnvFilePath()
    {
        foreach (var root in EnumerateSearchRoots())
        {
            foreach (var candidate in new[]
            {
                Path.Combine(root, ".env"),
                Path.Combine(root, "addon-chat-builder-desktop", ".env"),
                Path.Combine(root, "..", "addon-chat-builder-desktop", ".env")
            })
            {
                var fullPath = Path.GetFullPath(candidate);
                if (File.Exists(fullPath))
                {
                    return fullPath;
                }
            }
        }

        return string.Empty;
    }

    private static IEnumerable<string> EnumerateSearchRoots()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var directory = new DirectoryInfo(start);
            for (var depth = 0; directory is not null && depth < 8; depth++)
            {
                yield return directory.FullName;
                directory = directory.Parent;
            }
        }
    }

    private static bool CanCreateDirectory(string path)
    {
        try
        {
            Directory.CreateDirectory(path);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
        catch (IOException)
        {
            return false;
        }
    }

    private static string GetUserSettingsPath()
    {
        return Path.Combine(AppDataPathService.GetWritableDirectory(), SettingsFileName);
    }
}
