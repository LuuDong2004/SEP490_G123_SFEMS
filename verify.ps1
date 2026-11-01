# Kiểm tra trước khi commit: frontend (tsc, eslint, luật tầng) rồi backend (biên dịch).
# Chạy ở thư mục gốc:  .\verify.ps1
# Dừng ngay ở bước đầu tiên đỏ; mã thoát khác 0 khi có lỗi.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot

function Step($name, $dir, [scriptblock]$cmd) {
    Write-Host ""
    Write-Host "== $name" -ForegroundColor Cyan
    Push-Location (Join-Path $root $dir)
    try {
        & $cmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "XX $name that bai" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } finally {
        Pop-Location
    }
}

Step "Frontend: kiem kieu (tsc)"        "frontend" { npx tsc --noEmit }
Step "Frontend: lint (eslint)"           "frontend" { npx eslint . --quiet }
Step "Frontend: luat tang (verify:arch)" "frontend" { npm run --silent verify:arch }
Step "Backend: bien dich (gradle)"       "backend"  { .\gradlew.bat compileJava --quiet --console=plain }

Write-Host ""
Write-Host "OK: tat ca buoc kiem tra deu sach." -ForegroundColor Green
