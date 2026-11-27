param(
    [switch]$SkipTests,
    [string]$Branch = "master",
    [string]$VpsHost = "root@62.84.178.215",
    [string]$SshKey = "$env:USERPROFILE\.ssh\new_vps"
)

$ErrorActionPreference = "Stop"
$Repo = "gabayim/Zikaron3D"
$WorkflowFile = "ios-ai-test.yml"

function Get-GitHubToken {
    if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN }
    if ($env:GH_TOKEN) { return $env:GH_TOKEN }
    Write-Host "[QA] Reading GITHUB_TOKEN from VPS..." -ForegroundColor Cyan
    $token = ssh -i $SshKey $VpsHost "grep '^GITHUB_TOKEN=' /opt/paperclip-stack/.env | cut -d'=' -f2-"
    if (-not $token) {
        throw "GITHUB_TOKEN not found locally or on VPS."
    }
    return $token.Trim()
}

if (-not $SkipTests) {
    $token = Get-GitHubToken
    $headers = @{
        "Authorization" = "Bearer $token"
        "Accept"        = "application/vnd.github.v3+json"
        "User-Agent"    = "Zikaron3D-QA-Runner"
    }

    Write-Host "[1/3] Triggering iOS AI Test Agent ($WorkflowFile on $Branch)..." -ForegroundColor Cyan
    $dispatchBody = @{
        ref    = $Branch
        inputs = @{ open_defects = "true" }
    } | ConvertTo-Json

    Invoke-RestMethod -Method Post `
        -Uri "https://api.github.com/repos/$Repo/actions/workflows/$WorkflowFile/dispatches" `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $dispatchBody | Out-Null

    Write-Host "[2/3] Waiting for GitHub Actions run to start..." -ForegroundColor Cyan
    Start-Sleep -Seconds 6

    $run = $null
    for ($i = 0; $i -lt 12; $i++) {
        $runsResp = Invoke-RestMethod -Method Get `
            -Uri "https://api.github.com/repos/$Repo/actions/workflows/$WorkflowFile/runs?event=workflow_dispatch&per_page=1" `
            -Headers $headers
        if ($runsResp.workflow_runs.Count -gt 0) {
            $run = $runsResp.workflow_runs[0]
            break
        }
        Start-Sleep -Seconds 5
    }

    if (-not $run) {
        throw "Could not locate triggered workflow run on GitHub Actions."
    }

    Write-Host "      Run #$($run.run_number) started: $($run.html_url)" -ForegroundColor Gray
    while ($run.status -ne "completed") {
        Start-Sleep -Seconds 20
        $run = Invoke-RestMethod -Method Get `
            -Uri "https://api.github.com/repos/$Repo/actions/runs/$($run.id)" `
            -Headers $headers
        Write-Host "      Status: $($run.status)..." -ForegroundColor DarkGray
    }

    Write-Host "      iOS AI Test completed with conclusion: $($run.conclusion)" -ForegroundColor $(if ($run.conclusion -eq "success") { "Green" } else { "Yellow" })
} else {
    Write-Host "[1/3] Skipping iOS AI Test (-SkipTests specified)." -ForegroundColor Yellow
}

Write-Host "[3/3] Running Hermes on-demand defect fixer until all [QA] defects are concluded..." -ForegroundColor Cyan
ssh -i $SshKey $VpsHost "node /opt/paperclip-stack/scripts/zmz_delivery_manager.mjs"
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nAll defects concluded! Both testing and Hermes are now idle/disabled." -ForegroundColor Green
} else {
    Write-Host "`nHermes defect fixer stopped with exit code $exitCode. Check output above." -ForegroundColor Red
    exit $exitCode
}
