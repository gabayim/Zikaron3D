#!/usr/bin/env bash
# Zikaron3D Supabase Keepalive Ping
# Prevents free-tier database inactivity auto-pausing (runs daily)

SUPABASE_URL="https://ggkrbyjabsihzdskdbrt.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdna3JieWphYnNpaHpkc2tkYnJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMDQwNDUsImV4cCI6MjEwODY4MDA0NX0.5xhb4kmcSi5VmluFwHEI_PM0COMnBqFQZtt0wd_j83M"

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 10 \
  --max-time 20 \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  "${SUPABASE_URL}/auth/v1/health")

echo "[${TIMESTAMP}] Supabase Keepalive Ping status: ${HTTP_STATUS}"
