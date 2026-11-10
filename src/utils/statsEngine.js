import { isMatchIn2026 } from './helpers';
import { getMatchDate } from './matchHelpers';

// Default configurable weights for the 0-10 Match Contribution Rating (MCR)
export const DEFAULT_RATING_WEIGHTS = {
    baseline: 6.0,
    goalWeight: 1.0,
    assistWeight: 0.7,
    winBonus: 0.8,
    drawBonus: 0.3,
    lossPenalty: -0.3,
    cleanSheetBonus: 0.7,
    motmBonus: 0.8,
    hatTrickBonus: 0.5,
    ownGoalPenalty: -0.8,
    goalDiffMultiplier: 0.1,
    goalDiffCap: 0.5,
    minRating: 0.0,
    maxRating: 10.0
};

// Sanitize a numeric value safely
export const safeNum = (val, fallback = 0) => {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : fallback;
};

// Compute a deterministic fingerprint for a match to detect duplicate submissions or stat changes
export const computeMatchFingerprint = (match) => {
    if (!match || !match.stats || typeof match.stats !== 'object') return '';
    const stats = match.stats;
    const sortedPlayerIds = Object.keys(stats).sort();
    if (sortedPlayerIds.length === 0) return '';

    const playerPart = sortedPlayerIds.map(pid => {
        const s = stats[pid] || {};
        const team = s.team || 'blue';
        const g = Math.max(0, safeNum(s.goals));
        const a = Math.max(0, safeNum(s.assists));
        const og = Math.max(0, safeNum(s.ownGoals));
        const w = Math.max(0, safeNum(s.win));
        const cs = s.cleanSheet ? 1 : 0;
        const gf = Math.max(0, safeNum(s.goalsFor));
        const ga = Math.max(0, safeNum(s.goalsAgainst));
        return `${pid}:${team}:${g}:${a}:${og}:${w}:${cs}:${gf}:${ga}`;
    }).join('|');

    const motm = match.motm || '';
    const pkWinner = match.pkWinner || '';
    const bOg = Math.max(0, safeNum(match.blueOwnGoals));
    const wOg = Math.max(0, safeNum(match.whiteOwnGoals));
    const labels = match.teamLabels ? `${match.teamLabels.blue || 'Blue'}-${match.teamLabels.white || 'White'}` : 'Blue-White';

    return `${labels}#${motm}#${pkWinner}#${bOg}:${wOg}#${playerPart}`;
};

// Deduplicate and sanitize matches list:
// 1. Filters out null/invalid/empty matches
// 2. Deduplicates by match ID
// 3. Deduplicates rapid duplicate submissions (identical fingerprint within a 5-minute window, or when timestamp is pending)
export const deduplicateMatches = (matches = []) => {
    if (!Array.isArray(matches)) return [];

    const seenIds = new Set();
    const seenSignatures = new Map(); // fingerprint -> array of timestamps (ms)
    const cleanMatches = [];

    const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

    for (const match of matches) {
        if (!match || typeof match !== 'object') continue;
        if (!match.stats || typeof match.stats !== 'object') continue;

        const playerKeys = Object.keys(match.stats).filter(pid => match.stats[pid] && typeof match.stats[pid] === 'object');
        if (playerKeys.length === 0) continue;

        if (match.id) {
            if (seenIds.has(match.id)) continue;
            seenIds.add(match.id);
        }

        const fingerprint = computeMatchFingerprint(match);
        if (!fingerprint) continue;

        const matchDate = getMatchDate(match);
        const timeMs = matchDate ? matchDate.getTime() : null;

        if (seenSignatures.has(fingerprint)) {
            const prevTimes = seenSignatures.get(fingerprint);
            const isDuplicateSubmission = prevTimes.some(prevTime => {
                if (timeMs === null || prevTime === null) return true;
                return Math.abs(timeMs - prevTime) <= DUPLICATE_WINDOW_MS;
            });
            if (isDuplicateSubmission) {
                continue;
            }
            prevTimes.push(timeMs);
        } else {
            seenSignatures.set(fingerprint, [timeMs]);
        }

        cleanMatches.push(match);
    }

    // Sort newest first
    return cleanMatches.sort((a, b) => {
        const timeA = getMatchDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const timeB = getMatchDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return timeB - timeA;
    });
};

