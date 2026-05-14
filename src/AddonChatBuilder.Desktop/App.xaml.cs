namespace AddonChatBuilder.Desktop;

public partial class App : System.Windows.Application
{
    protected override void OnExit(System.Windows.ExitEventArgs e)
    {
        EmergencyStopWebApps();
        base.OnExit(e);
    }

    protected override void OnSessionEnding(System.Windows.SessionEndingCancelEventArgs e)
    {
        EmergencyStopWebApps();
        base.OnSessionEnding(e);
    }

    private void EmergencyStopWebApps()
    {
        foreach (var window in Windows.OfType<MainWindow>())
        {
            window.EmergencyStopWebApp();
        }
    }
}
