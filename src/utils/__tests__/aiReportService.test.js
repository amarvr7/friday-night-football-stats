import {
    OPENROUTER_MODEL,
    PUNDIT_PERSONAS,
    buildVerifiedMatchPayload,
    validateAiReportResponse,
    isMatchReportCachedAndValid,
    generateMatchReportFromServer,
    getPunditPersonaForDate,
    buildShareableRecapText
} from '../../services/aiReportService';
import matchReportHandler from '../../../api/match-report';

const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
    return res;
};

describe('AI Match Report Service & OpenRouter Server Route Error Handling', () => {
    const players = [
        { id: 'p1', name: 'Amar', photoUrl: 'base64-secret-photo-should-not-leak', email: 'secret@example.com' },
        { id: 'p2', name: 'JT' }
    ];

    const match = {
        id: 'match_1',
        date: { seconds: 1777665600 },
        motm: 'p1',
        stats: {
            p1: { team: 'blue', goals: 2, assists: 1, win: 1, cleanSheet: true, goalsFor: 3, goalsAgainst: 0, ownGoals: 0 },
            p2: { team: 'white', goals: 0, assists: 0, win: 0, cleanSheet: false, goalsFor: 0, goalsAgainst: 3, ownGoals: 0 }
        }
    };

    const validAiReport = {
        analyst: {
            headline: 'Blue Secures 3-0 Clean Sheet Victory Over White',
            summary: 'Blue defeated White 3-0 behind Amar’s 2 goals and 1 assist, earning a 9.9/10 Match Contribution Rating.',
            keyStats: [
                'Final Score: Blue 3 - 0 White',
                'Amar: 2 Goals, 1 Assist, 9.9/10 MCR',
                'Blue Team: Verified Clean Sheet'
            ],
            mvpAnalysis: 'Amar led all players with 3 goal contributions and claimed Man of the Match honors.'
        },
        pundit: {
            headline: 'Amar Runs the Show Under the Friday Night Lights!',
            summary: 'What a statement from Blue! A 3-0 shutout with Amar involved in every single goal on the night.',
            hotTake: 'A 9.9 rating and a clean sheet win—Amar is in unstoppable form right now!'
        }
    };

    const originalEnv = process.env.OPENROUTER_API_KEY;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.OPENROUTER_API_KEY;
        } else {
            process.env.OPENROUTER_API_KEY = originalEnv;
        }
    });

    test('buildVerifiedMatchPayload sends only verified and necessary stats and strips photos/PII', () => {
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        expect(payload).toBeTruthy();
        expect(payload.teams.blue.score).toBe(3);
        expect(payload.teams.white.score).toBe(0);
        expect(payload.motm).toBe('Amar');

        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain('base64-secret-photo-should-not-leak');
        expect(serialized).not.toContain('secret@example.com');
        expect(payload.topPerformers[0].matchContributionRating).toBeGreaterThan(8);
    });

    test('getPunditPersonaForDate is deterministic per week and rotates weekly', () => {
        const friday = new Date('2026-11-13T22:00:00Z');
        const sameWeek = new Date('2026-11-14T10:00:00Z');
        const nextWeek = new Date('2026-11-20T22:00:00Z');

        const p1 = getPunditPersonaForDate(friday);
        expect(PUNDIT_PERSONAS).toContainEqual(p1);
        // Same ISO-style week window resolves to the same pundit
        expect(getPunditPersonaForDate(sameWeek).name).toBe(p1.name);
        // A week later rotates to the next pundit in the cast
        expect(getPunditPersonaForDate(nextWeek).name).not.toBe(p1.name);
    });

    test('buildVerifiedMatchPayload attaches a rotating pundit persona', () => {
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        expect(payload.punditPersona).toBeTruthy();
        expect(typeof payload.punditPersona.name).toBe('string');
        expect(PUNDIT_PERSONAS.map(p => p.name)).toContain(payload.punditPersona.name);
    });

    test('buildShareableRecapText produces a group-chat recap with score, analyst, and named pundit', () => {
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        const report = {
            analyst: {
                headline: 'Blue Cruise To A Clean Sheet',
                summary: 'Blue controlled the night and kept it tight at the back.',
                keyStats: ['Final Score: Blue 3 - 0 White', 'Amar: 2G 1A'],
                mvpAnalysis: 'Amar ran the show.'
            },
            pundit: {
                headline: 'Blue Were Sensational!',
                summary: 'That was a proper team performance from Blue tonight.',
                hotTake: 'Amar is the signing of the season, no doubt about it.'
            }
        };
        const persona = { name: 'Roy Keane', style: 'blunt' };
        const text = buildShareableRecapText(payload, report, persona);

        expect(text).toContain('FULL TIME');
        expect(text).toContain('Blue 3 – 0 White');
        expect(text).toContain('THE ANALYST');
        expect(text).toContain('Roy Keane');
        expect(text).toContain('Amar is the signing of the season');
    });

    test('validateAiReportResponse rejects invented match events (minutes, xG, possession, cards, VAR)', () => {
        const hallucinatedMinute = {
            ...validAiReport,
            pundit: {
                ...validAiReport.pundit,
                summary: 'Amar scored a screamer in the 89th minute to seal the win!'
            }
        };
        expect(validateAiReportResponse(hallucinatedMinute).valid).toBe(false);

        const hallucinatedXg = {
            ...validAiReport,
            analyst: {
                ...validAiReport.analyst,
                summary: 'Blue outperformed their 2.4 xG with clinical finishing and 65% possession.'
            }
        };
        expect(validateAiReportResponse(hallucinatedXg).valid).toBe(false);

        const hallucinatedCard = {
            ...validAiReport,
            pundit: {
                ...validAiReport.pundit,
                hotTake: 'After that late yellow card, White never recovered.'
            }
        };
        expect(validateAiReportResponse(hallucinatedCard).valid).toBe(false);
    });

    test('isMatchReportCachedAndValid validates fingerprint caching and invalidates after match corrections', () => {
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        const matchWithValidCache = {
            ...match,
            aiReports: {
                ...validAiReport,
                fingerprint: payload.fingerprint
            }
        };

        expect(isMatchReportCachedAndValid(matchWithValidCache)).toBe(true);

        // Simulate a stat correction on the match (Amar's goals corrected from 2 to 3)
        const correctedMatch = {
            ...matchWithValidCache,
            stats: {
                ...matchWithValidCache.stats,
                p1: { ...matchWithValidCache.stats.p1, goals: 3 }
            }
        };
        expect(isMatchReportCachedAndValid(correctedMatch)).toBe(false);
    });

    test('server route rejects non-POST requests with 405', async () => {
        const req = { method: 'GET', body: {} };
        const res = createMockRes();
        await matchReportHandler(req, res);
        expect(res.statusCode).toBe(405);
        expect(res.body.code).toBe('METHOD_NOT_ALLOWED');
    });

    test('server route returns 500 when OPENROUTER_API_KEY is missing', async () => {
        delete process.env.OPENROUTER_API_KEY;
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        const req = { method: 'POST', body: { payload } };
        const res = createMockRes();

        await matchReportHandler(req, res);
        expect(res.statusCode).toBe(500);
        expect(res.body.code).toBe('MISSING_API_KEY');
    });

    test('server route returns 400 when payload is missing or invalid', async () => {
        process.env.OPENROUTER_API_KEY = 'test-key';
        const req = { method: 'POST', body: { payload: { invalid: true } } };
        const res = createMockRes();

        await matchReportHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('INVALID_PAYLOAD');
    });

    test('server route handles OpenRouter upstream HTTP 429 rate limit and 500 errors gracefully', async () => {
        process.env.OPENROUTER_API_KEY = 'test-key';
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        const req = { method: 'POST', body: { payload } };
        const res = createMockRes();

        const mockRateLimitedFetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 429,
            json: async () => ({ error: { message: 'Rate limit exceeded' } })
        });

        await matchReportHandler(req, res, mockRateLimitedFetch);
        expect(res.statusCode).toBe(429);
        expect(res.body.code).toBe('RATE_LIMITED');
    });

    test('server route handles malformed JSON or hallucinated events from OpenRouter', async () => {
        process.env.OPENROUTER_API_KEY = 'test-key';
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        const req = { method: 'POST', body: { payload } };

        // 1. Malformed JSON
        const resMalformed = createMockRes();
        const mockMalformedFetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{ message: { content: 'Not valid JSON {{' } }]
            })
        });
        await matchReportHandler(req, resMalformed, mockMalformedFetch);
        expect(resMalformed.statusCode).toBe(502);
        expect(resMalformed.body.code).toBe('MALFORMED_AI_JSON');

        // 2. Hallucinated event in AI output
        const resHallucinated = createMockRes();
        const mockHallucinatedFetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            ...validAiReport,
                            analyst: {
                                ...validAiReport.analyst,
                                summary: 'Scored in the 42nd minute with 1.8 xG.'
                            }
                        })
                    }
                }]
            })
        });
        await matchReportHandler(req, resHallucinated, mockHallucinatedFetch);
        expect(resHallucinated.statusCode).toBe(422);
        expect(resHallucinated.body.code).toBe('AI_VALIDATION_FAILED');
    });

    test('server route uses anthropic/claude-haiku-5.5 and returns validated structured report on success', async () => {
        process.env.OPENROUTER_API_KEY = 'test-key-123';
        const payload = buildVerifiedMatchPayload(match, players, [match]);
        const req = { method: 'POST', body: { payload } };
        const res = createMockRes();

        let capturedRequestBody = null;
        const mockSuccessFetch = jest.fn().mockImplementation(async (url, options) => {
            capturedRequestBody = JSON.parse(options.body);
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [{ message: { content: JSON.stringify(validAiReport) } }]
                })
            };
        });

        await matchReportHandler(req, res, mockSuccessFetch);
        expect(res.statusCode).toBe(200);
        expect(capturedRequestBody.model).toBe('anthropic/claude-haiku-5.5');
        expect(res.body.model).toBe(OPENROUTER_MODEL);
        expect(res.body.report.analyst.headline).toBe(validAiReport.analyst.headline);
        expect(res.body.report.pundit.hotTake).toBe(validAiReport.pundit.hotTake);
    });

    test('client generateMatchReportFromServer handles network failures and non-OK responses', async () => {
        const payload = buildVerifiedMatchPayload(match, players, [match]);

        const failingNetworkFetch = jest.fn().mockRejectedValue(new Error('DNS lookup failed'));
        await expect(generateMatchReportFromServer(payload, failingNetworkFetch))
            .rejects
            .toThrow(/Network error contacting AI report server/i);

        const failingServerFetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'OPENROUTER_API_KEY is missing', code: 'MISSING_API_KEY' })
        });
        await expect(generateMatchReportFromServer(payload, failingServerFetch))
            .rejects
            .toThrow(/OPENROUTER_API_KEY is missing/i);
    });
});
