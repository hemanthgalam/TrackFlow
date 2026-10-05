// Node.js entry point (Docker, App Runner, Kubernetes, local dev).
// For Cloudflare Workers see worker.js.
const nunjucks = require('nunjucks');
const path = require('path');
const db = require('./db');
const { createApp } = require('./create-app');

const PORT = process.env.PORT || 3000;

const app = createApp({
  db,
  staticDir: path.join(__dirname, 'public'),
  configureViews(app) {
    // Setup Nunjucks templating (Jinja compatible syntax)
    nunjucks.configure(path.join(__dirname, 'views'), {
      autoescape: true,
      express: app,
      noCache: true // true for development, disables template caching
    });
  }
});

// Initialize database schema first, then boot server
db.initializeDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal: Failed to initialize PostgreSQL database. Server not started.', err);
    process.exit(1);
  });
