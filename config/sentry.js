const Sentry = require('@sentry/node');

// Try to load profiling, but make it optional (may not work on all platforms)
let ProfilingIntegration;
try {
  ProfilingIntegration = require('@sentry/profiling-node').ProfilingIntegration;
} catch (error) {
  console.log('⚠️  Sentry profiling not available on this platform (optional)');
}

const initializeSentry = (app) => {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    const integrations = [
      // Enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express.js middleware tracing
      new Sentry.Integrations.Express({ app }),
    ];

    // Add profiling if available
    if (ProfilingIntegration) {
      integrations.push(new ProfilingIntegration());
    }

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      integrations,
      // Performance Monitoring
      tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
      // Profiling (only if available)
      profilesSampleRate: ProfilingIntegration ? 0.1 : 0, // Profile 10% of transactions
      // Error filtering
      beforeSend(event, hint) {
        // Don't send errors in development
        if (process.env.NODE_ENV !== 'production') {
          return null;
        }

        // Filter out known non-critical errors
        const error = hint.originalException;
        if (error && error.message) {
          // Don't report validation errors
          if (error.message.includes('Validation') ||
              error.message.includes('validation')) {
            return null;
          }
          
          // Don't report 404 errors
          if (error.statusCode === 404 || error.status === 404) {
            return null;
          }
        }

        return event;
      },
    });

    console.log('✅ Sentry error monitoring initialized');
  } else {
    console.log('ℹ️  Sentry not configured (set SENTRY_DSN environment variable)');
  }
};

module.exports = { initializeSentry, Sentry };

