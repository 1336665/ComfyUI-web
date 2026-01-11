#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf "\n[%s] %s\n" "$(date +"%H:%M:%S")" "$1"
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 未安装，请先安装 Node.js 18+。"
  exit 1
fi

log "进入项目目录: ${ROOT_DIR}"
cd "${ROOT_DIR}"

log "配置 ComfyUI 地址"
read -r -p "请输入 ComfyUI 地址 (默认 http://127.0.0.1:8188): " comfy_url
comfy_url=${comfy_url:-http://127.0.0.1:8188}

log "配置 Web 服务端口"
read -r -p "请输入 Web 服务端口 (默认 3000): " web_port
web_port=${web_port:-3000}

workflow_file="${WORKFLOW_FILE:-${ROOT_DIR}/Aaalice的工作流_一键包_v12.2_正式版.cpack (1).json}"

log "安装依赖"
if command -v npm >/dev/null 2>&1; then
  npm install
else
  echo "未找到 npm，请安装 Node.js (包含 npm)。"
  exit 1
fi

log "启动服务"
export COMFYUI_BASE_URL="${comfy_url}"
export PORT="${web_port}"
export WORKFLOW_FILE="${workflow_file}"

node server.js
