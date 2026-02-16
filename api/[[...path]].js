/**
 * Vercel serverless entry: forwards all /api/* requests to the Express app.
 * Required because Vercel does not run a long-lived Node server (e.g. bin/www).
 */
const app = require("../app");
module.exports = app;
