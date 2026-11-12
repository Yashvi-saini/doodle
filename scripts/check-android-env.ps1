$ErrorActionPreference = 'Continue'
$script:failures = 0

function Report {
  param([bool]$Ok, [string]$Label, [string]$Hint)
  if ($Ok) {
    Write-Host "[ok]   $Label" -ForegroundColor Green
  } else {
    Write-Host "[fail] $Label" -ForegroundColor Red
    if ($Hint) { Write-Host "       -> $Hint" -ForegroundColor Yellow }
    $script:failures++
  }
}

$javaCommand = Get-Command java -ErrorAction SilentlyContinue
$javaVersion = ''
if ($javaCommand) {
  $javaVersion = (cmd /c 'java -version 2>&1' | Select-Object -First 1)
}
Report ($javaVersion -match '"17\.') "JDK 17 on PATH ($javaVersion)" 'Install Microsoft Build of OpenJDK 17 with "Set JAVA_HOME" and "Add to PATH" ticked, then restart VS Code'

$javaHome = $env:JAVA_HOME
Report ([bool]$javaHome -and (Test-Path "$javaHome")) "JAVA_HOME is set ($javaHome)" 'Re-run the OpenJDK installer and tick "Set JAVA_HOME variable"'

$sdk = $env:ANDROID_HOME
$sdkOk = [bool]$sdk -and (Test-Path "$sdk")
Report $sdkOk "ANDROID_HOME is set ($sdk)" 'Add user variable ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk, then restart VS Code'

if ($sdkOk) {
  Report (Test-Path "$sdk\platforms\android-35") 'Android SDK Platform 35 installed' 'Android Studio > SDK Manager > SDK Platforms > Android 15 > Android SDK Platform 35'
  Report (Test-Path "$sdk\build-tools\36.0.0") 'Android SDK Build-Tools 36.0.0 installed' 'SDK Manager > SDK Tools > Show Package Details > Build-Tools 36.0.0'
  Report (Test-Path "$sdk\cmdline-tools\latest") 'Android SDK Command-line Tools installed' 'SDK Manager > SDK Tools > Android SDK Command-line Tools (latest)'
}

$adb = Get-Command adb -ErrorAction SilentlyContinue
Report ([bool]$adb) 'adb is on PATH' 'Add %LOCALAPPDATA%\Android\Sdk\platform-tools to your user Path, then restart VS Code'

$fileSystem = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -ErrorAction SilentlyContinue
Report ($fileSystem.LongPathsEnabled -eq 1) 'Windows long paths are enabled' 'In an Administrator PowerShell: New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Report (-not ($root -match ' ')) "Project path has no spaces ($root)" 'Map a drive letter to the parent folder (see README "Running the mobile app") and work from there'

if ($adb) {
  $devices = & adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
  Report ([bool]$devices) 'A phone or emulator is connected' 'Plug in your phone with USB debugging on, or start an emulator from Android Studio > Device Manager'
}

Write-Host ''
if ($script:failures -gt 0) {
  Write-Host "$($script:failures) check(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host 'Android environment looks ready.' -ForegroundColor Green
