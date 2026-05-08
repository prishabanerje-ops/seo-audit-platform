#!/bin/bash
# ============================================================
# setup-new-machine.sh
# Run this on your NEW laptop AFTER copying the migration-export
# folder from the old machine.
#
# Usage:
#   bash setup-new-machine.sh /path/to/migration-export
#
# Example:
#   bash setup-new-machine.sh ~/Desktop/migration-export
# ============================================================

set -e

EXPORT_DIR="${1:-$HOME/Desktop/migration-export}"
PROJECT_DEST="$HOME/Documents/Aakash"

echo ""
echo "=========================================="
echo "  SEO Audit Platform — New Machine Setup"
echo "=========================================="
echo ""

# ----------------------------------------------------------
# Validate export folder exists
# ----------------------------------------------------------
if [ ! -d "$EXPORT_DIR" ]; then
  echo "ERROR: Export folder not found at: $EXPORT_DIR"
  echo "Usage: bash setup-new-machine.sh /path/to/migration-export"
  exit 1
fi

# ----------------------------------------------------------
# 1. Install nvm + Node.js 25
# ----------------------------------------------------------
echo "[1/7] Installing nvm and Node.js 25..."

if ! command -v nvm &>/dev/null && [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
else
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  echo "  nvm already installed — skipping."
fi

nvm install 25
nvm use 25
nvm alias default 25

echo "[1/7] Node $(node --version) ready."

# ----------------------------------------------------------
# 2. Copy project files
# ----------------------------------------------------------
echo ""
echo "[2/7] Copying project files to $PROJECT_DEST..."

mkdir -p "$PROJECT_DEST"
rsync -av --progress "$EXPORT_DIR/Aakash/" "$PROJECT_DEST/"

echo "[2/7] Done."

# ----------------------------------------------------------
# 3. Verify critical files
# ----------------------------------------------------------
echo ""
echo "[3/7] Verifying critical files..."

ERRORS=0

if [ ! -f "$PROJECT_DEST/backend/seo-automation.db" ]; then
  echo "  ERROR: seo-automation.db is missing!"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: seo-automation.db ($(du -sh "$PROJECT_DEST/backend/seo-automation.db" | cut -f1))"
fi

if [ ! -f "$PROJECT_DEST/.env" ]; then
  echo "  ERROR: .env file is missing!"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: .env present"
fi

if [ ! -d "$PROJECT_DEST/memory" ]; then
  echo "  WARNING: memory/ folder is missing"
else
  echo "  OK: memory/ present"
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "  Stopping — fix the missing files above before continuing."
  exit 1
fi

# ----------------------------------------------------------
# 4. Install npm dependencies
# ----------------------------------------------------------
echo ""
echo "[4/7] Installing npm dependencies..."

cd "$PROJECT_DEST"
npm install

cd "$PROJECT_DEST/backend"
npm install

cd "$PROJECT_DEST/frontend"
npm install

if [ -d "$PROJECT_DEST/playwright-crawler" ]; then
  cd "$PROJECT_DEST/playwright-crawler"
  npm install
fi

if [ -d "$PROJECT_DEST/ads-dashboard" ]; then
  cd "$PROJECT_DEST/ads-dashboard"
  npm install
fi

echo "[4/7] Done."

# ----------------------------------------------------------
# 5. Install Playwright browsers
# ----------------------------------------------------------
echo ""
echo "[5/7] Installing Playwright Chromium browser..."

cd "$PROJECT_DEST/playwright-crawler"
npx playwright install chromium

echo "[5/7] Done."

# ----------------------------------------------------------
# 6. Install Claude Code + restore config
# ----------------------------------------------------------
echo ""
echo "[6/7] Installing Claude Code..."

npm install -g @anthropic-ai/claude-code

echo "  Restoring Claude Code config..."

CLAUDE_ARCHIVE="$EXPORT_DIR/claude-config.tar.gz"
if [ -f "$CLAUDE_ARCHIVE" ]; then
  tar -xzf "$CLAUDE_ARCHIVE" -C "$HOME"
  echo "  Claude config restored."
else
  echo "  WARNING: claude-config.tar.gz not found — Claude config not restored."
  echo "  You may need to re-authenticate Claude Code manually."
fi

# ----------------------------------------------------------
# 7. Smoke test
# ----------------------------------------------------------
echo ""
echo "[7/7] Smoke test..."

cd "$PROJECT_DEST"

# Check DB is readable
node -e "
const Database = require('better-sqlite3');
const db = new Database('backend/seo-automation.db');
const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
console.log('  DB check: ' + users.count + ' user(s) found');
db.close();
" 2>/dev/null || echo "  WARNING: Could not read DB — run 'npm run dev' and check manually."

echo ""
echo "=========================================="
echo "  Setup complete!"
echo ""
echo "  Start the app:"
echo "    cd $PROJECT_DEST"
echo "    npm run dev"
echo ""
echo "  Then open:"
echo "    http://localhost:5173  — Frontend"
echo "    http://localhost:3001/health  — Backend health check"
echo ""
echo "  Login with: aakash.srivastava@cars24.com"
echo "=========================================="
echo ""
