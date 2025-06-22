#!/bin/bash
set -e

echo "🚀 Starting Supabase project setup..."

# Optional: Load .env file if present
if [ -f ".env" ]; then
  echo "🔄 Loading .env file..."
  set -o allexport
  source .env
  set +o allexport
fi

# Validate required variables
: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF (your project ID)}"
: "${VITE_SUPABASE_DB_PASSWORD:?Set VITE_SUPABASE_DB_PASSWORD (your DB password)}"

# Create config.toml
echo "🛠️  Creating .supabase/config.toml..."
mkdir -p .supabase
cat <<EOF > .supabase/config.toml
[project]
ref = "${SUPABASE_PROJECT_REF}"
EOF

# Construct DB URL
export SUPABASE_DB_URL="postgresql://postgres:${VITE_SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"

# Push DB migrations
echo "📦 Pushing DB migrations..."
supabase db push --db-url "$SUPABASE_DB_URL"

# Deploy Edge Functions
echo "⚙️  Deploying functions..."
if [ -d "supabase/functions" ]; then
  for func in supabase/functions/*; do
    if [ -d "$func" ]; then
      func_name=$(basename "$func")
      echo "🚀 Deploying function: $func_name"
      supabase functions deploy "$func_name" --project-ref "$SUPABASE_PROJECT_REF"
    fi
  done
else
  echo "⚠️  No functions directory found at supabase/functions/"
fi

echo "✅ Supabase initialization complete!"
