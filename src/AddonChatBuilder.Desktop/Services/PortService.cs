using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace AddonChatBuilder.Desktop.Services;

public sealed class PortService
{
    public int FindAvailablePort(int preferredPort, int maxPort)
    {
        for (var port = preferredPort; port <= maxPort; port++)
        {
            if (IsPortAvailable(port))
            {
                return port;
            }
        }

        throw new InvalidOperationException("No available port was found.");
    }

    public bool IsPortAvailable(int port)
    {
        if (IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners().Any(endpoint => endpoint.Port == port))
        {
            return false;
        }

        try
        {
            using var listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
            return true;
        }
        catch (SocketException)
        {
            return false;
        }
    }
}
