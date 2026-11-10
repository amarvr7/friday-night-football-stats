const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const PROHIBITED_HALLUCINATION_PATTERNS = [
    /\b\d{1,3}(?:st|nd|rd|th)\s+minute\b/i,
    /\b\d{1,3}'\b/,
    /\bxG\b/i,
    /\bexpected goals\b/i,
    /\b\d{1,2}%\s+possession\b/i,
    /\bpass completion\b/i,
    /\bred card\b/i,
    /\byellow card\b/i,
    /\bcorner kick\b/i,
    /\boffside trap\b/i,
    /\bVAR\b/
];

const validateInputPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return 'Missing or invalid "payload" object in request body.';
    }
    if (!payload.teams || !payload.teams.blue || !payload.teams.white) {
        return 'Payload must include verified blue and white team summaries.';
    }
    if (!Array.isArray(payload.allRosterPerformances) || payload.allRosterPerformances.length === 0) {
        return 'Payload must include verified player performances.';
    }
    return null;
};

const validateStructuredOutput = (parsed) => {
    if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'Model output is not a JSON object.' };
    }
    const { analyst, pundit } = parsed;
    if (!analyst || typeof analyst !== 'object') {
        return { valid: false, error: 'Missing "analyst" object in model output.' };
    }
    if (!pundit || typeof pundit !== 'object') {
        return { valid: false, error: 'Missing "pundit" object in model output.' };
    }
    if (typeof analyst.headline !== 'string' || !analyst.headline.trim()) {
        return { valid: false, error: 'Missing analyst.headline.' };
    }
    if (typeof analyst.summary !== 'string' || !analyst.summary.trim()) {
        return { valid: false, error: 'Missing analyst.summary.' };
    }
    if (!Array.isArray(analyst.keyStats) || analyst.keyStats.length === 0) {
        return { valid: false, error: 'analyst.keyStats must be a non-empty array of strings.' };
    }
    if (typeof pundit.headline !== 'string' || !pundit.headline.trim()) {
        return { valid: false, error: 'Missing pundit.headline.' };
    }
    if (typeof pundit.summary !== 'string' || !pundit.summary.trim()) {
        return { valid: false, error: 'Missing pundit.summary.' };
    }
    if (typeof pundit.hotTake !== 'string' || !pundit.hotTake.trim()) {
        return { valid: false, error: 'Missing pundit.hotTake.' };
    }

    const fullText = [
        analyst.headline,
        analyst.summary,
        analyst.mvpAnalysis || '',
        ...analyst.keyStats,
        pundit.headline,
        pundit.summary,
        pundit.hotTake
    ].join(' ');

    for (const pattern of PROHIBITED_HALLUCINATION_PATTERNS) {
        if (pattern.test(fullText)) {
            return {
                valid: false,
                error: `Prohibited invented match event detected in AI output (${pattern.toString()}).`
            };
        }
    }

    return {
        valid: true,
        report: {
            analyst: {
                headline: analyst.headline.trim(),
                summary: analyst.summary.trim(),
                keyStats: analyst.keyStats.slice(0, 5).map(s => String(s).trim()).filter(Boolean),
                mvpAnalysis: typeof analyst.mvpAnalysis === 'string' ? analyst.mvpAnalysis.trim() : ''
            },
            pundit: {
                headline: pundit.headline.trim(),
                summary: pundit.summary.trim(),
                hotTake: pundit.hotTake.trim()
            }
        }
    };
};

const buildSystemPrompt = (payload) => {
    const persona = payload && payload.punditPersona && payload.punditPersona.name
        ? payload.punditPersona
        : null;

    const punditVoiceRule = persona
        ? `5. Write the "pundit" section in the distinctive broadcast voice and personality of ${persona.name} (${persona.style}). Capture their tone, rhythm, and catchphrase energy. Do NOT invent quotes, do NOT claim the real person actually said this, and use ONLY the verified stats provided.`
        : '5. Write the "pundit" section in a lively Premier League studio pundit voice using ONLY the verified stats provided.';

    return [
        'You are the official Premier League-style AI Match Insights engine for Friday Night Football pickup soccer.',
        'STRICT RULES:',
        '1. Use ONLY the verified statistics provided in the JSON input.',
        '2. NEVER invent match events, minute timestamps (e.g. "45th minute" or "72\'"), xG, expected goals, possession percentages, pass completion rates, cards, corners, VAR, or weather.',
        '3. The 0-10 Match Contribution Rating (matchContributionRating) is pre-calculated in code. Do NOT recalculate or alter any ratings.',
        punditVoiceRule,
        '4. Return ONLY valid JSON matching the exact schema below with no markdown code fences or extra commentary:',
        '{',
        '  "analyst": {',
        '    "headline": "Concise, objective data-driven headline",',
        '    "summary": "2-3 sentences of tactical/statistical breakdown referencing verified scores, goals, assists, clean sheets, and code-calculated ratings",',
        '    "keyStats": ["3 to 4 bullet strings highlighting verified numbers and form"],',
        '    "mvpAnalysis": "1-2 sentences analyzing the top-rated performer and MOTM"',
        '  },',
        '  "pundit": {',
        '    "headline": "Punchy, expressive broadcast pundit headline",',
        '    "summary": "2-3 lively Premier League studio pundit sentences celebrating the winners and standout performers using ONLY verified stats",',
        '    "hotTake": "1 bold pundit verdict grounded strictly in the provided match numbers and 5-match form"',
        '  }',
        '}'
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
                temperature: 0.3,
                max_tokens: 700,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: buildSystemPrompt(payload) },
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
            report: validation.report,
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
