// Cloudflare Workers entry point. Runs the same Express app as app.js, backed by D1.
// Static files in public/ are served by Workers Static Assets (see wrangler.jsonc).
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import nunjucks from 'nunjucks';
import precompiledViews from './build/views.js';
import { createApp } from './create-app.js';
import { createD1Db } from './db-d1.js';

const PORT = 8080;

const app = createApp({
  db: createD1Db(env.DB),
  configureViews(app) {
    const views = new nunjucks.Environment(new nunjucks.PrecompiledLoader(precompiledViews), {
      autoescape: true
    });
    // nunjucks' own Express adapter needs node:path, which its browser build stubs
    // out, so plug the precompiled templates into Express with a minimal view class.
    app.set('view', class PrecompiledView {
      constructor(name) {
        this.name = name.endsWith('.html') ? name : `${name}.html`;
        this.path = this.name;
      }

      render(context, callback) {
        views.render(this.name, context, callback);
      }
    });
  }
});

app.listen(PORT);

export default httpServerHandler({ port: PORT });
