Add-Type -AssemblyName System.Drawing
$srcPath = 'C:/Users/dhanu/.gemini/antigravity/brain/3722b3ff-1958-4ebb-a105-19f2ae5ccfb6/.user_uploaded/media_1795626225334_62a74f90.jpg'
$pubDir = 'c:/Users/dhanu/Desktop/Velan AI - GPS Attendance System/client/public'
$img = [System.Drawing.Image]::FromFile($srcPath)

# Crop inward by ~8.5% on each edge to completely remove the outer black background
$cropMarginX = [int]($img.Width * 0.085)
$cropMarginY = [int]($img.Height * 0.085)
$srcRect = New-Object System.Drawing.Rectangle(
  $cropMarginX,
  $cropMarginY,
  ($img.Width - 2 * $cropMarginX),
  ($img.Height - 2 * $cropMarginY)
)

$targets = @(
  @{ name = 'logo.png'; size = 512 },
  @{ name = 'icon-512.png'; size = 512 },
  @{ name = 'icon-192.png'; size = 192 }
)

foreach ($item in $targets) {
  $s = $item.size
  $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  # Smooth rounded-square clip path
  $r = [int]($s * 0.20)
  $d = $r * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($s - $d, 0, $d, $d, 270, 90)
  $path.AddArc($s - $d, $s - $d, $d, $d, 0, 90)
  $path.AddArc(0, $s - $d, $d, $d, 90, 90)
  $path.CloseFigure()

  $g.SetClip($path)
  $destRect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)
  $g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

  $outPath = Join-Path $pubDir $item.name
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $path.Dispose()
  $g.Dispose()
  $bmp.Dispose()
  Write-Host ("Saved clean smooth " + $outPath + " (" + (Get-Item $outPath).Length + " bytes)")
}
$img.Dispose()
