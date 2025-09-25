# Production Deployment Guide for Vercel

This guide provides comprehensive instructions for deploying the Telegram Bot application to Vercel with production-ready configurations, monitoring, and security best practices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Vercel Configuration](#vercel-configuration)
4. [Deployment Process](#deployment-process)
5. [Environment Variables](#environment-variables)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Security Considerations](#security-considerations)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

## Prerequisites

Before deploying to Vercel, ensure you have:

- **Node.js 18.x** or higher
- **Vercel CLI** installed (`npm i -g vercel`)
- **Git repository** with your code
- **Vercel account** (free or paid)
- **Required API keys** (see Environment Variables section)

### Required Services

1. **Telegram Bot Token** - Create a bot via [@BotFather](https://t.me/botfather)
2. **OpenAI API Key** - Get from [OpenAI Platform](https://platform.openai.com/)
3. **Supabase Project** - Create at [Supabase](https://supabase.com/)
4. **Backend API** (if applicable) - Your custom API endpoints

## Environment Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/bitbirr/telegrambot.git
cd telegrambot
npm install
```

### 2. Local Development Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your actual values
# DO NOT commit .env to version control
```

### 3. Verify Local Setup

```bash
# Run health checks
npm run test:health

# Start development server
npm run dev

# Test health endpoint
curl http://localhost:3000/health
```

## Vercel Configuration

The application includes a pre-configured `vercel.json` file with optimized settings:

### Key Configuration Features

- **Serverless Functions**: Optimized for Node.js 18.x
- **Build Settings**: Automated build process with health checks
- **Environment Variables**: Secure configuration management
- **Headers**: Security headers and CORS configuration
- **Regions**: Multi-region deployment support
- **GitHub Integration**: Automatic deployments on push

### Build Configuration

```json
{
  "builds": [
    {
      "src": "src/bot.js",
      "use": "@vercel/node",
      "config": {
        "maxLambdaSize": "50mb",
        "memory": 1024,
        "maxDuration": 30
      }
    },
    {
      "src": "src/health.js",
      "use": "@vercel/node",
      "config": {
        "memory": 512,
        "maxDuration": 10
      }
    }
  ]
}
```

## Deployment Process

### Option 1: Vercel CLI (Recommended)

```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Option 2: GitHub Integration

1. **Connect Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Build Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Set Environment Variables** (see next section)

4. **Deploy**: Automatic deployment on git push to main branch

### Option 3: Vercel for Git

```bash
# Link project to Vercel
vercel link

# Set environment variables
vercel env add TELEGRAM_BOT_TOKEN
vercel env add OPENAI_API_KEY
# ... (add all required variables)

# Deploy
git push origin main
```

## Environment Variables

### Required Variables

Set these in your Vercel project settings:

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API Configuration
BACKEND_API_URL=your_backend_api_url
BACKEND_API_KEY=your_backend_api_key

# Production Environment
NODE_ENV=production
```

### Optional Variables

```bash
# Logging Configuration
LOG_LEVEL=info

# Security Configuration
ALLOWED_ORIGINS=https://eqabo.com,https://www.eqabo.com
ADMIN_API_KEY=your_admin_api_key_for_monitoring

# Performance Configuration
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=30000

# Monitoring Configuration
REQUEST_TIMEOUT=true
METRICS_RETENTION_DAYS=7

# External Services
SMS_API_KEY=your_sms_api_key
EMAIL_API_KEY=your_email_api_key
```

### Setting Environment Variables

#### Via Vercel Dashboard

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate environment (Production, Preview, Development)

#### Via Vercel CLI

```bash
# Add production environment variable
vercel env add TELEGRAM_BOT_TOKEN production

# Add to all environments
vercel env add NODE_ENV

# List all environment variables
vercel env ls
```

#### Via .env.production (Template)

Use the provided `.env.production` file as a template:

```bash
# Copy and customize for your deployment
cp .env.production .env.vercel
# Edit .env.vercel with your values
# Upload via Vercel Dashboard
```

## Monitoring & Health Checks

### Health Check Endpoints

The application provides comprehensive health monitoring:

```bash
# Basic health check
GET /health

# Detailed health with metrics
GET /health/detailed

# System metrics
GET /health/metrics

# Error statistics
GET /health/errors

# Readiness probe
GET /health/ready

# Liveness probe
GET /health/live

# Performance metrics
GET /health/performance

# Comprehensive status
GET /health/status
```

### Monitoring Dashboard

Access real-time monitoring at:

```bash
# Full dashboard
GET /monitoring/dashboard

# Real-time metrics
GET /monitoring/metrics/realtime

# Alerts management
GET /monitoring/alerts
POST /monitoring/alerts/{alertId}/acknowledge

# Performance analytics
GET /monitoring/analytics/performance?timeframe=1h
```

### Setting Up Monitoring

1. **Vercel Analytics**: Enable in project settings
2. **Custom Monitoring**: Use the built-in dashboard endpoints
3. **External Monitoring**: Configure with services like:
   - Datadog
   - New Relic
   - Grafana
   - Prometheus

### Alert Configuration

The application includes built-in alerting for:

- High response times (>1s warning, >5s critical)
- Error rates (>5% warning, >10% critical)
- Memory usage (>80% warning, >90% critical)
- External service failures

## Security Considerations

### Environment Security

- **Never commit secrets** to version control
- **Use Vercel's encrypted environment variables**
- **Rotate API keys regularly**
- **Implement proper CORS policies**

### Application Security

The application includes:

- **Helmet.js**: Security headers
- **Rate limiting**: Request throttling
- **Input validation**: Request sanitization
- **Error handling**: Secure error responses
- **HTTPS enforcement**: SSL/TLS encryption

### API Security

```bash
# Set strong admin API key
ADMIN_API_KEY=your_very_strong_admin_key_here

# Configure allowed origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Security Headers

Configured in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

## Performance Optimization

### Vercel-Specific Optimizations

1. **Function Configuration**:
   - Memory allocation: 1024MB for main bot, 512MB for health
   - Max duration: 30s for bot operations, 10s for health checks
   - Max lambda size: 50MB

2. **Caching Strategy**:
   - Static assets: Long-term caching
   - API responses: Short-term caching where appropriate
   - Health checks: No caching

3. **Bundle Optimization**:
   - Tree shaking enabled
   - Production builds minified
   - Unused dependencies removed

### Application Optimizations

- **Connection pooling** for database connections
- **Circuit breakers** for external service calls
- **Request deduplication** for similar operations
- **Compression** for response payloads
- **Efficient logging** with structured formats

### Monitoring Performance

```bash
# Check performance metrics
curl https://your-app.vercel.app/monitoring/analytics/performance?timeframe=1h

# Monitor response times
curl https://your-app.vercel.app/health/performance
```

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check build logs
vercel logs

# Common solutions:
# - Verify Node.js version (18.x required)
# - Check package.json scripts
# - Ensure all dependencies are installed
# - Verify environment variables
```

#### 2. Runtime Errors

```bash
# Check function logs
vercel logs --follow

# Check error statistics
curl https://your-app.vercel.app/health/errors

# Common solutions:
# - Verify environment variables are set
# - Check external service connectivity
# - Review error logs for specific issues
```

#### 3. Performance Issues

```bash
# Check performance metrics
curl https://your-app.vercel.app/monitoring/dashboard

# Common solutions:
# - Increase function memory allocation
# - Optimize database queries
# - Implement caching strategies
# - Review circuit breaker settings
```

#### 4. Environment Variable Issues

```bash
# List current environment variables
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME

# Update existing variables
vercel env rm VARIABLE_NAME
vercel env add VARIABLE_NAME
```

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
LOG_LEVEL=debug

# Redeploy
vercel --prod
```

### Health Check Debugging

```bash
# Check detailed health status
curl https://your-app.vercel.app/health/detailed

# Check circuit breaker status
curl https://your-app.vercel.app/health/circuit-breakers

# Reset circuit breakers if needed
curl -X POST https://your-app.vercel.app/health/circuit-breakers/serviceName/reset
```

## Maintenance

### Regular Maintenance Tasks

#### Weekly

- **Review error logs** and address recurring issues
- **Check performance metrics** and optimize if needed
- **Update dependencies** with security patches
- **Review monitoring alerts** and adjust thresholds

#### Monthly

- **Rotate API keys** for security
- **Review and update environment variables**
- **Analyze usage patterns** and optimize accordingly
- **Update documentation** with any changes

#### Quarterly

- **Security audit** of the application
- **Performance review** and optimization
- **Dependency updates** (major versions)
- **Disaster recovery testing**

### Backup and Recovery

#### Environment Variables Backup

```bash
# Export environment variables
vercel env ls > env-backup.txt

# Document all configurations
# Store securely (not in version control)
```

#### Code Backup

- **Git repository**: Ensure regular commits and pushes
- **Vercel deployments**: Automatic backup of each deployment
- **Database backups**: Configure Supabase automatic backups

### Scaling Considerations

#### Horizontal Scaling

- Vercel automatically scales functions based on demand
- Monitor concurrent execution limits
- Consider upgrading Vercel plan for higher limits

#### Vertical Scaling

```json
// Increase function memory in vercel.json
{
  "functions": {
    "src/bot.js": {
      "memory": 2048
    }
  }
}
```

### Monitoring and Alerting Setup

#### External Monitoring Integration

```javascript
// Example: Datadog integration
import { StatsD } from 'node-statsd';

const statsd = new StatsD({
  host: process.env.DATADOG_HOST,
  port: process.env.DATADOG_PORT
});

// Send custom metrics
statsd.increment('telegram.message.received');
statsd.timing('api.response_time', responseTime);
```

#### Webhook Monitoring

Set up webhooks for critical alerts:

```bash
# Configure webhook URL in monitoring dashboard
WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Or use email notifications
ALERT_EMAIL=admin@yourdomain.com
```

## Support and Resources

### Documentation

- [Vercel Documentation](https://vercel.com/docs)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)

### Community

- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Telegram Bot Developers](https://t.me/BotSupport)
- [Node.js Community](https://nodejs.org/en/community/)

### Support Contacts

- **Technical Issues**: Create an issue in the GitHub repository
- **Deployment Issues**: Contact Vercel support
- **Security Concerns**: Email security@yourdomain.com

---

## Quick Reference

### Essential Commands

```bash
# Deploy to production
vercel --prod

# Check logs
vercel logs

# Set environment variable
vercel env add VARIABLE_NAME

# Check health
curl https://your-app.vercel.app/health

# View monitoring dashboard
curl https://your-app.vercel.app/monitoring/dashboard
```

### Important URLs

- **Health Check**: `https://your-app.vercel.app/health`
- **Monitoring Dashboard**: `https://your-app.vercel.app/monitoring/dashboard`
- **Vercel Dashboard**: `https://vercel.com/dashboard`
- **GitHub Repository**: `https://github.com/bitbirr/telegrambot`

### Emergency Procedures

1. **Service Down**: Check Vercel status page and function logs
2. **High Error Rate**: Review error logs and circuit breaker status
3. **Performance Issues**: Check monitoring dashboard and scale if needed
4. **Security Incident**: Rotate API keys and review access logs

---

*Last updated: January 2024*
*Version: 1.0.0*