using System.IO;

namespace AddonChatBuilder.Desktop.Services;

public static class AppDataPathService
{
    private const string AppDirectoryName = "AddonChatBuilderDesktop";

    public static string GetWritableDirectory(params string[] parts)
    {
        var candidates = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            AppContext.BaseDirectory
        };

        foreach (var root in candidates.Where(value => !string.IsNullOrWhiteSpace(value)))
        {
            var path = Path.Combine([root, AppDirectoryName, .. parts]);
            try
            {
                Directory.CreateDirectory(path);
                return path;
            }
            catch (UnauthorizedAccessException)
            {
            }
            catch (IOException)
            {
            }
        }

        var fallback = Path.Combine([Directory.GetCurrentDirectory(), AppDirectoryName, .. parts]);
        Directory.CreateDirectory(fallback);
        return fallback;
    }
}
