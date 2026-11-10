import SEED_DATA from './seedData';
import {
    deduplicateMatches,
    calculateMatchContributionRating,
    getLastFiveForm,
    safeNum
} from './statsEngine';

export const mapRating = (val) => {
    if (!val) return 60;
    const base = 35 + (val * 12);
    return Math.min(Math.round(base + (val > 4.5 ? 4 : 0)), 99);
};

// Helper to determine if a match belongs to the 2026 season
export const isMatchIn2026 = (m) => {
    if (!m) return false;
    // Newly created match with pending serverTimestamp() belongs to current (2026) season
    if (!m.date) return true;
    if (typeof m.date.seconds === 'number') {
        return new Date(m.date.seconds * 1000).getFullYear() === 2026;
    }
    if (typeof m.date.toDate === 'function') {
        return m.date.toDate().getFullYear() === 2026;
    }
    const parsed = new Date(m.date);
    return !isNaN(parsed.getTime()) ? parsed.getFullYear() === 2026 : true;
};

// Retrieve pre-2026 historical baseline for a player, reconciling any top-level legacy edits
export const getPlayerHistoricalBaseline = (player, allMatchStats = null) => {
    if (!player || typeof player !== 'object') {
        return {
            gamesPlayed: 0,
            goals: 0,
            wins: 0,
            assists: 0,
            cleanSheets: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            motms: 0,
            ownGoals: 0,
            hatTricks: 0
        };
    }

    const seed = SEED_DATA.find(s => s.name.toLowerCase() === (player.name || '').toLowerCase());

    const base = {
        gamesPlayed: Math.max(0, safeNum(player.historical?.gamesPlayed ?? (seed?.gamesPlayed || 0))),
        goals: Math.max(0, safeNum(player.historical?.goals ?? (seed?.goals || 0))),
        wins: Math.max(0, safeNum(player.historical?.wins ?? (seed?.wins || 0))),
        assists: Math.max(0, safeNum(player.historical?.assists ?? 0)),
        cleanSheets: Math.max(0, safeNum(player.historical?.cleanSheets ?? 0)),
        goalsFor: Math.max(0, safeNum(player.historical?.goalsFor ?? 0)),
        goalsAgainst: Math.max(0, safeNum(player.historical?.goalsAgainst ?? 0)),
        motms: Math.max(0, safeNum(player.historical?.motms ?? 0)),
        ownGoals: Math.max(0, safeNum(player.historical?.ownGoals ?? 0)),
        hatTricks: Math.max(0, safeNum(player.historical?.hatTricks ?? 0))
    };

    // If top-level player fields were manually incremented via All-Time Quick Stats or Legacy Importer
    // without updating player.historical, recover the difference so no tracked stats are lost.
    if (!player.historical && allMatchStats) {
        const fields = ['gamesPlayed', 'goals', 'wins', 'assists', 'cleanSheets', 'goalsFor', 'goalsAgainst', 'motms', 'ownGoals'];
        fields.forEach(f => {
            const topLevelVal = typeof player[f] === 'number' && Number.isFinite(player[f]) ? player[f] : 0;
            const matchVal = safeNum(allMatchStats[f]);
            const impliedBaseline = Math.max(0, topLevelVal - matchVal);
            if (impliedBaseline > base[f]) {
                base[f] = impliedBaseline;
            }
        });
    }

    return base;
};

