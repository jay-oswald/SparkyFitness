#!/bin/bash
set -e

echo "🚀 Starting Supabase project setup..."

# Load env vars from private or root .env
if [ -f "/app/private/.env" ]; then
  echo "🔄 Loading /app/private/.env file..."
  set -o allexport
  source /app/private/.env
  set +o allexport
elif [ -f "/app/.env" ]; then
  echo "🔄 Loading /app/.env file..."
  set -o allexport
  source /app/.env
  set +o allexport
fi

# Mandatory variables
: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF}"
: "${VITE_SUPABASE_DB_PASSWORD:?Set VITE_SUPABASE_DB_PASSWORD}"

# Setup Supabase CLI config
mkdir -p ~/.supabase
cat <<EOF > ~/.supabase/config.toml
[project]
ref = "${SUPABASE_PROJECT_REF}"
EOF

export SUPABASE_DB_URL="postgresql://postgres:${VITE_SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"

# Wrap backend setup logic to continue on error
(
  set -e

  echo "📦 Pushing DB migrations..."
  supabase db push --db-url "$SUPABASE_DB_URL" || echo "❌ DB push failed. You may need to run migration repair manually."

  if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "⚙️ Deploying Edge Functions..."
    if [ -d "/app/supabase/functions" ]; then
      for func in /app/supabase/functions/*; do
        if [ -d "$func" ]; then
          func_name=$(basename "$func")
          echo "🚀 Deploying function: $func_name"
          supabase functions deploy "$func_name" --project-ref "$SUPABASE_PROJECT_REF" || echo "⚠️ Failed to deploy $func_name"
        fi
      done
    else
      echo "⚠️ No functions directory found at /app/supabase/functions/"
    fi
  else
    echo "⚠️ Skipping Edge Functions deployment due to missing SUPABASE_ACCESS_TOKEN."
  fi

  echo "✅ Supabase backend setup attempted."
) || {
  echo "⚠️ Supabase backend setup encountered errors but continuing with frontend setup..."
}

echo "🌐 Proceeding with frontend deployment..."

# Add your frontend setup here, for example:
# npm install && npm run build
