import { deduplicateMatches, safeNum } from './statsEngine';

// Old-school FIFA-style team chemistry, computed deterministically from real
// shared match history. Two players "link" based on how often they've played on
// the SAME team and how well that pairing performed (win rate + combined goal
// contributions). Bayesian smoothing keeps tiny samples from spiking, and
// unproven pairings settle toward a "cold" baseline (FIFA's no-link feel).

const PRIOR_GAMES = 3; // Bayesian prior weight (games) pulling toward neutral
const NEUTRAL_WIN_RATE = 0.5;
const COLD_BASELINE = 45; // link strength for never-played-together pairs
const NEUTRAL_LINK = 50; // baseline before win/goal adjustments

const pairKey = (idA, idB) => (idA < idB ? `${idA}__${idB}` : `${idB}__${idA}`);

// Build a lookup of every teammate pairing across all historical matches.
const buildPairHistory = (matches = []) => {
    const history = new Map();
    const cleanMatches = deduplicateMatches(matches);

    cleanMatches.forEach((match) => {
        if (!match || !match.stats || typeof match.stats !== 'object') return;

        const byTeam = { blue: [], white: [] };
        Object.keys(match.stats).forEach((pid) => {
            const pStats = match.stats[pid];
            if (!pStats || typeof pStats !== 'object') return;
            if (pStats.team !== 'blue' && pStats.team !== 'white') return;
            byTeam[pStats.team].push({ id: pid, stats: pStats });
        });

        ['blue', 'white'].forEach((teamKey) => {
            const roster = byTeam[teamKey];
            if (roster.length < 2) return;

            // Did this team win the match?
            const sample = roster[0].stats;
            const goalsFor = Math.max(0, safeNum(sample.goalsFor));
            const goalsAgainst = Math.max(0, safeNum(sample.goalsAgainst));
            const didWin = goalsFor > goalsAgainst;

            for (let i = 0; i < roster.length; i += 1) {
                for (let j = i + 1; j < roster.length; j += 1) {
                    const a = roster[i];
                    const b = roster[j];
                    const key = pairKey(a.id, b.id);
                    const entry = history.get(key) || {
                        games: 0,
                        wins: 0,
                        goalContrib: 0
                    };
                    entry.games += 1;
                    if (didWin) entry.wins += 1;
                    entry.goalContrib +=
                        Math.max(0, safeNum(a.stats.goals)) +
                        Math.max(0, safeNum(a.stats.assists)) +
                        Math.max(0, safeNum(b.stats.goals)) +
                        Math.max(0, safeNum(b.stats.assists));
                    history.set(key, entry);
                }
            }
        });
    });

    return history;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Link strength (0-100) between two players from their shared history entry.
const computeLinkStrength = (entry) => {
    if (!entry || entry.games === 0) return COLD_BASELINE;

    const smoothedWinRate =
        (entry.wins + NEUTRAL_WIN_RATE * PRIOR_GAMES) / (entry.games + PRIOR_GAMES);
    const winComponent = (smoothedWinRate - NEUTRAL_WIN_RATE) * 80; // -40..+40

    const goalContribPerGame = entry.goalContrib / entry.games;
    const goalComponent = (Math.min(goalContribPerGame, 5) / 5) * 10; // 0..10

    const rawLink = NEUTRAL_LINK + winComponent + goalComponent;

    // Blend toward the cold baseline when the pairing is unproven.
    const confidence = entry.games / (entry.games + PRIOR_GAMES);
    const link = COLD_BASELINE * (1 - confidence) + rawLink * confidence;

    return clamp(link, 0, 100);
};

export const getChemistryLabel = (score) => {
    if (score >= 80) return 'On Fire';
    if (score >= 70) return 'Strong';
    if (score >= 60) return 'Solid';
    if (score >= 50) return 'Balanced';
    return 'Cold';
};

// Compute FIFA-style chemistry for a single team roster.
// Returns an overall 0-100 score plus each player's chemistry and best link.
export const calculateTeamChemistry = (teamPlayers = [], matches = []) => {
    const roster = (teamPlayers || []).filter((p) => p && p.id);

    if (roster.length === 0) {
        return { score: 0, label: 'Cold', players: [] };
    }

    const history = buildPairHistory(matches);

    const playerChem = roster.map((player) => {
        const teammates = roster.filter((other) => other.id !== player.id);

        if (teammates.length === 0) {
            return { id: player.id, name: player.name, chem: COLD_BASELINE, topLink: null };
        }

        let strongest = null;
        const linkSum = teammates.reduce((acc, teammate) => {
            const entry = history.get(pairKey(player.id, teammate.id));
            const strength = computeLinkStrength(entry);
            if (!strongest || strength > strongest.strength) {
                strongest = { name: teammate.name, strength: Math.round(strength) };
            }
            return acc + strength;
        }, 0);

        return {
            id: player.id,
            name: player.name,
            chem: Math.round(linkSum / teammates.length),
            topLink: strongest
        };
    });

    const score = Math.round(
        playerChem.reduce((acc, p) => acc + p.chem, 0) / playerChem.length
    );

    return {
        score,
        label: getChemistryLabel(score),
        players: playerChem.sort((a, b) => b.chem - a.chem)
    };
};

// Find "familiar faces on opposite sides" — pairings with real shared history
// who are now on opposing teams. Used to spice up the hype write-up.
export const findCrossTeamRivalries = (teamA = [], teamB = [], matches = [], limit = 3) => {
    const history = buildPairHistory(matches);
    const rivalries = [];

    (teamA || []).forEach((a) => {
        if (!a || !a.id) return;
        (teamB || []).forEach((b) => {
            if (!b || !b.id) return;
            const entry = history.get(pairKey(a.id, b.id));
            if (entry && entry.games > 0) {
                rivalries.push({
                    a: a.name,
                    b: b.name,
                    gamesTogether: entry.games
                });
            }
        });
    });

    return rivalries.sort((x, y) => y.gamesTogether - x.gamesTogether).slice(0, limit);
};
