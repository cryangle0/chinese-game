Add-Type -AssemblyName System.Drawing

$readingRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workspaceRoot = Split-Path $readingRoot -Parent
$readingSource = (Get-ChildItem -Recurse -File $workspaceRoot |
  Where-Object { $_.Length -eq 472173 } |
  Select-Object -First 1 -ExpandProperty FullName)
$readingTarget = Join-Path $readingRoot 'assets\resources\themes\reading\intro\title.png'
$guideTarget = Join-Path $readingRoot 'assets\resources\themes\reading\intro\guide.png'
$writingTarget = Join-Path $workspaceRoot 'writing-treasure-game\assets\resources\themes\writing\intro\title.png'

function Save-JumperTitle {
  $source = [System.Drawing.Bitmap]::FromFile($readingSource)
  try {
    $crop = $source.Clone(
      [System.Drawing.Rectangle]::new(570, 0, 755, 275),
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
      $canvas = [System.Drawing.Bitmap]::new(805, 275, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $graphics = [System.Drawing.Graphics]::FromImage($canvas)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.DrawImageUnscaled($crop, 25, 0)
        $canvas.Save($readingTarget, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $graphics.Dispose()
        $canvas.Dispose()
      }
    } finally {
      $crop.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function Add-OutlinedText($graphics, $text, $origin, $size, $fillTop, $fillBottom) {
  $family = [System.Drawing.FontFamily]::new('Microsoft YaHei')
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  try {
    $path.AddString(
      $text,
      $family,
      [int][System.Drawing.FontStyle]::Bold,
      $size,
      $origin,
      [System.Drawing.StringFormat]::GenericDefault
    )
    $shadow = $path.Clone()
    try {
      $matrix = [System.Drawing.Drawing2D.Matrix]::new()
      $matrix.Translate(10, 16)
      $shadow.Transform($matrix)
      $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 55, 28, 8)), $shadow)
      $matrix.Dispose()
    } finally {
      $shadow.Dispose()
    }
    $outer = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 91, 43, 12), 34)
    $middle = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 242, 133, 12), 22)
    try {
      $outer.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $middle.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $graphics.DrawPath($outer, $path)
      $graphics.DrawPath($middle, $path)
      $bounds = $path.GetBounds()
      $fill = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $bounds,
        $fillTop,
        $fillBottom,
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
      )
      try {
        $graphics.FillPath($fill, $path)
      } finally {
        $fill.Dispose()
      }
      $highlight = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(145, 255, 255, 210), 4)
      try {
        $highlight.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $graphics.DrawPath($highlight, $path)
      } finally {
        $highlight.Dispose()
      }
    } finally {
      $outer.Dispose()
      $middle.Dispose()
    }
  } finally {
    $path.Dispose()
    $family.Dispose()
  }
}

function Save-TreasureTitle {
  $canvas = [System.Drawing.Bitmap]::new(900, 350, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $dig = [string][char]0x6316
    $treasure = [string][char]0x5B9D
    Add-OutlinedText $graphics $dig ([System.Drawing.PointF]::new(65, 18)) 260 `
      ([System.Drawing.Color]::FromArgb(255, 255, 238, 84)) `
      ([System.Drawing.Color]::FromArgb(255, 255, 174, 13))
    Add-OutlinedText $graphics $treasure ([System.Drawing.PointF]::new(445, 18)) 260 `
      ([System.Drawing.Color]::FromArgb(255, 222, 246, 69)) `
      ([System.Drawing.Color]::FromArgb(255, 96, 190, 47))
    $canvas.Save($writingTarget, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

function Save-JumperGuide {
  $canvas = [System.Drawing.Bitmap]::new(850, 88, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $font = [System.Drawing.Font]::new('Microsoft YaHei', 42, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = [System.Drawing.RectangleF]::new(0, 0, 850, 88)
    $guide = @(0x5DE6,0x53F3,0x79FB,0x52A8,0x9009,0x7816,0x5757,0xFF0C,
      0x8DF3,0x8D77,0x4F5C,0x7B54,0xFF01) | ForEach-Object { [char]$_ }
    $guide = $guide -join ''
    $graphics.DrawString($guide, $font, [System.Drawing.Brushes]::Black, [System.Drawing.RectangleF]::new(3, 4, 850, 88), $format)
    $graphics.DrawString($guide, $font, [System.Drawing.Brushes]::White, $rect, $format)
    $canvas.Save($guideTarget, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $format.Dispose()
    $font.Dispose()
    $graphics.Dispose()
    $canvas.Dispose()
  }
}

Save-JumperTitle
Save-TreasureTitle
Save-JumperGuide
Write-Host 'Product title and guide assets updated.'
