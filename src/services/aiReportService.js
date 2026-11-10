import { computeMatchFingerprint, calculateAllMatchRatings, safeNum } from '../utils/statsEngine';
import { getPlayerStats } from '../utils/helpers';
import { formatMatchDate, getMatchDate } from '../utils/matchHelpers';

export const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';

// Rotating cast of real TV pundits — the "Pundit" voice changes each week.
export const PUNDIT_PERSONAS = [
    { name: 'Gary Neville', style: 'sharp, forensic tactical breakdowns with strong, high-profile opinions' },
    { name: 'Jamie Carragher', style: 'energetic, humorous, scouse-accented sharp analysis, loves a debate' },
    { name: 'Alan Shearer', style: 'straightforward, no-nonsense striker\'s view, focused on goals and finishing' },
    { name: 'Roy Keane', style: 'blunt, uncompromising, brutally honest and controversial takes, demands standards' },
    { name: 'Ally McCoist', style: 'lighthearted, infectiously enthusiastic, warm and knowledgeable banter' },
    { name: 'Alex Scott', style: 'polished, insightful presenter-analyst, balanced and modern' },
    { name: 'Thierry Henry', style: 'calm, intelligent, elegant and entertaining studio insight' },
    { name: 'Micah Richards', style: 'infectious energy, big laughs and dynamic, playful banter' },
    { name: 'Robbie Earle', style: 'measured Premier League analysis pitched for a US audience' },
    { name: 'Tim Howard', style: 'goalkeeper\'s perspective, passionate American voice on the Premier League' }
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Deterministically pick a pundit for a given date — same match always maps to
// the same persona, and the cast rotates week to week.
export const getPunditPersonaForDate = (date) => {
    const validDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const weekIndex = Math.floor(validDate.getTime() / WEEK_MS);
    const personaIndex = ((weekIndex % PUNDIT_PERSONAS.length) + PUNDIT_PERSONAS.length) % PUNDIT_PERSONAS.length;
    return PUNDIT_PERSONAS[personaIndex];
};

export const getPunditPersonaForMatch = (match) => getPunditPersonaForDate(getMatchDate(match));

// Patterns representing unverified or invented football telemetry that we never track
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

// Build a minimal, verified, deterministic payload of match statistics for AI report generation
export const buildVerifiedMatchPayload = (match, players = [], allMatches = [], customWeights = {}) => {
    if (!match || !match.stats || typeof match.stats !== 'object') {
        return null;
    }

    const playerIds = Object.keys(match.stats).filter(pid => match.stats[pid] && typeof match.stats[pid] === 'object');
    if (playerIds.length === 0) return null;

    const firstStats = match.stats[playerIds[0]];
    const firstIsBlue = firstStats.team === 'blue';
    const blueScore = firstIsBlue ? Math.max(0, safeNum(firstStats.goalsFor)) : Math.max(0, safeNum(firstStats.goalsAgainst));
    const whiteScore = firstIsBlue ? Math.max(0, safeNum(firstStats.goalsAgainst)) : Math.max(0, safeNum(firstStats.goalsFor));

    const labels = match.teamLabels || { blue: 'Blue', white: 'White' };
    const isDraw = blueScore === whiteScore;
    let winnerLabel = 'Draw';
    if (blueScore > whiteScore) winnerLabel = labels.blue;
    else if (whiteScore > blueScore) winnerLabel = labels.white;
    else if (match.pkWinner) winnerLabel = `${match.pkWinner === 'blue' ? labels.blue : labels.white} (on penalties)`;

    const ratingsMap = calculateAllMatchRatings(match, players, customWeights);
    const motmPlayer = match.motm ? players.find(p => p.id === match.motm) : null;

    const verifiedPerformances = playerIds.map(pid => {
        const pStats = match.stats[pid];
        const playerObj = players.find(p => p.id === pid);
        const name = playerObj?.name || 'Unknown';
        const teamLabel = pStats.team === 'blue' ? labels.blue : labels.white;
        const mcr = ratingsMap[pid]?.rating ?? 6.0;
        const seasonStats = playerObj ? getPlayerStats(playerObj, allMatches, '2026', customWeights) : null;

        return {
            name,
            team: teamLabel,
            goals: Math.max(0, safeNum(pStats.goals)),
            assists: Math.max(0, safeNum(pStats.assists)),
            goalContributions: Math.max(0, safeNum(pStats.goals)) + Math.max(0, safeNum(pStats.assists)),
            ownGoals: Math.max(0, safeNum(pStats.ownGoals)),
            cleanSheet: Boolean(pStats.cleanSheet),
            isMotm: match.motm === pid,
            matchContributionRating: mcr,
            seasonContext: seasonStats ? {
                gamesPlayed: seasonStats.gamesPlayed,
                seasonGoals: seasonStats.goals,
                seasonAssists: seasonStats.assists,
                lastFiveForm: seasonStats.lastFiveFormSummary
            } : null
        };
    }).sort((a, b) => b.matchContributionRating - a.matchContributionRating);

    return {
        matchId: match.id || 'pending',
        fingerprint: computeMatchFingerprint(match),
        dateLabel: formatMatchDate(match),
        punditPersona: getPunditPersonaForMatch(match),
        teams: {
            blue: {
                name: labels.blue,
                score: blueScore,
                cleanSheet: whiteScore === 0,
                teamOwnGoalsCredited: Math.max(0, safeNum(match.blueOwnGoals))
            },
            white: {
                name: labels.white,
                score: whiteScore,
                cleanSheet: blueScore === 0,
                teamOwnGoalsCredited: Math.max(0, safeNum(match.whiteOwnGoals))
            }
        },
        outcome: {
            winner: winnerLabel,
            isDraw,
            wentToPenalties: isDraw && Boolean(match.pkWinner)
        },
        motm: motmPlayer ? motmPlayer.name : null,
        topPerformers: verifiedPerformances.slice(0, 6),
        allRosterPerformances: verifiedPerformances
    };
};

// Sanitize a text block to strip any prohibited hallucinated telemetry if present
const sanitizeTextSegment = (text) => {
    if (typeof text !== 'string') return '';
    let cleaned = text.trim();
    PROHIBITED_HALLUCINATION_PATTERNS.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '[verified stat]');
    });
    return cleaned;
};

