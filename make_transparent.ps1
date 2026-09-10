Add-Type -AssemblyName System.Drawing
$inputPath = "d:\V-DOCKX\frontend\public\robot-mascot.png"
$outputPath = "d:\V-DOCKX\frontend\public\robot-mascot-transparent.png"

$bmp = [System.Drawing.Bitmap]::FromFile($inputPath)
$newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240) {
            $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($c.R -gt 215 -and $c.G -gt 215 -and $c.B -gt 215) {
            $brightness = ($c.R + $c.G + $c.B) / 3.0
            $alpha = [int]([Math]::Max(0, [Math]::Min(255, (240.0 - $brightness) * 10.2)))
            $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
        } else {
            $newBmp.SetPixel($x, $y, $c)
        }
    }
}

$bmp.Dispose()
$newBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$newBmp.Dispose()
Write-Output "Transparent robot image generated successfully!"
