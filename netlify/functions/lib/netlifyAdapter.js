// Adapts an Express/Vercel-style (req, res) handler into a Netlify Functions
// handler. This lets the serverless logic in /api be reused verbatim by both
// the local CRA dev proxy (src/setupProxy.js) and Netlify deploys (DRY).
const createNetlifyHandler = (expressStyleHandler) => async (event) => {
    let parsedBody = {};

    if (event.body) {
        try {
            parsedBody = JSON.parse(event.body);
        } catch (err) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid JSON in request body.', code: 'INVALID_JSON' })
            };
        }
    }

    const req = {
        method: event.httpMethod,
        body: parsedBody
    };

    let statusCode = 200;
    let responsePayload = null;

    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            responsePayload = payload;
            return this;
        }
    };

    await expressStyleHandler(req, res);

    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responsePayload)
    };
};

module.exports = { createNetlifyHandler };
