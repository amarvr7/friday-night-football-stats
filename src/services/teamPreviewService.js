import { calculateTeamChemistry, findCrossTeamRivalries } from '../utils/teamChemistry';

export const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';
export const DEFAULT_KICKOFF_TIME = '5:00 PM';

// Build a verified, deterministic payload for the AI hype write-up. Only real
// roster, rating, chemistry, and rivalry data is sent — nothing invented.
export const buildTeamPreviewPayload = ({
    blueTeam = [],
    whiteTeam = [],
    matches = [],
    getDynamicRating,
    kickoffTime = DEFAULT_KICKOFF_TIME
}) => {
    if (!Array.isArray(blueTeam) || !Array.isArray(whiteTeam)) return null;
    if (blueTeam.length === 0 || whiteTeam.length === 0) return null;

    const rate = typeof getDynamicRating === 'function' ? getDynamicRating : () => null;

    const mapRoster = (list) =>
        list.map((p) => ({ name: p.name, rating: rate(p) }));

    const blueChem = calculateTeamChemistry(blueTeam, matches);
    const whiteChem = calculateTeamChemistry(whiteTeam, matches);
    const rivalries = findCrossTeamRivalries(blueTeam, whiteTeam, matches);

    const avg = (list) => {
        const rated = list.map((p) => rate(p)).filter((r) => typeof r === 'number');
        if (rated.length === 0) return null;
        return Math.round(rated.reduce((acc, r) => acc + r, 0) / rated.length);
    };

    return {
        kickoffTime,
        teams: {
            blue: mapRoster(blueTeam),
            white: mapRoster(whiteTeam)
        },
        teamAverages: {
            blue: avg(blueTeam),
            white: avg(whiteTeam)
        },
        chemistry: {
            blue: { score: blueChem.score, label: blueChem.label },
            white: { score: whiteChem.score, label: whiteChem.label }
        },
        rivalries: rivalries.map((r) => ({
            players: [r.a, r.b],
            gamesTogether: r.gamesTogether
        }))
    };
};

// Deterministic fallback announcement used when the AI route is unreachable.
export const buildDeterministicTeamPreview = (payload) => {
    if (!payload) return null;
    const { teams, kickoffTime } = payload;
    const time = kickoffTime || DEFAULT_KICKOFF_TIME;

    const bulletList = (list) => list.map((p) => `• ${p.name}`).join('\n');

    const chem = payload.chemistry || {};
    const blueChem = chem.blue;
    const whiteChem = chem.white;
    const chemLine =
        blueChem && whiteChem
            ? ` On paper Blue bring ${blueChem.label.toLowerCase()} chemistry (${blueChem.score}) and White ${whiteChem.label.toLowerCase()} (${whiteChem.score}) — but chemistry only gets you so far, anyone can cause an upset! 🔗`
            : '';

    const rivalryLine =
        payload.rivalries && payload.rivalries.length > 0
            ? `Some familiar faces on opposite sides tonight — expect a little friendly rivalry and plenty of goals! 👀⚽${chemLine}`
            : `Fresh matchup this week with everything to play for — should be a good one! 👀⚽${chemLine}`;

    return [
        '🏟️ FRIDAY NIGHT FOOTBALL IS BACK! ⚽🔥',
        '',
        'Another Friday, another chance to finish the week with some good football, lads!',
        '',
        `**Game tomorrow at ${time} sharp!**`,
        '',
        "Please get there a little early, get loose, warm up properly, and get those legs moving. Remember, we're here to score goals, not collect injuries! 😂",
        '',
        '🔵 BLUE TEAM',
        bulletList(teams.blue),
        '',
        '⚪️ WHITE TEAM',
        bulletList(teams.white),
        '',
        rivalryLine,
        '',
        'Amar will be tracking the stats. Goals, assists, clean sheets, everything counts! 📊',
        '',
        "As always, compete hard, respect each other, and enjoy the game. It's a great way to finish the week with good people and some good football!",
        '',
        `**FRIDAY. ${time}. FRIDAY NIGHT LIGHTS!**`,
        '',
        "LET'S GET IT, LADS! ⚽🔥"
    ].join('\n');
};

// Request the AI hype write-up from the secure server route, falling back to the
// deterministic version on any failure so the user always gets a message.
export const generateTeamPreviewFromServer = async (payload, fetchImpl = fetch) => {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Team preview payload is required.');
    }

    let response;
    try {
        response = await fetchImpl('/api/team-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload })
        });
    } catch (networkErr) {
        const err = new Error(`Network error contacting team preview server: ${networkErr.message || 'Failed to fetch'}`);
        err.code = 'NETWORK_ERROR';
        throw err;
    }

    let body = null;
    try {
        body = await response.json();
    } catch (parseErr) {
        const err = new Error(`Invalid JSON response from server (HTTP ${response.status}).`);
        err.code = 'INVALID_SERVER_JSON';
        err.status = response.status;
        throw err;
    }

    if (!response.ok) {
        const err = new Error(body?.error || `Server returned HTTP ${response.status}`);
        err.code = body?.code || 'SERVER_ERROR';
        err.status = response.status;
        throw err;
    }

    const message = body?.preview?.message;
    if (typeof message !== 'string' || !message.trim()) {
        const err = new Error('Team preview response was empty or malformed.');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    return {
        message: message.trim(),
        model: body?.model || OPENROUTER_MODEL,
        generatedAt: body?.generatedAt || new Date().toISOString(),
        source: body?.source || 'openrouter'
    };
};
