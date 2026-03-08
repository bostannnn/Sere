#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but not found in PATH." >&2
  exit 1
fi

failures=()
warnings=()
loc_warning_title=""
loc_warning_top_files=()

run_step() {
  local label="$1"
  shift

  echo
  echo "[run-all-tests] ${label}"
  echo "[run-all-tests] $ $*"

  "$@"
  local status=$?
  if [ "${status}" -eq 0 ]; then
    return 0
  fi

  failures+=("${label}: exit code ${status}")
  echo "[run-all-tests] FAIL in ${label}: exit code ${status}" >&2
  return 0
}

run_step_loc_check() {
  local label="$1"
  shift

  echo
  echo "[run-all-tests] ${label}"
  echo "[run-all-tests] $ $*"

  local log_file
  log_file="$(mktemp)"

  "$@" 2>&1 | tee "${log_file}"
  local status=${PIPESTATUS[0]}

  if grep -Fq "[loc-check] WARNING:" "${log_file}"; then
    local loc_warning
    loc_warning="$(grep -F "[loc-check] WARNING:" "${log_file}" | head -n 1)"
    loc_warning_title="${label}: ${loc_warning}"
    warnings+=("${loc_warning_title}")

    loc_warning_top_files=()
    while IFS= read -r line; do
      loc_warning_top_files+=("${line}")
    done < <(
      awk '
        /\[loc-check\] WARNING:/ {capture=1; next}
        capture && /^  - / {print; count++; if (count == 10) exit}
        capture && count > 0 && !/^  - / {exit}
      ' "${log_file}"
    )
  fi

  rm -f "${log_file}"

  if [ "${status}" -ne 0 ]; then
    failures+=("${label}: exit code ${status}")
    echo "[run-all-tests] FAIL in ${label}: exit code ${status}" >&2
  fi

  return 0
}

run_step "Typecheck" pnpm run check
run_step "Lint" pnpm run lint
run_step "Server checks" pnpm run check:server
run_step "Server contracts" pnpm run check:server:contracts
run_step "Settings contract" pnpm run check:settings-contract
run_step "Settings shell" pnpm run check:settings-shell
run_step "Settings smoke" pnpm run check:settings-smoke
run_step "UI shell contract" pnpm run check:ui-shell-contract
run_step "UI shell smoke" pnpm run check:ui-shell-smoke
run_step_loc_check "LOC check" pnpm run check:loc
run_step "Core tests" pnpm run test:all:core "$@"

if [ "${#warnings[@]}" -gt 0 ]; then
  echo
  echo "[run-all-tests] Summary of warnings:"
  for warning in "${warnings[@]}"; do
    echo "  - ${warning}"
  done
  if [ "${#loc_warning_top_files[@]}" -gt 0 ]; then
    echo "  - LOC top 10 files:"
    for loc_file in "${loc_warning_top_files[@]}"; do
      echo "    ${loc_file}"
    done
  fi
fi

if [ "${#failures[@]}" -gt 0 ]; then
  echo
  echo "[run-all-tests] Summary of failed stages:"
  for failure in "${failures[@]}"; do
    echo "  - ${failure}" >&2
  done
  exit 1
fi

echo
echo "[run-all-tests] PASS: all configured suites completed successfully."
