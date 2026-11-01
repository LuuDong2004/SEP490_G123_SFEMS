#!/usr/bin/env bash
# Kiểm tra trước khi commit: frontend (tsc, eslint, luật tầng) rồi backend (biên dịch).
# Chạy ở thư mục gốc:  ./verify.sh
# Dừng ngay ở bước đầu tiên đỏ; mã thoát khác 0 khi có lỗi.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step() {
  local name="$1" dir="$2"; shift 2
  echo
  echo "== $name"
  (cd "$root/$dir" && "$@") || { echo "XX $name thất bại"; exit 1; }
}

step "Frontend: kiểm kiểu (tsc)"        frontend npx tsc --noEmit
step "Frontend: lint (eslint)"           frontend npx eslint . --quiet
step "Frontend: luật tầng (verify:arch)" frontend npm run --silent verify:arch
if [[ "${OS:-}" == "Windows_NT" ]]; then
  step "Backend: biên dịch (gradle)"     backend ./gradlew.bat compileJava --quiet --console=plain
else
  step "Backend: biên dịch (gradle)"     backend ./gradlew compileJava --quiet --console=plain
fi

echo
echo "OK: tất cả bước kiểm tra đều sạch."