// Validate and sanitize the structured AI response object
export const validateAiReportResponse = (rawResponse, verifiedPayload = null) => {
    if (!rawResponse || typeof rawResponse !== 'object') {
        return { valid: false, error: 'AI response is not a valid JSON object.' };
    }

    const { analyst, pundit } = rawResponse;
    if (!analyst || typeof analyst !== 'object') {
        return { valid: false, error: 'Missing "analyst" mode section in AI response.' };
    }
    if (!pundit || typeof pundit !== 'object') {
        return { valid: false, error: 'Missing "pundit" mode section in AI response.' };
    }

    if (typeof analyst.headline !== 'string' || !analyst.headline.trim()) {
        return { valid: false, error: 'Analyst headline is required.' };
    }
    if (typeof analyst.summary !== 'string' || !analyst.summary.trim()) {
        return { valid: false, error: 'Analyst summary is required.' };
    }
    if (!Array.isArray(analyst.keyStats) || analyst.keyStats.length === 0) {
        return { valid: false, error: 'Analyst keyStats must be a non-empty array.' };
    }

    if (typeof pundit.headline !== 'string' || !pundit.headline.trim()) {
        return { valid: false, error: 'Pundit headline is required.' };
    }
    if (typeof pundit.summary !== 'string' || !pundit.summary.trim()) {
        return { valid: false, error: 'Pundit summary is required.' };
    }
    if (typeof pundit.hotTake !== 'string' || !pundit.hotTake.trim()) {
        return { valid: false, error: 'Pundit hotTake is required.' };
    }

    // Check for prohibited hallucinated match events across all fields
    const combinedText = [
        analyst.headline,
        analyst.summary,
        analyst.mvpAnalysis || '',
        ...analyst.keyStats,
        pundit.headline,
        pundit.summary,
        pundit.hotTake
    ].join(' ');

    for (const pattern of PROHIBITED_HALLUCINATION_PATTERNS) {
        if (pattern.test(combinedText)) {
            return {
                valid: false,
                error: `Prohibited invented match event detected matching ${pattern.toString()}.`
            };
        }
    }

    // Verify that if a scoreline is mentioned or verifiedPayload is provided, we sanitize strings cleanly
    const validatedReport = {
        analyst: {
            headline: sanitizeTextSegment(analyst.headline),
            summary: sanitizeTextSegment(analyst.summary),
            keyStats: analyst.keyStats.slice(0, 5).map(s => sanitizeTextSegment(String(s))).filter(Boolean),
            mvpAnalysis: sanitizeTextSegment(analyst.mvpAnalysis || '')
        },
        pundit: {
            headline: sanitizeTextSegment(pundit.headline),
            summary: sanitizeTextSegment(pundit.summary),
            hotTake: sanitizeTextSegment(pundit.hotTake)
        }
    };

    return { valid: true, data: validatedReport };
};

