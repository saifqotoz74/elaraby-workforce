#!/usr/bin/env bash
# ==============================================================================
# Enterprise Multi-Tenant CI/CD Build Engine (Bash)
# ==============================================================================
# Usage:
#   ./scripts/build_flavors.sh [flavor] [target] [mode]
# Examples:
#   ./scripts/build_flavors.sh elsewedy apk release
#   ./scripts/build_flavors.sh all apk release
# ==============================================================================

set -euo pipefail

FLAVOR="${1:-all}"
TARGET="${2:-apk}"
MODE="${3:-release}"

echo "========================================================"
echo "  Enterprise Multi-Tenant CI/CD Build Engine (Bash)"
echo "========================================================"
echo "Target: ${TARGET} | Mode: ${MODE} | Requested Flavor: ${FLAVOR}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
cd "${ROOT_DIR}"

declare -A FLAVOR_MAP=(
    ["generic"]="lib/main.dart"
    ["elaraby"]="lib/main_elaraby.dart"
    ["elsewedy"]="lib/main_elsewedy.dart"
    ["ghabbour"]="lib/main_ghabbour.dart"
    ["tmg"]="lib/main_tmg.dart"
    ["gulf_industrial"]="lib/main_gulf.dart"
)

if [ "${FLAVOR}" == "all" ]; then
    FLAVORS_TO_BUILD=("generic" "elaraby" "elsewedy" "ghabbour" "tmg" "gulf_industrial")
else
    FLAVORS_TO_BUILD=("${FLAVOR}")
fi

OUTPUT_BASE="${ROOT_DIR}/build/outputs/tenants"

for current_flavor in "${FLAVORS_TO_BUILD[@]}"; do
    entry_point="${FLAVOR_MAP[${current_flavor}]}"
    echo ""
    echo ">>> [BUILDING] Flavor: ${current_flavor} | Entry: ${entry_point} <<<"
    
    flutter build "${TARGET}" --flavor "${current_flavor}" -t "${entry_point}" "--${MODE}"

    tenant_out_dir="${OUTPUT_BASE}/${current_flavor}"
    mkdir -p "${tenant_out_dir}"

    if [ "${TARGET}" == "apk" ]; then
        source_dir="${ROOT_DIR}/build/app/outputs/flutter-apk"
        built_apk=$(find "${source_dir}" -name "*${current_flavor}*${MODE}.apk" | head -n 1)
        if [ -n "${built_apk}" ]; then
            dest_file="${tenant_out_dir}/${current_flavor}_${MODE}.apk"
            cp "${built_apk}" "${dest_file}"
            echo "  [OK] Exported: ${dest_file}"
        fi
    elif [ "${TARGET}" == "appbundle" ]; then
        mode_capitalized="$(tr '[:lower:]' '[:upper:]' <<< "${MODE:0:1}")${MODE:1}"
        source_dir="${ROOT_DIR}/build/app/outputs/bundle/${current_flavor}${mode_capitalized}"
        built_aab=$(find "${source_dir}" -name "*.aab" | head -n 1)
        if [ -n "${built_aab}" ]; then
            dest_file="${tenant_out_dir}/${current_flavor}_${MODE}.aab"
            cp "${built_aab}" "${dest_file}"
            echo "  [OK] Exported: ${dest_file}"
        fi
    fi
done

echo ""
echo "========================================================"
echo "  All requested tenant builds completed successfully!"
echo "  Outputs located in: ${OUTPUT_BASE}"
echo "========================================================"
