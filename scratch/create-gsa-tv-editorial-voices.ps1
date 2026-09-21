$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$folder = Join-Path $PSScriptRoot 'gsa-tv-editorial'
$voiceFiles = Get-ChildItem -LiteralPath $folder -Filter 'voice-*.txt' | Sort-Object Name
foreach ($voiceFile in $voiceFiles) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.Rate = -1
  $synth.Volume = 100
  $wav = [System.IO.Path]::ChangeExtension($voiceFile.FullName, '.wav')
  $synth.SetOutputToWaveFile($wav)
  $synth.Speak([System.IO.File]::ReadAllText($voiceFile.FullName, [System.Text.Encoding]::UTF8))
  $synth.Dispose()
}
Write-Output "Locuções criadas em $folder"