// Calculate unified, accurate stats for a player for a given season ('all' or '2026')
export const getPlayerStats = (player, matches = [], season = 'all', customWeights = {}) => {
    if (!player || typeof player !== 'object') {
        return {
            goals: 0,
            wins: 0,
            gamesPlayed: 0,
            assists: 0,
            cleanSheets: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            motms: 0,
            ownGoals: 0,
            hatTricks: 0,
            goalContrib: 0,
            winRate: 0,
            goalsPerGame: 0,
            assistsPerGame: 0,
            goalContributionsPerGame: 0,
            avgMatchRating: 0,
            trackedMatchesPlayed: 0,
            lastFiveForm: [],
            lastFiveFormSummary: 'N/A',
            lastFiveDetailed: []
        };
    }

    const is2026 = season === '2026';
    const cleanMatches = deduplicateMatches(matches);

    // Filter matches
    const relevantMatches = is2026
        ? cleanMatches.filter(isMatchIn2026)
        : cleanMatches;

    const matchStats = calculateStatsFromMatches(player, relevantMatches, customWeights);
    const allMatchStats = is2026 ? null : matchStats;
    const s2026 = player.season2026 || {};
    const baseline = is2026 
        ? { gamesPlayed: 0, goals: 0, wins: 0, assists: 0, cleanSheets: 0, goalsFor: 0, goalsAgainst: 0, motms: 0, ownGoals: 0, hatTricks: 0 } 
        : getPlayerHistoricalBaseline(player, allMatchStats);

    const goals = Math.max(0, baseline.goals + matchStats.goals + safeNum(s2026.goals));
    const wins = Math.max(0, baseline.wins + matchStats.wins + safeNum(s2026.wins));
    const gamesPlayed = Math.max(0, baseline.gamesPlayed + matchStats.gamesPlayed + safeNum(s2026.games));
    const assists = Math.max(0, baseline.assists + matchStats.assists + safeNum(s2026.assists));
    const cleanSheets = Math.max(0, baseline.cleanSheets + matchStats.cleanSheets + safeNum(s2026.cleanSheets));
    const goalsFor = Math.max(0, baseline.goalsFor + matchStats.goalsFor + safeNum(s2026.goalsFor));
    const goalsAgainst = Math.max(0, baseline.goalsAgainst + matchStats.goalsAgainst + safeNum(s2026.goalsAgainst));
    const motms = Math.max(0, baseline.motms + (matchStats.motms || 0) + safeNum(s2026.motms));
    const ownGoals = Math.max(0, (baseline.ownGoals || 0) + (matchStats.ownGoals || 0) + safeNum(s2026.ownGoals));
    const hatTricks = Math.max(0, (baseline.hatTricks || 0) + (matchStats.hatTricks || 0) + safeNum(s2026.hatTricks));

    const goalContrib = goals + assists;
    const winRate = gamesPlayed > 0 ? Math.min(100, Math.max(0, (wins / gamesPlayed) * 100)) : 0;
    const goalsPerGame = gamesPlayed > 0 ? goals / gamesPlayed : 0;
    const assistsPerGame = gamesPlayed > 0 ? assists / gamesPlayed : 0;
    const goalContributionsPerGame = gamesPlayed > 0 ? goalContrib / gamesPlayed : 0;

    const formInfo = getLastFiveForm(player, cleanMatches, season, customWeights);

    return {
        goals,
        wins,
        gamesPlayed,
        assists,
        cleanSheets,
        goalsFor,
        goalsAgainst,
        motms,
        ownGoals,
        hatTricks,
        goalContrib,
        winRate,
        goalsPerGame,
        assistsPerGame,
        goalContributionsPerGame,
        avgMatchRating: matchStats.avgMatchRating || 0,
        trackedMatchesPlayed: matchStats.gamesPlayed || 0,
        lastFiveForm: formInfo.results,
        lastFiveFormSummary: formInfo.summary,
        lastFiveDetailed: formInfo.detailed
    };
};

