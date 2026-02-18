#!/bin/bash

# Nutrio Fuel Deployment Script

echo "🚀 Starting Nutrio Fuel deployment..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "⚠️  Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Deploy Edge Functions
echo "📦 Deploying Edge Functions..."
npx supabase functions deploy check-ip-location
npx supabase functions deploy log-user-ip

# Push database migrations
echo "💾 Pushing database migrations..."
npx supabase db push

# Build the application
echo "🏗️  Building the application..."
npm run build

# Deploy to Supabase Hosting
echo "🌐 Deploying to Supabase Hosting..."
npx supabase deploy

echo "✅ Deployment completed successfully!"
echo "🔗 Your application is now live!"