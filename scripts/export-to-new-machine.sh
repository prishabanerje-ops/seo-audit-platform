#!/bin/bash
# ============================================================
# export-to-new-machine.sh
# Run this on your OLD laptop.
# It packs the project + Claude Code config into two archives.
# ============================================================

set -e

PROJECT_DIR="/Users/a39326/Documents/Aakash"
EXPORT_DIR="$HOME/Desktop/migration-export"

echo ""
echo "=========================================="
echo "  SEO Audit Platform — Export Script"
echo "=========================================="
echo ""

mkdir -p "$EXPORT_DIR"

# ----------------------------------------------------------
# 1. Project files (excludes node_modules + crawl-data)
# ----------------------------------------------------------
echo "[1/3] Packing project files (excluding node_modules and crawl-data)..."
echo "      This includes: code, .env, database, memory, playwright-crawler"
echo ""

rsync -av --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='backend/crawl-data/' \
  --exclude='backend/crawl-configs/' \
  --exclude='frontend/dist/' \
  --exclude='playwright-crawler/node_modules' \
  --exclude='playwright-crawler/storage' \
  --exclude='playwright-crawler/test-output' \
  --exclude='ads-dashboard/node_modules' \
  "$PROJECT_DIR/" \
  "$EXPORT_DIR/Aakash/"

echo ""
echo "[1/3] Done."

# ----------------------------------------------------------
# 2. Claude Code config (~/.claude)
# ----------------------------------------------------------
echo "[2/3] Packing Claude Code config..."

tar -czf "$EXPORT_DIR/claude-config.tar.gz" \
  -C "$HOME" \
  .claude/settings.json \
  .claude/settings.local.json \
  .claude/mcp.json \
  .claude/skills/ \
  .claude/plugins/ \
  2>/dev/null || true

echo "[2/3] Done."

# ----------------------------------------------------------
# 3. Summary
# ----------------------------------------------------------
echo ""
echo "[3/3] Verifying export..."
echo ""
echo "  Project DB   : $(du -sh "$EXPORT_DIR/Aakash/backend/seo-automation.db" 2>/dev/null | cut -f1 || echo 'MISSING — check!')"
echo "  .env file    : $([ -f "$EXPORT_DIR/Aakash/.env" ] && echo 'present' || echo 'MISSING — check!')"
echo "  memory/      : $(du -sh "$EXPORT_DIR/Aakash/memory" 2>/dev/null | cut -f1 || echo 'MISSING — check!')"
echo "  Claude config: $(du -sh "$EXPORT_DIR/claude-config.tar.gz" 2>/dev/null | cut -f1 || echo 'MISSING — check!')"
echo ""
echo "=========================================="
echo "  Export complete!"
echo "  Files are at: $EXPORT_DIR"
echo ""
echo "  Next steps:"
echo "  1. Copy the '$EXPORT_DIR' folder to your new laptop"
echo "     (AirDrop, USB drive, or external SSD)"
echo "  2. On the new laptop, run: setup-new-machine.sh"
echo "=========================================="
echo ""