// Calculate stats dynamically from a list of matches (handles deduplication, incomplete records, and MCR)
export const calculateStatsFromMatches = (player, matches = [], customWeights = {}) => {
    let stats = {
        goals: 0,
        wins: 0,
        gamesPlayed: 0,
        assists: 0,
        cleanSheets: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        ownGoals: 0,
        hatTricks: 0,
        motms: 0,
        totalMatchRating: 0,
        avgMatchRating: 0
    };

    if (!player || !player.id) return stats;

    const cleanMatches = deduplicateMatches(matches);

    cleanMatches.forEach(m => {
        const pStats = m.stats && m.stats[player.id];
        if (pStats && typeof pStats === 'object') {
            const pGoals = Math.max(0, safeNum(pStats.goals));
            const pWins = Math.max(0, safeNum(pStats.win));
            const pAssists = Math.max(0, safeNum(pStats.assists));
            const pGF = Math.max(0, safeNum(pStats.goalsFor));
            const pGA = Math.max(0, safeNum(pStats.goalsAgainst));
            const pOG = Math.max(0, safeNum(pStats.ownGoals));
            const isMotm = m.motm === player.id;

            stats.gamesPlayed++;
            stats.goals += pGoals;
            stats.wins += pWins;
            stats.assists += pAssists;
            if (pStats.cleanSheet) stats.cleanSheets++;
            stats.goalsFor += pGF;
            stats.goalsAgainst += pGA;
            stats.ownGoals += pOG;
            if (pGoals >= 3) stats.hatTricks++;
            if (isMotm) stats.motms++;

            const matchRating = calculateMatchContributionRating(pStats, isMotm, customWeights);
            stats.totalMatchRating += matchRating;
        }
    });

    stats.avgMatchRating = stats.gamesPlayed > 0
        ? Number((stats.totalMatchRating / stats.gamesPlayed).toFixed(1))
        : 0;

    return stats;
};
export const calculateOverall = (player, statsOverride = null, streaks = null, forceDynamic = false) => {
    let baseRating;

    // Only use manual ratings if we aren't forcing dynamic stat calculation
    if (player.ratings && !forceDynamic) {
        const { fitness, control, shooting, defense } = player.ratings;
        const avg = (fitness * 1.0 + control * 1.2 + shooting * 1.0 + defense * 0.8) / 4;
        baseRating = mapRating(avg);
    } else {
        const goals = statsOverride ? statsOverride.goals : (player.goals || 0);
        const wins = statsOverride ? statsOverride.wins : (player.wins || 0);
        const gamesPlayed = statsOverride ? statsOverride.gamesPlayed : (player.gamesPlayed || 0);

        const assists = statsOverride ? (statsOverride.assists || 0) : (player.assists || 0);
        const cleanSheets = statsOverride ? (statsOverride.cleanSheets || 0) : (player.cleanSheets || 0);
        const motms = statsOverride ? (statsOverride.motms || 0) : (player.motms || 0);

        if (!gamesPlayed || gamesPlayed === 0) return 60;

        // Base rating starts at 60 to allow a wider bell curve for lower-impact players
        let rating = 60;

        // 1. Accumulation Bonus (Volume/Elo)
        const gamesBonus = Math.min(gamesPlayed * 0.1, 5);
        const winsBonus = Math.min(wins * 0.2, 5);
        const motmsBonus = Math.min(motms * 0.5, 5);

        rating += gamesBonus + winsBonus + motmsBonus;

        // 2. Performance Bonus via Bayesian Smoothing
        // Add 2 dummy games of 0 stats if player has fewer than 5 games.
        // This stops 1-game wonders from getting 99 ratings without reading all-time history.
        const smoothingGames = gamesPlayed < 5 ? 2 : 0;
        const adjustedGames = gamesPlayed + smoothingGames;

        const goalsPerGame = goals / adjustedGames;
        const assistsPerGame = assists / adjustedGames;
        const csPerGame = cleanSheets / adjustedGames;
        const winRate = wins / adjustedGames;

        // Higher multi-caps to compensate for lower baseline so elite veterans still hit 99
        const goalsBonus = Math.min(goalsPerGame * 7, 12);
        const assistsBonus = Math.min(assistsPerGame * 5, 8);
        const csBonus = Math.min(csPerGame * 12, 12);
        const winBonus = winRate * 12;

        rating += goalsBonus + assistsBonus + csBonus + winBonus;

        baseRating = Math.round(rating);
    }

    let modifier = 0;
    if (streaks) {
        // Form Bonus (Max +5 for max form score of 20)
        modifier += Math.round((streaks.formScore || 0) / 4);

        // Streak Bonus (e.g., +1 for win/goal/assist/cs streak >= 3)
        if (streaks.winStreak >= 3) modifier += 1;
        if (streaks.goalStreak >= 3) modifier += 1;
        if (streaks.assistStreak >= 3) modifier += 1;
        if (streaks.cleanSheetStreak >= 3) modifier += 1;

        // Inactivity Penalty (e.g., -1 for every week missed after 2 weeks, max -5)
        if (streaks.weeksSinceLastPlayed > 2) {
            modifier -= Math.min(streaks.weeksSinceLastPlayed - 2, 5);
        }
    }

    return Math.min(baseRating + modifier, 99);
};

