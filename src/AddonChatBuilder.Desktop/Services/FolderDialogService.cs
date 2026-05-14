using System.IO;
using System.Windows.Forms;

namespace AddonChatBuilder.Desktop.Services;

public sealed class FolderDialogService
{
    public string? SelectFolder(string? currentPath)
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "出力先フォルダを選択してください",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = true,
            SelectedPath = Directory.Exists(currentPath) ? currentPath : string.Empty
        };

        return dialog.ShowDialog() == DialogResult.OK ? dialog.SelectedPath : null;
    }
}
