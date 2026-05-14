namespace AddonChatBuilder.Desktop.Models;

public sealed class DesktopAppSettings
{
    public string WebAppPath { get; set; } = @"D:\my-app2\Minecraft_Addon\addon-chat-builder";
    public int PreferredPort { get; set; } = 3031;
    public int MaxPort { get; set; } = 3040;
    public int IdleStopMinutes { get; set; } = 5;
    public string DefaultOutputDir { get; set; } = @"D:\my-app2\Minecraft_Addon\mcpackファイル";
    public string NodePath { get; set; } = @"C:\Program Files\nodejs\node.exe";
    public string EnvFilePath { get; set; } = @"D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\.env";
}