export const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

export const calculateStreaks = (player, matches) => {
    const sortedMatches = deduplicateMatches(matches);
    const playerMatches = sortedMatches.filter(m => m.stats && m.stats[player.id] && typeof m.stats[player.id] === 'object');

    let winStreak = 0;
    let goalStreak = 0;
    let assistStreak = 0;
    let cleanSheetStreak = 0;
    let lossStreak = 0;
    let playedStreak = 0;
    let weeksSinceLastPlayed = 0;
    const last5 = [];

    let formScore = 0;

    // Calculate Weeks Since Last Played
    if (playerMatches.length > 0 && playerMatches[0].date) {
        // Find most recent overall match date
        const mostRecentMatch = sortedMatches[0];
        if (mostRecentMatch && mostRecentMatch.date) {
            const lastMatchDate = new Date(playerMatches[0].date.seconds * 1000);
            const currentMatchDate = new Date(mostRecentMatch.date.seconds * 1000);
            const diffTime = Math.abs(currentMatchDate - lastMatchDate);
            weeksSinceLastPlayed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        }
    } else if (sortedMatches.length > 0 && sortedMatches[0].date) {
        // If they never played but there are matches, calculate weeks since most recent overall match
        // Or could be treated as inactive since beginning.
        // Let's find first match they could have played
        weeksSinceLastPlayed = 99; // Arbitrary high number for never played
    }

    // Played Streak is how many sequential matches player played in prior to their last unplayed
    // Let's iterate over sortedMatches (all matches) to find played streak
    for (let i = 0; i < sortedMatches.length; i++) {
        const m = sortedMatches[i];
        if (m.stats && m.stats[player.id]) {
            playedStreak++;
        } else {
            break; // Stop at first non-played match
        }
    }

    for (let i = 0; i < playerMatches.length; i++) {
        const m = playerMatches[i];
        const stats = m.stats[player.id] || {};
        const winVal = safeNum(stats.win);
        const goalsVal = safeNum(stats.goals);
        const assistsVal = safeNum(stats.assists);

        // Win Streak
        if (winVal === 1) {
            if (i === winStreak) winStreak++;
        }

        // Loss Streak
        if (winVal === 0) {
            if (i === lossStreak) lossStreak++;
        }

        // Goal Streak
        if (goalsVal > 0) {
            if (i === goalStreak) goalStreak++;
        }

        // Assist Streak
        if (assistsVal > 0) {
            if (i === assistStreak) assistStreak++;
        }

        // Clean Sheet Streak
        if (stats.cleanSheet) {
            if (i === cleanSheetStreak) cleanSheetStreak++;
        }

        // Last 5 Games & Form Score
        if (i < 5) {
            if (winVal === 1) {
                last5.push('W');
                formScore += 3;
            } else if (winVal === 0.5) {
                last5.push('D');
                formScore += 1;
            } else {
                last5.push('L');
            }

            formScore += goalsVal * 1;
            formScore += assistsVal * 0.5;
            if (stats.cleanSheet) formScore += 0.5;
        }
    }

    return {
        winStreak,
        lossStreak,
        goalStreak,
        assistStreak,
        cleanSheetStreak,
        playedStreak,
        last5,
        formScore: Math.min(formScore, 20),
        weeksSinceLastPlayed
    };
};
