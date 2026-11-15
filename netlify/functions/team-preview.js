const { createNetlifyHandler } = require('./lib/netlifyAdapter');
const teamPreviewHandler = require('../../api/team-preview');

// Served at /.netlify/functions/team-preview and mapped from /api/team-preview
// via the redirect rule in netlify.toml.
exports.handler = createNetlifyHandler(teamPreviewHandler);