// Configurable 0-10 Match Contribution Rating (MCR) calculated purely in code
export const calculateMatchContributionRating = (playerMatchStats, isMotm = false, customWeights = {}) => {
    if (!playerMatchStats || typeof playerMatchStats !== 'object') return 0;

    const w = { ...DEFAULT_RATING_WEIGHTS, ...(customWeights || {}) };

    const goals = Math.max(0, safeNum(playerMatchStats.goals));
    const assists = Math.max(0, safeNum(playerMatchStats.assists));
    const ownGoals = Math.max(0, safeNum(playerMatchStats.ownGoals));
    const winVal = safeNum(playerMatchStats.win, 0);
    const cleanSheet = Boolean(playerMatchStats.cleanSheet);
    const goalsFor = Math.max(0, safeNum(playerMatchStats.goalsFor));
    const goalsAgainst = Math.max(0, safeNum(playerMatchStats.goalsAgainst));

    let rating = safeNum(w.baseline, 6.0);

    // Attacking contributions
    rating += goals * safeNum(w.goalWeight, 1.0);
    rating += assists * safeNum(w.assistWeight, 0.7);
    if (goals >= 3) {
        rating += safeNum(w.hatTrickBonus, 0.5);
    }

    // Match outcome bonus/penalty
    if (winVal >= 1) {
        rating += safeNum(w.winBonus, 0.8);
    } else if (winVal === 0.5) {
        rating += safeNum(w.drawBonus, 0.3);
    } else {
        rating += safeNum(w.lossPenalty, -0.3);
    }

    // Defensive & discipline contributions
    if (cleanSheet) {
        rating += safeNum(w.cleanSheetBonus, 0.7);
    }
    if (ownGoals > 0) {
        rating += ownGoals * safeNum(w.ownGoalPenalty, -0.8);
    }

    // Goal differential factor (capped)
    const goalDiff = goalsFor - goalsAgainst;
    const gdCap = Math.abs(safeNum(w.goalDiffCap, 0.5));
    const gdEffect = Math.max(-gdCap, Math.min(gdCap, goalDiff * safeNum(w.goalDiffMultiplier, 0.1)));
    rating += gdEffect;

    // Man of the Match bonus
    if (isMotm) {
        rating += safeNum(w.motmBonus, 0.8);
    }

    const minR = safeNum(w.minRating, 0.0);
    const maxR = safeNum(w.maxRating, 10.0);
    const clamped = Math.max(minR, Math.min(maxR, rating));

    return Number(clamped.toFixed(1));
};

// Calculate all players' MCR for a single match
export const calculateAllMatchRatings = (match, players = [], customWeights = {}) => {
    if (!match || !match.stats || typeof match.stats !== 'object') return {};

    const ratings = {};
    Object.keys(match.stats).forEach(pid => {
        const pStats = match.stats[pid];
        if (!pStats || typeof pStats !== 'object') return;
        const isMotm = match.motm === pid;
        const rating = calculateMatchContributionRating(pStats, isMotm, customWeights);
        const playerObj = players.find(p => p.id === pid);
        ratings[pid] = {
            playerId: pid,
            name: playerObj?.name || 'Unknown',
            team: pStats.team || 'blue',
            rating,
            goals: Math.max(0, safeNum(pStats.goals)),
            assists: Math.max(0, safeNum(pStats.assists)),
            ownGoals: Math.max(0, safeNum(pStats.ownGoals)),
            cleanSheet: Boolean(pStats.cleanSheet),
            win: safeNum(pStats.win, 0),
            isMotm
        };
    });

    return ratings;
};

// Calculate last-five-match form for a player in a given season ('all' or '2026')
export const getLastFiveForm = (player, matches = [], season = 'all', customWeights = {}) => {
    if (!player || !player.id) {
        return { results: [], detailed: [], summary: 'N/A', averageRating: 0 };
    }

    const cleanMatches = deduplicateMatches(matches);
    const seasonMatches = season === '2026' ? cleanMatches.filter(isMatchIn2026) : cleanMatches;

    // Repeat appearances across matches (including Big Night Game 1 and Game 2) are each distinct appearances,
    // ordered newest first. Within a single match object, player.id is keyed once.
    const playerAppearances = seasonMatches.filter(m => m.stats && m.stats[player.id] && typeof m.stats[player.id] === 'object');
    const lastFive = playerAppearances.slice(0, 5);

    const results = [];
    const detailed = [];
    let ratingSum = 0;

    lastFive.forEach(m => {
        const pStats = m.stats[player.id];
        const winVal = safeNum(pStats.win, 0);
        const resultChar = winVal >= 1 ? 'W' : winVal === 0.5 ? 'D' : 'L';
        const isMotm = m.motm === player.id;
        const rating = calculateMatchContributionRating(pStats, isMotm, customWeights);

        results.push(resultChar);
        ratingSum += rating;
        detailed.push({
            matchId: m.id,
            result: resultChar,
            goals: Math.max(0, safeNum(pStats.goals)),
            assists: Math.max(0, safeNum(pStats.assists)),
            cleanSheet: Boolean(pStats.cleanSheet),
            isMotm,
            rating
        });
    });

    return {
        results,
        detailed,
        summary: results.length > 0 ? results.join('-') : 'No recent matches',
        averageRating: results.length > 0 ? Number((ratingSum / results.length).toFixed(1)) : 0
    };
};

