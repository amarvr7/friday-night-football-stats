import { isMatchIn2026 } from './helpers';

const DEFAULT_LABELS = { blue: 'Blue', white: 'White' };

// Convert any supported Firestore/JS date shape into a Date (or null)
export const getMatchDate = (match) => {
    if (!match?.date) return null;
    if (typeof match.date.seconds === 'number') return new Date(match.date.seconds * 1000);
    if (typeof match.date.toDate === 'function') return match.date.toDate();
    const parsed = new Date(match.date);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export const formatMatchDate = (match, options = { day: 'numeric', month: 'short' }) => {
    const date = getMatchDate(match);
    if (!date) return 'Just now';
    return date.toLocaleDateString(undefined, options);
};

export const isSameCalendarDay = (a, b) => {
    const dateA = getMatchDate(a);
    const dateB = getMatchDate(b);
    if (!dateA || !dateB) return false;
    return dateA.toDateString() === dateB.toDateString();
};

// Filter matches down to the requested season ('all' or '2026')
export const filterMatchesBySeason = (matches = [], season = 'all') => {
    if (season === 'all') return matches;
    return matches.filter(isMatchIn2026);
};

// Goals/assists/own-goal events credited to a team, built from per-player stats
const buildTeamEvents = (match, teamColor, players) => {
    const events = [];
    const otherTeamColor = teamColor === 'blue' ? 'white' : 'blue';
    const stats = match.stats || {};

    Object.keys(stats).forEach(pid => {
        const pStats = stats[pid];
        const name = players.find(p => p.id === pid)?.name || 'Unknown';
        if (pStats.team === teamColor) {
            if ((pStats.goals || 0) > 0) events.push({ type: 'goal', player: name, playerId: pid, count: pStats.goals });
            if ((pStats.assists || 0) > 0) events.push({ type: 'assist', player: name, playerId: pid, count: pStats.assists });
        }
        if (pStats.team === otherTeamColor && (pStats.ownGoals || 0) > 0) {
            events.push({ type: 'own_goal', player: name, playerId: pid, count: pStats.ownGoals });
        }
    });

    const teamOwnGoals = teamColor === 'blue' ? (match.blueOwnGoals || 0) : (match.whiteOwnGoals || 0);
    if (teamOwnGoals > 0) events.push({ type: 'own_goal', player: 'Team OG', playerId: null, count: teamOwnGoals });

    return events;
};

// Single source of truth for everything a UI needs to render a match
export const getMatchSummary = (match, players = []) => {
    const stats = match?.stats || {};
    const playerIds = Object.keys(stats);
    if (playerIds.length === 0) return null;

    const firstPlayer = stats[playerIds[0]];
    const firstIsBlue = firstPlayer.team === 'blue';
    const blueScore = firstIsBlue ? (firstPlayer.goalsFor || 0) : (firstPlayer.goalsAgainst || 0);
    const whiteScore = firstIsBlue ? (firstPlayer.goalsAgainst || 0) : (firstPlayer.goalsFor || 0);
    const labels = match.teamLabels || DEFAULT_LABELS;
    const isRedGreen = labels.blue === 'Red';
    const isDraw = blueScore === whiteScore;

    let winner = null;
    if (blueScore > whiteScore) winner = 'blue';
    else if (whiteScore > blueScore) winner = 'white';
    else if (match.pkWinner) winner = match.pkWinner;

    const motmPlayer = match.motm ? players.find(p => p.id === match.motm) || null : null;

    return {
        id: match.id,
        date: getMatchDate(match),
        dateLabel: formatMatchDate(match),
        blueScore,
        whiteScore,
        labels,
        isRedGreen,
        isDraw,
        winner,
        wentToPks: isDraw && !!match.pkWinner,
        pkWinner: match.pkWinner || null,
        motmPlayer,
        blueEvents: buildTeamEvents(match, 'blue', players),
        whiteEvents: buildTeamEvents(match, 'white', players),
        bluePlayerIds: playerIds.filter(pid => stats[pid].team === 'blue'),
        whitePlayerIds: playerIds.filter(pid => stats[pid].team === 'white')
    };
};

// 'W' | 'D' | 'L' for a player in a match (PK wins count as wins, matching stat logic)
export const getPlayerResult = (match, playerId) => {
    const pStats = match?.stats?.[playerId];
    if (!pStats) return null;
    const win = Number(pStats.win) || 0;
    if (win >= 1) return 'W';
    if (win === 0.5) return 'D';
    return 'L';
};

// One row per match a player appeared in, newest first
export const getPlayerMatchLog = (player, matches = [], players = [], season = 'all') => {
    if (!player) return [];
    return filterMatchesBySeason(matches, season)
        .filter(m => m.stats && m.stats[player.id])
        .map(m => {
            const summary = getMatchSummary(m, players);
            const pStats = m.stats[player.id];
            const isBlue = pStats.team === 'blue';
            return {
                id: m.id,
                summary,
                team: pStats.team,
                teamLabel: isBlue ? summary.labels.blue : summary.labels.white,
                opponentLabel: isBlue ? summary.labels.white : summary.labels.blue,
                teamScore: isBlue ? summary.blueScore : summary.whiteScore,
                opponentScore: isBlue ? summary.whiteScore : summary.blueScore,
                result: getPlayerResult(m, player.id),
                goals: Number(pStats.goals) || 0,
                assists: Number(pStats.assists) || 0,
                ownGoals: Number(pStats.ownGoals) || 0,
                cleanSheet: !!pStats.cleanSheet,
                isMotm: m.motm === player.id
            };
        });
};

// Record between two players: when on the same team, and when facing each other
export const getHeadToHead = (playerAId, playerBId, matches = [], season = 'all') => {
    const together = { played: 0, wins: 0, draws: 0, losses: 0 };
    const against = { played: 0, aWins: 0, bWins: 0, draws: 0 };

    filterMatchesBySeason(matches, season).forEach(m => {
        const aStats = m.stats?.[playerAId];
        const bStats = m.stats?.[playerBId];
        if (!aStats || !bStats) return;

        const aResult = getPlayerResult(m, playerAId);
        if (aStats.team === bStats.team) {
            together.played++;
            if (aResult === 'W') together.wins++;
            else if (aResult === 'D') together.draws++;
            else together.losses++;
            return;
        }

        against.played++;
        if (aResult === 'W') against.aWins++;
        else if (aResult === 'D') against.draws++;
        else against.bWins++;
    });

    return { together, against };
};
