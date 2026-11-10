const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const validateInputPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return 'Missing or invalid "payload" object in request body.';
    }
    if (!payload.teams || !Array.isArray(payload.teams.blue) || !Array.isArray(payload.teams.white)) {
        return 'Payload must include blue and white team rosters.';
    }
    if (payload.teams.blue.length === 0 || payload.teams.white.length === 0) {
        return 'Both teams must contain at least one player.';
    }
    return null;
};

const validateStructuredOutput = (parsed) => {
    if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'Model output is not a JSON object.' };
    }
    if (typeof parsed.message !== 'string' || !parsed.message.trim()) {
        return { valid: false, error: 'Missing "message" string in model output.' };
    }
    return { valid: true, preview: { message: parsed.message.trim() } };
};

const buildSystemPrompt = () => {
    return [
        'You are the hype announcer for "Friday Night Football", a weekly pickup soccer game among friends.',
        'Write an energetic, friendly matchday announcement message to post in the group chat.',
        'STRICT RULES:',
        '1. Use ONLY the verified team rosters, ratings, chemistry, and rivalry context provided in the JSON input. Never invent player names, scores, or past events.',
        '2. Do NOT predict a winner or final score. Keep it hype and balanced between both teams.',
        '2a. Weave the provided team chemistry naturally into the matchup banter line (do NOT add a separate chemistry section or stat list). Reference it as fun, FIFA-style "chemistry" context. Even if one team\'s chemistry is clearly higher, stay even-handed and remind everyone the other side can always cause an upset.',
        '3. Follow this EXACT structure and tone (fill in the real data):',
        '',
        '🏟️ FRIDAY NIGHT FOOTBALL IS BACK! ⚽🔥',
        '',
        '<one or two upbeat opening lines about finishing the week with good football>',
        '',
        '**Game tomorrow at <KICKOFF_TIME> sharp!**',
        '',
        '<one short line reminding players to arrive early, warm up, and stay injury-free, with light humor>',
        '',
        '🔵 BLUE TEAM',
        '• <player>',
        '',
        '⚪️ WHITE TEAM',
        '• <player>',
        '',
        '<one or two lines about the matchup, naturally working in the real team chemistry scores/labels and the "familiar faces on opposite sides" rivalry context, kept balanced>',
        '',
        'Amar will be tracking the stats. Goals, assists, clean sheets, everything counts! 📊',
        '',
        '<one closing line about competing hard, respect, and enjoying the game>',
        '',
        '**FRIDAY. <KICKOFF_TIME>. FRIDAY NIGHT LIGHTS!**',
        '',
        'LET\'S GET IT, LADS! ⚽🔥',
        '',
        '4. List every player under the correct team using "• " bullets, in the order provided.',
        '5. Return ONLY valid JSON with no markdown fences: {"message": "the full announcement text with real newlines"}'
    ].join('\n');
};

const extractJsonFromContent = (rawContent) => {
    if (typeof rawContent !== 'string') return null;
    const trimmed = rawContent.trim();
    const withoutFences = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    return JSON.parse(withoutFences);
};

async function handler(req, res, customFetch = fetch) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed. Use POST.', code: 'METHOD_NOT_ALLOWED' });
        return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || !apiKey.trim()) {
        res.status(500).json({
            error: 'Server configuration error: OPENROUTER_API_KEY is missing.',
            code: 'MISSING_API_KEY'
        });
        return;
    }

    const payload = req.body?.payload;
    const inputError = validateInputPayload(payload);
    if (inputError) {
        res.status(400).json({ error: inputError, code: 'INVALID_PAYLOAD' });
        return;
    }

    try {
        const openRouterResponse = await customFetch(OPENROUTER_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://fridaynightfootball.app',
                'X-Title': 'Friday Night Football Stats'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                temperature: 0.7,
                max_tokens: 700,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: buildSystemPrompt() },
                    { role: 'user', content: JSON.stringify(payload) }
                ]
            })
        });

        if (!openRouterResponse.ok) {
            let errDetail = '';
            try {
                const errJson = await openRouterResponse.json();
                errDetail = errJson?.error?.message || JSON.stringify(errJson);
            } catch (_) {
                errDetail = `HTTP ${openRouterResponse.status}`;
            }

            const status = openRouterResponse.status === 429 ? 429 : 502;
            res.status(status).json({
                error: `OpenRouter upstream error: ${errDetail}`,
                code: openRouterResponse.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR'
            });
            return;
        }

        const completion = await openRouterResponse.json();
        const rawContent = completion?.choices?.[0]?.message?.content;
        if (!rawContent) {
            res.status(502).json({
                error: 'OpenRouter returned an empty completion response.',
                code: 'EMPTY_COMPLETION'
            });
            return;
        }

        let parsedJson;
        try {
            parsedJson = extractJsonFromContent(rawContent);
        } catch (jsonErr) {
            res.status(502).json({
                error: 'AI model returned malformed JSON.',
                code: 'MALFORMED_AI_JSON'
            });
            return;
        }

        const validation = validateStructuredOutput(parsedJson);
        if (!validation.valid) {
            res.status(422).json({
                error: validation.error,
                code: 'AI_VALIDATION_FAILED'
            });
            return;
        }

        res.status(200).json({
            preview: validation.preview,
            model: OPENROUTER_MODEL,
            generatedAt: new Date().toISOString(),
            source: 'openrouter'
        });
    } catch (err) {
        res.status(502).json({
            error: `Failed to communicate with OpenRouter: ${err.message || 'Unknown error'}`,
            code: 'UPSTREAM_NETWORK_ERROR'
        });
    }
}

module.exports = handler;
module.exports.OPENROUTER_MODEL = OPENROUTER_MODEL;
module.exports.validateInputPayload = validateInputPayload;
module.exports.validateStructuredOutput = validateStructuredOutput;