// Calculate Premier League-style leaderboards: Golden Boot, Playmaker, Most Wins, Clean Sheets
export const getPremierLeagueLeaderboards = (players = [], matches = [], season = '2026', customWeights = {}, getPlayerStatsFn = null) => {
    if (!Array.isArray(players) || players.length === 0) {
        return {
            goldenBoot: [],
            playmaker: [],
            mostWins: [],
            cleanSheets: [],
            matchRating: []
        };
    }

    const cleanMatches = deduplicateMatches(matches);

    const enrichedPlayers = players
        .filter(p => p && p.id && p.name)
        .map(p => {
            const stats = getPlayerStatsFn
                ? getPlayerStatsFn(p, cleanMatches, season, customWeights)
                : { goals: 0, assists: 0, wins: 0, cleanSheets: 0, gamesPlayed: 0, goalsPerGame: 0, assistsPerGame: 0, winRate: 0, avgMatchRating: 0 };
            return {
                ...p,
                ...stats
            };
        })
        .filter(p => p.gamesPlayed > 0);

    // 1. Golden Boot: Most Goals (Tiebreakers: Higher Goals/App -> More Assists -> Fewer Games Played)
    const goldenBoot = [...enrichedPlayers]
        .filter(p => p.goals > 0)
        .sort((a, b) => {
            if (b.goals !== a.goals) return b.goals - a.goals;
            if (b.goalsPerGame !== a.goalsPerGame) return b.goalsPerGame - a.goalsPerGame;
            if (b.assists !== a.assists) return b.assists - a.assists;
            return a.gamesPlayed - b.gamesPlayed;
        });

    // 2. Playmaker: Most Assists (Tiebreakers: Higher Assists/App -> More Goals -> Fewer Games Played)
    const playmaker = [...enrichedPlayers]
        .filter(p => p.assists > 0)
        .sort((a, b) => {
            if (b.assists !== a.assists) return b.assists - a.assists;
            if (b.assistsPerGame !== a.assistsPerGame) return b.assistsPerGame - a.assistsPerGame;
            if (b.goals !== a.goals) return b.goals - a.goals;
            return a.gamesPlayed - b.gamesPlayed;
        });

    // 3. Most Wins: Highest Wins total (Tiebreakers: Higher Win % -> Higher Goal Contributions -> Fewer Games Played)
    const mostWins = [...enrichedPlayers]
        .filter(p => p.wins > 0)
        .sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            if (b.goalContrib !== a.goalContrib) return b.goalContrib - a.goalContrib;
            return a.gamesPlayed - b.gamesPlayed;
        });

    // 4. Clean Sheets: Most Clean Sheets (Tiebreakers: Higher CS ratio -> Fewer Goals Against -> More Wins)
    const cleanSheets = [...enrichedPlayers]
        .filter(p => p.cleanSheets > 0)
        .sort((a, b) => {
            if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
            const csRateA = a.gamesPlayed > 0 ? a.cleanSheets / a.gamesPlayed : 0;
            const csRateB = b.gamesPlayed > 0 ? b.cleanSheets / b.gamesPlayed : 0;
            if (csRateB !== csRateA) return csRateB - csRateA;
            if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
            return b.wins - a.wins;
        });

    // 5. Match Contribution Rating (0-10) Leaderboard (for players with tracked match appearances)
    const matchRating = [...enrichedPlayers]
        .filter(p => (p.trackedMatchesPlayed || 0) > 0 && (p.avgMatchRating || 0) > 0)
        .sort((a, b) => {
            if (b.avgMatchRating !== a.avgMatchRating) return b.avgMatchRating - a.avgMatchRating;
            return b.goalContrib - a.goalContrib;
        });

    return {
        goldenBoot,
        playmaker,
        mostWins,
        cleanSheets,
        matchRating
    };
};
