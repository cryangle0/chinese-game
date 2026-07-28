param(
  [ValidateSet('reading', 'writing')]
  [string]$Game = 'reading'
)

Add-Type -AssemblyName System.Drawing
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$random = [Random]::new(20260712)

function Save-Jpeg($bitmap, $path) {
  New-Item -ItemType Directory -Path (Split-Path $path) -Force | Out-Null
  $encoder = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object MimeType -eq 'image/jpeg'
  $parameters = [Drawing.Imaging.EncoderParameters]::new(1)
  $parameters.Param[0] = [Drawing.Imaging.EncoderParameter]::new(
    [Drawing.Imaging.Encoder]::Quality,
    84L
  )
  $bitmap.Save($path, $encoder, $parameters)
  $parameters.Dispose()
}

function Draw-Stars($graphics) {
  for ($index = 0; $index -lt 90; $index += 1) {
    $size = $random.Next(2, 8)
    $brush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(
      $random.Next(130, 240), 255, 245, 180
    ))
    $graphics.FillEllipse($brush, $random.Next(0, 1440), $random.Next(0, 650), $size, $size)
    $brush.Dispose()
  }
  $graphics.FillEllipse([Drawing.Brushes]::Coral, 1060, 110, 150, 150)
  $graphics.FillEllipse([Drawing.Brushes]::LightSkyBlue, 116, 170, 95, 95)
}

function Draw-Food($graphics) {
  $graphics.FillEllipse([Drawing.Brushes]::Tomato, 70, 540, 170, 170)
  $graphics.FillEllipse([Drawing.Brushes]::Gold, 1180, 500, 190, 190)
  $graphics.FillEllipse([Drawing.Brushes]::YellowGreen, 250, 640, 210, 130)
  $graphics.FillEllipse([Drawing.Brushes]::MediumPurple, 980, 650, 180, 110)
}

function Draw-Poetry($graphics) {
  $mountain = [Drawing.Point[]]@(
    [Drawing.Point]::new(0, 650), [Drawing.Point]::new(240, 330),
    [Drawing.Point]::new(470, 650), [Drawing.Point]::new(720, 260),
    [Drawing.Point]::new(1020, 650), [Drawing.Point]::new(1240, 390),
    [Drawing.Point]::new(1440, 650), [Drawing.Point]::new(1440, 810),
    [Drawing.Point]::new(0, 810)
  )
  $brush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(110, 34, 94, 72))
  $graphics.FillPolygon($brush, $mountain)
  $brush.Dispose()
  $graphics.FillEllipse([Drawing.Brushes]::LightGoldenrodYellow, 1100, 90, 120, 120)
}

function Draw-Desert($graphics) {
  $sand = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(155, 230, 174, 72))
  $graphics.FillEllipse($sand, -180, 520, 1000, 430)
  $graphics.FillEllipse($sand, 520, 500, 1100, 450)
  $sand.Dispose()
}

function Draw-Dinosaur($graphics) {
  $green = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(130, 38, 133, 83))
  $graphics.FillEllipse($green, -100, 590, 720, 330)
  $graphics.FillEllipse($green, 780, 570, 760, 350)
  $green.Dispose()
  $graphics.FillEllipse([Drawing.Brushes]::Wheat, 1060, 610, 90, 125)
  $graphics.FillEllipse([Drawing.Brushes]::Bisque, 1180, 625, 82, 115)
}

function Draw-Dunhuang($graphics) {
  $ochre = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(110, 184, 100, 44))
  $graphics.FillRectangle($ochre, 0, 0, 1440, 810)
  $ochre.Dispose()
  $pen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(210, 44, 151, 148), 28)
  $graphics.DrawArc($pen, 80, 80, 600, 500, 205, 180)
  $graphics.DrawArc($pen, 760, 120, 570, 480, 150, 190)
  $pen.Dispose()
  $graphics.FillEllipse([Drawing.Brushes]::Goldenrod, 650, 610, 140, 85)
}

function Create-Scene($source, $scene, $tint, $decorator) {
  $image = [Drawing.Image]::FromFile($source)
  $bitmap = [Drawing.Bitmap]::new(1440, 810)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($image, 0, 0, 1440, 810)
  $graphics.FillRectangle([Drawing.SolidBrush]::new($tint), 0, 0, 1440, 810)
  & $decorator $graphics
  $output = Join-Path $root "assets\resources\themes\$Game\$scene\background.jpg"
  Save-Jpeg $bitmap $output
  $graphics.Dispose()
  $bitmap.Dispose()
  $image.Dispose()
}

if ($Game -eq 'reading') {
  $source = Join-Path $root 'assets\resources\themes\reading\deep-sea\background.jpg'
  Create-Scene $source 'space' ([Drawing.Color]::FromArgb(150, 13, 21, 74)) ${function:Draw-Stars}
  Create-Scene $source 'food' ([Drawing.Color]::FromArgb(75, 255, 188, 72)) ${function:Draw-Food}
  Create-Scene $source 'poetry' ([Drawing.Color]::FromArgb(110, 76, 127, 91)) ${function:Draw-Poetry}
} else {
  $source = Join-Path $root 'assets\resources\themes\writing\magic\background.jpg'
  Create-Scene $source 'desert' ([Drawing.Color]::FromArgb(105, 224, 151, 55)) ${function:Draw-Desert}
  Create-Scene $source 'dinosaur' ([Drawing.Color]::FromArgb(105, 38, 137, 82)) ${function:Draw-Dinosaur}
  Create-Scene $source 'dunhuang' ([Drawing.Color]::FromArgb(70, 182, 84, 56)) ${function:Draw-Dunhuang}
}
