#!/usr/bin/env bash
set -e

echo "──────────────────────────────────────────"
echo "  SEO Audit Platform — Setup"
echo "──────────────────────────────────────────"

# 1. Check Node.js version
NODE_MAJOR=$(node -e "process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)" 2>&1; echo $?)
if [ "$NODE_MAJOR" = "1" ]; then
  echo "✗ Node.js 20+ required. Current: $(node --version)"
  exit 1
fi
echo "✓ Node.js $(node --version)"

# 2. Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# 3. Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# 4. Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# 5. Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  .env created from .env.example"

  JWT_SECRET=$(openssl rand -hex 64)
  ENCRYPTION_KEY=$(openssl rand -hex 32)

  # macOS-compatible sed
  sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
  sed -i '' "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env

  echo "✓ JWT_SECRET and ENCRYPTION_KEY auto-generated"
else
  echo "✓ .env already exists"
fi

# 6. Detect Screaming Frog
SF_PATH=""
if [ -f "/usr/local/bin/screaming-frog" ]; then
  SF_PATH="/usr/local/bin/screaming-frog"
elif [ -f "/Applications/Screaming Frog SEO Spider.app/Contents/MacOS/ScreamingFrogSEOSpider" ]; then
  SF_PATH="/Applications/Screaming Frog SEO Spider.app/Contents/MacOS/ScreamingFrogSEOSpider"
fi

if [ -n "$SF_PATH" ]; then
  sed -i '' "s|^SF_BINARY_PATH=.*|SF_BINARY_PATH=$SF_PATH|" .env
  echo "✓ Screaming Frog found: $SF_PATH"
else
  echo "⚠️  Screaming Frog not found. Platform will run in import-only mode."
  echo "    Download: https://www.screamingfrog.co.uk/seo-spider/"
fi

# 7. Download JetBrains Mono fonts
FONTS_DIR="frontend/public/fonts"
if [ ! -f "$FONTS_DIR/JetBrainsMono-Regular.woff2" ]; then
  echo "🔤 Downloading JetBrains Mono fonts..."
  mkdir -p "$FONTS_DIR"
  BASE="https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/webfonts"
  curl -sL "$BASE/JetBrainsMono-Regular.woff2"    -o "$FONTS_DIR/JetBrainsMono-Regular.woff2"
  curl -sL "$BASE/JetBrainsMono-Medium.woff2"     -o "$FONTS_DIR/JetBrainsMono-Medium.woff2"
  echo "✓ Fonts downloaded"
else
  echo "✓ Fonts already present"
fi

# 8. Run migrations
echo "🗄️  Running database migrations..."
NODE_ENV=development node backend/db/sqlite.js
echo "✓ Database ready"

# 9. Seed audit checks
echo "🌱 Seeding audit checks..."
node scripts/seed-checks.js
echo "✓ Audit checks seeded"

# 10. Validate env
echo "🔍 Validating environment..."
node backend/validate-env.js || true

echo ""
echo "──────────────────────────────────────────"
echo "  ✓ Setup complete!"
echo "  Run: npm run dev"
echo "  Open: http://localhost:5173/setup"
echo "──────────────────────────────────────────"
