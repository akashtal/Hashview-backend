# AWS Amplify Backend Deployment Guide

## Important Note
AWS Amplify is primarily designed for frontend applications. For a pure backend API, consider:
- **AWS Elastic Beanstalk** (Easiest for Express.js)
- **AWS ECS/Fargate** (Container-based)
- **AWS Lambda + API Gateway** (Serverless)

However, if you want to use Amplify, follow these steps:

## Step 1: Configure Amplify App as SSR

1. Go to AWS Amplify Console
2. Select your app
3. Go to **App settings** → **General**
4. Under **Build settings**, ensure:
   - **Framework**: Node.js - SSR
   - **App root**: `/` (or leave empty if backend is at root)
   - **Build command**: (leave empty or use `npm run build` if you have one)
   - **Start command**: `npm start`

## Step 2: Environment Variables

In Amplify Console → **App settings** → **Environment variables**, add:

```
NODE_ENV=production
PORT=8080
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=your_email@domain.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GOOGLE_PLACES_API_KEY=your_google_places_key
SENTRY_DSN=your_sentry_dsn (optional)
REDIS_URL=your_redis_url (optional)
```

## Step 3: Update server.js for Amplify

Amplify uses port 8080 by default. Your server.js already uses `process.env.PORT || 5000`, which is good. Make sure it works with port 8080.

## Step 4: Build Configuration

The `amplify.yml` file is already configured. Make sure it's committed to your repository.

## Step 5: Deploy

1. Push your code to the connected branch
2. Amplify will automatically trigger a build
3. Monitor the build logs in the Amplify console

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json` (not just devDependencies)
- Ensure `node_modules` is in `.gitignore`
- Verify environment variables are set correctly

### Server Not Starting
- Check build logs for errors
- Verify `npm start` command works locally
- Ensure PORT environment variable is set

### API Not Accessible
- Check Amplify app URL
- Verify CORS settings in your Express app
- Check that routes are properly configured

## Alternative: AWS Elastic Beanstalk (Recommended for Backend)

For a pure backend API, Elastic Beanstalk is easier:

1. Install EB CLI: `npm install -g eb-cli`
2. Initialize: `eb init`
3. Create environment: `eb create`
4. Deploy: `eb deploy`

This is specifically designed for Node.js backends and handles scaling, load balancing, and health checks automatically.

