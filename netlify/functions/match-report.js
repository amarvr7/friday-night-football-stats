const { createNetlifyHandler } = require('./lib/netlifyAdapter');
const matchReportHandler = require('../../api/match-report');

// Served at /.netlify/functions/match-report and mapped from /api/match-report
// via the redirect rule in netlify.toml.
exports.handler = createNetlifyHandler(matchReportHandler);
