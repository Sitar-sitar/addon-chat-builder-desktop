namespace AddonChatBuilder.Desktop.Models;

public sealed class WebAppStatus
{
    public ServerState State { get; init; }
    public string Message { get; init; } = string.Empty;
    public int? Port { get; init; }
    public int? ProcessId { get; init; }
}
