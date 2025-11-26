# Railway Deployment Guide for Magic English

This guide will help you deploy the Magic English web application to Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **Supabase Project**: Set up your Supabase database
4. **AI API Keys**: Have your AI provider API keys ready

## Deployment Steps

### 1. Prepare Your Repository

Ensure all configuration files are committed:
```bash
git add .
git commit -m "Add Railway configuration files"
git push origin main
```

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `magic_english` repository

### 3. Deploy Backend Service

1. Railway will detect your monorepo structure
2. Create a new service for the backend:
   - Click "Add Service" → "GitHub Repo"
   - Select your repository
   - Set **Root Directory**: `backend`
   - Set **Start Command**: `npm start`
   - Set **Build Command**: `npm install`

### 4. Configure Backend Environment Variables

In your backend service settings, add these environment variables:

```bash
NODE_ENV=production
PORT=5000

# Supabase (get from your Supabase dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...

# AI Configuration
AI_PROVIDER=ollama-cloud
AI_API_KEY=your-ai-api-key
AI_MODEL=gpt-oss:20b-cloud

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secure-jwt-secret-key

# CORS (will be updated after frontend deployment)
FRONTEND_URL=https://your-frontend.railway.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
```

### 5. Deploy Frontend Service

1. Create another service for the frontend:
   - Click "Add Service" → "GitHub Repo"
   - Select your repository again
   - Set **Root Directory**: `frontend`
   - Set **Start Command**: `npm run preview`
   - Set **Build Command**: `npm install && npm run build`

### 6. Configure Frontend Environment Variables

In your frontend service settings, add these environment variables:

```bash
# API URL (use your backend Railway URL)
VITE_API_URL=https://your-backend.railway.app/api

# Supabase (same as backend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...

# App Configuration
VITE_APP_NAME=Magic English
VITE_APP_VERSION=1.0.0
```

### 7. Update CORS Configuration

After both services are deployed:

1. Copy your frontend Railway URL
2. Update the backend's `FRONTEND_URL` environment variable
3. Restart the backend service

### 8. Set Up Custom Domains (Optional)

1. In each service, go to Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed by Railway

## Important Notes

### Database Setup
- Your Supabase database should already be configured
- Run any pending SQL migrations in your Supabase dashboard
- Ensure RLS policies are properly configured

### AI Service Configuration
- Make sure your AI provider API keys are valid
- Test the AI endpoints after deployment
- Monitor usage and adjust rate limits as needed

### Security
- Never commit `.env` files with real secrets
- Use Railway's environment variable system
- Regularly rotate API keys and secrets
- Monitor your application logs

### Monitoring
- Check Railway's metrics dashboard
- Monitor your Supabase usage
- Set up alerts for errors or high usage

## Troubleshooting

### Common Issues

**Build Failures:**
- Check that Node.js version is compatible (>=18.0.0)
- Verify all dependencies are in package.json
- Check build logs for specific errors

**CORS Errors:**
- Verify `FRONTEND_URL` in backend matches your frontend domain
- Check that CORS middleware is properly configured
- Ensure both services are deployed and running

**Database Connection Issues:**
- Verify Supabase URL and keys are correct
- Check Supabase service status
- Ensure your Supabase project allows connections

**AI Service Errors:**
- Verify API keys are correct and have proper permissions
- Check AI provider service status
- Monitor rate limits and usage quotas

### Getting Help

1. Check Railway's documentation: [docs.railway.app](https://docs.railway.app)
2. Review application logs in Railway dashboard
3. Check Supabase logs and metrics
4. Monitor browser console for frontend errors

## Post-Deployment

1. **Test all functionality**: Registration, login, vocabulary features, AI integration
2. **Monitor performance**: Check response times and error rates
3. **Set up backups**: Configure Supabase automated backups
4. **Scale as needed**: Upgrade Railway plans based on usage

## Cost Optimization

- **Frontend**: Static hosting is very cheap on Railway
- **Backend**: Monitor usage and scale appropriately
- **Database**: Supabase free tier is generous for development
- **AI Costs**: Monitor API usage and implement caching if needed

Your Magic English application should now be fully deployed and accessible via your Railway URLs!