using System.Windows.Threading;

namespace AddonChatBuilder.Desktop.Services;

public sealed class ActivityMonitorService
{
    private readonly DispatcherTimer _timer;
    private TimeSpan _idleTimeout = TimeSpan.FromMinutes(5);
    private DateTimeOffset _lastActivity = DateTimeOffset.Now;
    private bool _hasRaisedTimeout;

    public ActivityMonitorService()
    {
        _timer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(15)
        };
        _timer.Tick += OnTick;
    }

    public event EventHandler? IdleTimeoutReached;

    public void Configure(TimeSpan idleTimeout)
    {
        _idleTimeout = idleTimeout <= TimeSpan.Zero ? TimeSpan.FromMinutes(5) : idleTimeout;
    }

    public void MarkActivity()
    {
        _lastActivity = DateTimeOffset.Now;
        _hasRaisedTimeout = false;
    }

    public void Start()
    {
        MarkActivity();
        _timer.Start();
    }

    public void Stop() => _timer.Stop();

    private void OnTick(object? sender, EventArgs e)
    {
        if (_hasRaisedTimeout || DateTimeOffset.Now - _lastActivity < _idleTimeout)
        {
            return;
        }

        _hasRaisedTimeout = true;
        IdleTimeoutReached?.Invoke(this, EventArgs.Empty);
    }
}
