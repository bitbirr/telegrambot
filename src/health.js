const express = require('express');
const rateLimit = require('express-rate-limit');

// Create Express application
const app = express();

// In-memory user rate limiting code
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply to all requests
app.use(limiter);

// /health command implementation
app.get('/health', (req, res) => {
  res.send('OK');
});

module.exports = app;