// Deterministic fallback report generator based strictly on verified code calculations
// Used when offline or if the server route is unreachable, while still surfacing clear status
export const buildDeterministicFallbackReport = (verifiedPayload) => {
    if (!verifiedPayload) return null;

    const { teams, outcome, motm, topPerformers } = verifiedPayload;
    const blue = teams.blue;
    const white = teams.white;
    const leader = topPerformers?.[0];
    const second = topPerformers?.[1];

    const scoreStr = `${blue.name} ${blue.score} - ${white.score} ${white.name}`;
    const mvpText = leader
        ? `${leader.name} (${leader.team}) posted a ${leader.matchContributionRating.toFixed(1)}/10 Match Contribution Rating with ${leader.goals}G and ${leader.assists}A.`
        : 'Balanced squad contributions across the pitch.';

    const keyStats = [
        `Final Score: ${scoreStr} (${outcome.winner})`,
        ...(leader ? [`Top Match Rating: ${leader.name} (${leader.matchContributionRating.toFixed(1)}/10 — ${leader.goals}G, ${leader.assists}A)`] : []),
        ...(second ? [`Runner-Up Rating: ${second.name} (${second.matchContributionRating.toFixed(1)}/10 — ${second.goals}G, ${second.assists}A)`] : []),
        ...(motm ? [`Man of the Match Vote Winner: ${motm}`] : []),
        ...(blue.cleanSheet ? [`${blue.name} recorded a verified team clean sheet.`] : []),
        ...(white.cleanSheet ? [`${white.name} recorded a verified team clean sheet.`] : [])
    ].slice(0, 4);

    return {
        analyst: {
            headline: `${outcome.winner === 'Draw' ? 'Stalemate' : outcome.winner + ' Victory'}: ${scoreStr}`,
            summary: `${blue.name} and ${white.name} combined for ${blue.score + white.score} total goals. ${mvpText}`,
            keyStats,
            mvpAnalysis: mvpText
        },
        pundit: {
            headline: leader && leader.goals >= 2
                ? `${leader.name} Steals the Friday Night Spotlight!`
                : `Friday Night Drama: ${scoreStr}!`,
            summary: `${outcome.winner === 'Draw' ? 'Neither side would blink under the Friday night lights!' : `${outcome.winner} came to play and left no doubt on the scoreboard!`} ${leader ? `${leader.name} led the charge with a ${leader.matchContributionRating.toFixed(1)} rating.` : ''}`,
            hotTake: leader
                ? `With a ${leader.matchContributionRating.toFixed(1)}/10 rating tonight, ${leader.name} is setting the standard for the 2026 campaign.`
                : `Defense wins championships, and tonight's numbers prove every goal contribution matters.`
        }
    };
};

