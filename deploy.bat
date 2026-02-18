@echo off
title Nutrio Fuel Deployment

echo 🚀 Starting Nutrio Fuel deployment...

REM Check if Supabase CLI is installed
where supabase >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Supabase CLI not found. Installing...
    npm install -g supabase
)

REM Deploy Edge Functions
echo 📦 Deploying Edge Functions...
npx supabase functions deploy check-ip-location
npx supabase functions deploy log-user-ip

REM Push database migrations
echo 💾 Pushing database migrations...
npx supabase db push

REM Build the application
echo 🏗️  Building the application...
npm run build

REM Deploy to Supabase Hosting
echo 🌐 Deploying to Supabase Hosting...
npx supabase deploy

echo ✅ Deployment completed successfully!
echo 🔗 Your application is now live!

pause