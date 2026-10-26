param([string]$ExpectedSha)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$campaign='shellshock-human-voice-20261025'
$root=Join-Path $env:TEMP ('ritsu-campaign-'+$campaign)
if(Test-Path $root){throw "Existing campaign workspace; refuse overwrite: $root"}
$zipName='shellshock-human-asr-benchmark.zip'
$candidates=@('G:\My Drive\ShellShock-Human-ASR-Campaign-20261025\'+$zipName,'G:\ShellShock-Human-ASR-Campaign-20261025\'+$zipName)
$archive=$candidates|Where-Object{Test-Path $_}|Select-Object -First 1
if(-not $archive){throw ('Drive ZIP not found at: '+($candidates -join ' | '))}
$actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
if($actual -ne '571c9a1195e0296715654f1f3a1a19785a0e52ab59cbb3e1f1d7ded6146090c1'){throw 'Drive ZIP SHA mismatch'}
git clone --quiet --branch campaign/human-voice-fixtures-20261025 --single-branch https://github.com/Valar05/shell-shock-chasing-tail.git $root
if($LASTEXITCODE -ne 0){throw 'git clone failed'}
Push-Location $root
try{
 $head=(git rev-parse HEAD).Trim()
 if($head -ne $ExpectedSha){throw "Pinned HEAD mismatch; got $head"}
 python campaigns/import_human_asr_voice.py --archive $archive --commit
 if($LASTEXITCODE -ne 0){throw "Import/commit/push failed with exit $LASTEXITCODE"}
 git status --porcelain
 if($LASTEXITCODE -ne 0){throw 'Git status failed'}
 git rev-parse HEAD
}finally{Pop-Location}
