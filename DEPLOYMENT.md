# Nutrio Fuel Deployment Guide

This guide provides step-by-step instructions for deploying the Nutrio Fuel application to production.

## Prerequisites

1. Node.js (v18 or higher)
2. npm (v8 or higher)
3. Supabase CLI
4. Docker (for local development)

## Deployment Steps

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Link Project to Supabase

```bash
supabase link --project-ref=YOUR_PROJECT_ID
```

### 3. Deploy Edge Functions

```bash
# Deploy IP location check function
supabase functions deploy check-ip-location

# Deploy IP logging function
supabase functions deploy log-user-ip
```

### 4. Push Database Migrations

```bash
supabase db push
```

### 5. Build the Application

```bash
npm run build
```

### 6. Deploy to Hosting

```bash
supabase deploy
```

## Automated Deployment

You can use the provided deployment scripts:

### For Unix/Linux/macOS:
```bash
chmod +x deploy.sh
./deploy.sh
```

### For Windows:
```cmd
deploy.bat
```

## Environment Variables

Make sure the following environment variables are set in your production environment:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `VITE_POSTHOG_KEY` - Your PostHog API key
- `VITE_SENTRY_DSN` - Your Sentry DSN
- `RESEND_API_KEY` - Your Resend API key

## IP Management Features

The IP management system includes:

1. **Geo-restriction**: Only allows signups from Qatar (QA)
2. **IP blocking**: Admins can block specific IP addresses
3. **IP logging**: All user IPs are logged with location data
4. **Admin interface**: View and manage blocked IPs and user IP logs

### Accessing IP Management

1. Log in as an admin user
2. Navigate to the Admin Panel
3. Click on "IP Management" in the sidebar
4. View blocked IPs and user IP logs
5. Block new IPs using the form

## Troubleshooting

### Common Issues

1. **Supabase CLI not found**: Make sure you've installed it globally with `npm install -g supabase`
2. **Database migration conflicts**: Run `supabase db reset` to reset your database (WARNING: This will delete all data)
3. **Function deployment errors**: Check the Supabase dashboard for detailed error messages

### Checking Deployment Status

```bash
# Check function status
supabase functions status

# Check database status
supabase db status

# Check project status
supabase status
```

## Monitoring and Maintenance

1. Regularly review blocked IPs in the admin panel
2. Monitor PostHog analytics for user behavior insights
3. Check Sentry for error reports
4. Review database performance and optimize queries as needed

## Rollback Procedure

If you need to rollback a deployment:

1. Revert the code to the previous version
2. Run the deployment steps again
3. If database migrations need to be rolled back, use the Supabase dashboard or CLI to restore from a backup

## Security Considerations

1. Keep all API keys and secrets secure
2. Regularly rotate API keys
3. Monitor the IP logs for suspicious activity
4. Update dependencies regularly to patch security vulnerabilities