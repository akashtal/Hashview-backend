# AWS Amplify Backend Setup - Step by Step

## ⚠️ IMPORTANT: Configure in Amplify Console

Since you uploaded only the backend folder, you need to configure Amplify to run it as a Node.js SSR app.

## Step 1: Configure Build Settings in Amplify Console

1. Go to **AWS Amplify Console** → Your App
2. Click **App settings** (left sidebar)
3. Click **Build settings**
4. Click **Edit** button
5. Configure as follows:

### Build Settings:
```
Framework: Node.js - SSR
App root: / (leave empty or use /)
Build command: (leave empty)
Start command: npm start
```

### OR use YAML (if you prefer):
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - echo "No build needed"
  artifacts:
    baseDirectory: .
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Step 2: Set Environment Variables

In **App settings** → **Environment variables**, add ALL of these:

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
```

**Optional:**
```
SENTRY_DSN=your_sentry_dsn
REDIS_URL=your_redis_url
FRONTEND_URL=https://your-frontend-domain.com
```

## Step 3: Redeploy

1. After configuring, click **Save**
2. Go to **App** → **Deployments**
3. Click **Redeploy this version** or push a new commit

## Step 4: Verify Backend is Running

After deployment, test:
- `https://main.d2u7xdctrd0scr.amplifyapp.com/api/health`
- `https://main.d2u7xdctrd0scr.amplifyapp.com/api/auth/register`

You should get JSON responses, not 404 errors.

## Troubleshooting

### Still getting 404?
- Check that **Framework** is set to **Node.js - SSR** (not "Static")
- Verify **Start command** is `npm start`
- Check build logs for errors

### Server not starting?
- Check environment variables are set correctly
- Verify MongoDB URI is accessible
- Check build logs for startup errors

### Port issues?
- Amplify uses port 8080 by default
- Your server.js already uses `process.env.PORT || 5000`
- Make sure `PORT=8080` is set in environment variables

