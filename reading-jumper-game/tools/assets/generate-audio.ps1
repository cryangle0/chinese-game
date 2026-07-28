Add-Type -AssemblyName System
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$output = Join-Path $root 'static\audio'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$sampleRate = 22050

function Write-Tone($name, $frequencies, $duration, $volume) {
  $samples = [int]($sampleRate * $duration)
  $stream = [IO.File]::Create((Join-Path $output "$name.wav"))
  $writer = [IO.BinaryWriter]::new($stream)
  $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
  $writer.Write(36 + $samples * 2)
  $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
  $writer.Write(16); $writer.Write([int16]1); $writer.Write([int16]1)
  $writer.Write($sampleRate); $writer.Write($sampleRate * 2)
  $writer.Write([int16]2); $writer.Write([int16]16)
  $writer.Write([Text.Encoding]::ASCII.GetBytes('data')); $writer.Write($samples * 2)
  for ($index = 0; $index -lt $samples; $index += 1) {
    $time = $index / $sampleRate
    $progress = $index / [Math]::Max(1, $samples - 1)
    $note = [Math]::Min($frequencies.Count - 1, [int]($progress * $frequencies.Count))
    $envelope = [Math]::Sin([Math]::PI * $progress)
    $sample = [Math]::Sin(2 * [Math]::PI * $frequencies[$note] * $time)
    $writer.Write([int16]($sample * $envelope * $volume * 32767))
  }
  $writer.Dispose()
}

Write-Tone 'correct' @(659, 784, 988) 0.28 0.34
Write-Tone 'wrong' @(247, 196) 0.30 0.28
Write-Tone 'unlock' @(392, 523, 659) 0.24 0.30
Write-Tone 'strike' @(130, 98) 0.12 0.36
Write-Tone 'button' @(523, 659) 0.12 0.24
Write-Tone 'bgm' @(262, 330, 392, 330, 294, 349, 440, 349) 4.0 0.11
$ffmpeg = if (Test-Path 'D:\ffmpeg\bin\ffmpeg.exe') {
  'D:\ffmpeg\bin\ffmpeg.exe'
} else {
  (Get-Command ffmpeg -ErrorAction Stop).Source
}
& $ffmpeg -hide_banner -loglevel error -y -i (Join-Path $output 'bgm.wav') `
  -codec:a libmp3lame -b:a 64k (Join-Path $output 'bgm.mp3')
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed with exit code $LASTEXITCODE" }
Get-ChildItem $output -Filter '*.wav' | Remove-Item -Force
Write-Output "Generated optimized audio assets in $output"
