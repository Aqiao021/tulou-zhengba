# Windows SEA rebuild. Node.js and npm are needed only on the build machine.
$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe).Source
$npx = (Get-Command npx.cmd).Source
$temp = Join-Path ([IO.Path]::GetTempPath()) ('tulou-sea-' + [guid]::NewGuid().ToString('N'))
$destination = Join-Path $PSScriptRoot '土楼争霸局域网服务器.exe'
New-Item -Path $temp -ItemType Directory | Out-Null

Push-Location -LiteralPath $temp
try {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server.js') -Destination 'server.js'
  '{"main":"server.js","output":"server.blob","disableExperimentalSEAWarning":true,"execArgvExtension":"none"}' |
    Set-Content -LiteralPath 'sea-config.json' -Encoding Ascii
  & $node --experimental-sea-config sea-config.json
  if ($LASTEXITCODE -ne 0) { throw 'Creating the Node SEA blob failed.' }
  Copy-Item -LiteralPath $node -Destination 'tulou-server.exe'
  $signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($signTool) { & $signTool.Source remove /s tulou-server.exe }
  & $npx --yes postject@1.0.0-alpha.6 tulou-server.exe NODE_SEA_BLOB server.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
  if ($LASTEXITCODE -ne 0) { throw 'Injecting the Node SEA blob failed.' }
  Copy-Item -LiteralPath 'tulou-server.exe' -Destination $destination -Force
  Write-Output $destination
} finally {
  Pop-Location
  foreach ($name in 'server.js', 'sea-config.json', 'server.blob', 'tulou-server.exe') {
    $file = Join-Path $temp $name
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
  Remove-Item -LiteralPath $temp
}
