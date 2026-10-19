$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$target = Join-Path $root "grouped-tools-$version.vsix"
Copy-Item -LiteralPath (Join-Path $root 'grouped-tools-0.0.2.vsix') -Destination $target
$archive = [IO.Compression.ZipFile]::Open($target, 'Update')
try {
    $entry = $archive.GetEntry('extension.vsixmanifest')
    $reader = [IO.StreamReader]::new($entry.Open())
    try { $manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $entry.Delete()
    $writer = [IO.StreamWriter]::new($archive.CreateEntry('extension.vsixmanifest').Open())
    try { $writer.Write($manifest.Replace('Version="0.0.2"', "Version=`"$version`"")) } finally { $writer.Dispose() }
    foreach ($file in @('extension.js', 'package.json', 'README.md', 'media/view.css', 'media/tools.svg', 'media/view.js', 'media/view.html', 'media/icons.js', 'media/lucide-LICENSE.txt')) {
        $old = $archive.GetEntry("extension/$file")
        if ($old) { $old.Delete() }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $root $file), "extension/$file") | Out-Null
    }
} finally { $archive.Dispose() }
Write-Output $target