// Build a WhatsApp/group-chat friendly full-time recap: score + Analyst + Pundit.
export const buildShareableRecapText = (verifiedPayload, report, persona = null) => {
    if (!verifiedPayload || !report || !report.analyst || !report.pundit) return '';

    const { teams, outcome, motm, topPerformers, dateLabel } = verifiedPayload;
    const blue = teams.blue;
    const white = teams.white;
    const activePersona = persona || verifiedPayload.punditPersona || { name: 'The Studio' };

    const scoreLine = `🔵 ${blue.name} ${blue.score} – ${white.score} ${white.name} ⚪️`;
    let resultLine;
    if (outcome.isDraw) {
        resultLine = outcome.wentToPenalties ? `🏆 ${outcome.winner}` : '🤝 Honours even — it\'s a draw';
    } else {
        resultLine = `🏆 ${outcome.winner} win`;
    }

    const lines = [
        '⚽ FRIDAY NIGHT FOOTBALL — FULL TIME 📣',
        dateLabel ? `📅 ${dateLabel}` : null,
        '',
        scoreLine,
        resultLine,
        motm ? `⭐ MOTM: ${motm}` : null,
        '',
        '📊 THE ANALYST',
        report.analyst.headline,
        report.analyst.summary,
        ...(report.analyst.keyStats || []).map((stat) => `• ${stat}`),
        '',
        `🎙️ IN THE STUDIO — ${activePersona.name}`,
        report.pundit.headline,
        report.pundit.summary,
        `🔥 ${report.pundit.hotTake}`
    ];

    const top3 = (topPerformers || []).slice(0, 3);
    if (top3.length > 0) {
        lines.push('', '🌟 TOP RATINGS (0–10)');
        top3.forEach((perf, idx) => {
            const extras = [
                perf.goals ? `${perf.goals}G` : null,
                perf.assists ? `${perf.assists}A` : null,
                perf.cleanSheet ? 'CS' : null
            ].filter(Boolean).join(' ');
            lines.push(
                `${idx + 1}. ${perf.name} — ${perf.matchContributionRating.toFixed(1)}${extras ? ` (${extras})` : ''}`
            );
        });
    }

    lines.push('', 'FRIDAY NIGHT LIGHTS. SEE YOU NEXT WEEK, LADS! ⚽🔥');

    return lines.filter((line) => line !== null).join('\n');
};

// Check whether a match already has a valid cached AI report for its current stats fingerprint
export const isMatchReportCachedAndValid = (match) => {
    if (!match || !match.aiReports) return false;
    const currentFingerprint = computeMatchFingerprint(match);
    if (!currentFingerprint) return false;
    if (match.aiReports.fingerprint !== currentFingerprint) return false;
    const validation = validateAiReportResponse(match.aiReports);
    return validation.valid;
};

// Request AI match report from the secure server route (/api/match-report)
export const generateMatchReportFromServer = async (verifiedPayload, fetchImpl = fetch) => {
    if (!verifiedPayload || typeof verifiedPayload !== 'object') {
        throw new Error('Verified match statistics payload is required.');
    }

    let response;
    try {
        response = await fetchImpl('/api/match-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ payload: verifiedPayload })
        });
    } catch (networkErr) {
        const err = new Error(`Network error contacting AI report server: ${networkErr.message || 'Failed to fetch'}`);
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

    const reportCandidate = body?.report || body;
    const validation = validateAiReportResponse(reportCandidate, verifiedPayload);
    if (!validation.valid) {
        const err = new Error(`AI response validation failed: ${validation.error}`);
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    return {
        ...validation.data,
        fingerprint: verifiedPayload.fingerprint,
        model: body?.model || OPENROUTER_MODEL,
        generatedAt: body?.generatedAt || new Date().toISOString(),
        source: body?.source || 'openrouter'
    };
};
