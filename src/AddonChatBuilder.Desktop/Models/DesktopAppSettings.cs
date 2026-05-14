namespace AddonChatBuilder.Desktop.Models;

public sealed class DesktopAppSettings
{
    public string WebAppPath { get; set; } = string.Empty;
    public int PreferredPort { get; set; } = 3031;
    public int MaxPort { get; set; } = 3040;
    public int IdleStopMinutes { get; set; } = 5;
    public string DefaultOutputDir { get; set; } = string.Empty;
    public string NodePath { get; set; } = string.Empty;
    public string EnvFilePath { get; set; } = string.Empty;
}
