param(
    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath
)

$resolvedExecutable = (Resolve-Path -LiteralPath $ExecutablePath -ErrorAction Stop).Path
if ([IO.Path]::GetExtension($resolvedExecutable) -ne ".exe") {
    throw "Academy.HangulCompanion.exe 경로를 지정하세요."
}

$schemeRoot = "HKCU:\Software\Classes\academy-hangul"
New-Item -Path $schemeRoot -Force | Out-Null
Set-Item -Path $schemeRoot -Value "URL:Academy Hangul Companion"
New-ItemProperty -Path $schemeRoot -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
New-Item -Path "$schemeRoot\shell\open\command" -Force | Out-Null
Set-Item -Path "$schemeRoot\shell\open\command" -Value ('"{0}" "%1"' -f $resolvedExecutable)

Write-Host "academy-hangul 연결 프로그램을 현재 Windows 사용자에 등록했습니다."
