#!/bin/bash
# Destiny Compass - 启动所有服务脚本
# 用法: bash scripts/start-all.sh

set -e

WORKSPACE="/workspace"

# 加载环境变量
if [ -f "$WORKSPACE/.env" ]; then
  export $(grep -v '^#' "$WORKSPACE/.env" | xargs)
fi

echo "=== Starting Destiny Compass Services ==="
echo "LLM_API_KEY configured: $([ -n "$LLM_API_KEY" ] && echo 'yes' || echo 'no')"
echo "LLM_BASE_URL: $LLM_BASE_URL"

# 杀掉已有进程
pkill -f "node.*dist/server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# 启动所有 MCP 服务
echo "[1/9] Starting mcp-bazi (port 3011)..."
nohup node "$WORKSPACE/packages/mcp-bazi/dist/server.js" > /tmp/mcp-bazi.log 2>&1 &

echo "[2/9] Starting mcp-ziwei (port 3012)..."
nohup node "$WORKSPACE/packages/mcp-ziwei/dist/server.js" > /tmp/mcp-ziwei.log 2>&1 &

echo "[3/9] Starting mcp-vedic (port 3013)..."
nohup node "$WORKSPACE/packages/mcp-vedic/dist/server.js" > /tmp/mcp-vedic.log 2>&1 &

echo "[4/9] Starting mcp-western (port 3014)..."
nohup node "$WORKSPACE/packages/mcp-western/dist/server.js" > /tmp/mcp-western.log 2>&1 &

echo "[5/9] Starting mcp-arabic (port 3015)..."
nohup node "$WORKSPACE/packages/mcp-arabic/dist/server.js" > /tmp/mcp-arabic.log 2>&1 &

echo "[6/9] Starting mcp-rag (port 3016)..."
nohup node "$WORKSPACE/packages/mcp-rag/dist/server.js" > /tmp/mcp-rag.log 2>&1 &

echo "[7/9] Starting mcp-search (port 3017)..."
nohup node "$WORKSPACE/packages/mcp-search/dist/server.js" > /tmp/mcp-search.log 2>&1 &

echo "[8/9] Starting mcp-llm (port 3018)..."
nohup node "$WORKSPACE/packages/mcp-llm/dist/server.js" > /tmp/mcp-llm.log 2>&1 &

echo "[9/9] Starting orchestrator (port 3000)..."
nohup node "$WORKSPACE/packages/orchestrator/dist/server.js" > /tmp/orchestrator.log 2>&1 &

echo ""
echo "Waiting 3 seconds for services to start..."
sleep 3

# 健康检查
echo ""
echo "=== Health Check ==="
for port in 3000 3011 3012 3013 3014 3015 3016 3017 3018; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "404" ]; then
    echo "  Port $port: OK (HTTP $code)"
  else
    echo "  Port $port: FAILED (HTTP $code)"
  fi
done

echo ""
echo "=== Starting Frontend (port 5173) ==="
cd "$WORKSPACE/packages/frontend" && nohup ./node_modules/.bin/vite preview --port 5173 --host > /tmp/vite.log 2>&1 &
sleep 2

echo ""
echo "=== All services started ==="
echo "Frontend:      http://localhost:5173"
echo "Orchestrator:  http://localhost:3000"
echo ""
echo "Logs:"
echo "  cat /tmp/orchestrator.log"
echo "  cat /tmp/mcp-bazi.log"
echo "  cat /tmp/mcp-llm.log"
echo "  cat /tmp/vite.log"
