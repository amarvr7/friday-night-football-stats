import SEED_DATA from './seedData';

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
    const seed = SEED_DATA.find(s => s.name.toLowerCase() === (player.name || '').toLowerCase());

    const base = {
        gamesPlayed: player.historical?.gamesPlayed ?? (seed?.gamesPlayed || 0),
        goals: player.historical?.goals ?? (seed?.goals || 0),
        wins: player.historical?.wins ?? (seed?.wins || 0),
        assists: player.historical?.assists ?? 0,
        cleanSheets: player.historical?.cleanSheets ?? 0,
        goalsFor: player.historical?.goalsFor ?? 0,
        goalsAgainst: player.historical?.goalsAgainst ?? 0,
        motms: player.historical?.motms ?? 0,
        ownGoals: player.historical?.ownGoals ?? 0,
        hatTricks: player.historical?.hatTricks ?? 0
    };

    // If top-level player fields were manually incremented via All-Time Quick Stats or Legacy Importer
    // without updating player.historical, recover the difference so no tracked stats are lost.
    if (!player.historical && allMatchStats) {
        const fields = ['gamesPlayed', 'goals', 'wins', 'assists', 'cleanSheets', 'goalsFor', 'goalsAgainst', 'motms', 'ownGoals'];
        fields.forEach(f => {
            const topLevelVal = typeof player[f] === 'number' ? player[f] : 0;
            const matchVal = allMatchStats[f] || 0;
            const impliedBaseline = Math.max(0, topLevelVal - matchVal);
            if (impliedBaseline > base[f]) {
                base[f] = impliedBaseline;
            }
        });
    }

    return base;
};

// Calculate unified, accurate stats for a player for a given season ('all' or '2026')
export const getPlayerStats = (player, matches = [], season = 'all') => {
    const is2026 = season === '2026';
    
    // Filter matches
    const relevantMatches = is2026
        ? matches.filter(isMatchIn2026)
        : matches;

    const matchStats = calculateStatsFromMatches(player, relevantMatches);
    const allMatchStats = is2026 ? null : matchStats;
    const s2026 = player.season2026 || {};
    const baseline = is2026 
        ? { gamesPlayed: 0, goals: 0, wins: 0, assists: 0, cleanSheets: 0, goalsFor: 0, goalsAgainst: 0, motms: 0, ownGoals: 0, hatTricks: 0 } 
        : getPlayerHistoricalBaseline(player, allMatchStats);

    const goals = Math.max(0, baseline.goals + matchStats.goals + (s2026.goals || 0));
    const wins = Math.max(0, baseline.wins + matchStats.wins + (s2026.wins || 0));
    const gamesPlayed = Math.max(0, baseline.gamesPlayed + matchStats.gamesPlayed + (s2026.games || 0));
    const assists = Math.max(0, baseline.assists + matchStats.assists + (s2026.assists || 0));
    const cleanSheets = Math.max(0, baseline.cleanSheets + matchStats.cleanSheets + (s2026.cleanSheets || 0));
    const goalsFor = Math.max(0, baseline.goalsFor + matchStats.goalsFor + (s2026.goalsFor || 0));
    const goalsAgainst = Math.max(0, baseline.goalsAgainst + matchStats.goalsAgainst + (s2026.goalsAgainst || 0));
    const motms = Math.max(0, baseline.motms + (matchStats.motms || 0) + (s2026.motms || 0));
    const ownGoals = Math.max(0, (baseline.ownGoals || 0) + (matchStats.ownGoals || 0) + (s2026.ownGoals || 0));
    const hatTricks = Math.max(0, (baseline.hatTricks || 0) + (matchStats.hatTricks || 0) + (s2026.hatTricks || 0));

    const goalContrib = goals + assists;
    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
    const goalsPerGame = gamesPlayed > 0 ? goals / gamesPlayed : 0;

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
        goalsPerGame
    };
};

// Calculate stats dynamically from a list of matches
export const calculateStatsFromMatches = (player, matches = []) => {
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
        motms: 0
    };

    if (!player) return stats;

    matches.forEach(m => {
        const pStats = m.stats && m.stats[player.id];
        if (pStats) {
            stats.gamesPlayed++;
            stats.goals += (Number(pStats.goals) || 0);
            stats.wins += (Number(pStats.win) || 0);
            stats.assists += (Number(pStats.assists) || 0);
            if (pStats.cleanSheet) stats.cleanSheets++;
            stats.goalsFor += (Number(pStats.goalsFor) || 0);
            stats.goalsAgainst += (Number(pStats.goalsAgainst) || 0);
            stats.ownGoals += (Number(pStats.ownGoals) || 0);
            if ((Number(pStats.goals) || 0) >= 3) stats.hatTricks++;
        }
        if (m.motm === player.id) stats.motms++;
    });

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
    const sortedMatches = [...matches].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
    const playerMatches = sortedMatches.filter(m => m.stats && m.stats[player.id]);

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
        const stats = m.stats[player.id];

        // Win Streak
        if (stats.win === 1) {
            if (i === winStreak) winStreak++;
        }

        // Loss Streak
        if (stats.win === 0) {
            if (i === lossStreak) lossStreak++;
        }

        // Goal Streak
        if ((stats.goals || 0) > 0) {
            if (i === goalStreak) goalStreak++;
        }

        // Assist Streak
        if ((stats.assists || 0) > 0) {
            if (i === assistStreak) assistStreak++;
        }

        // Clean Sheet Streak
        if (stats.cleanSheet) {
            if (i === cleanSheetStreak) cleanSheetStreak++;
        }

        // Last 5 Games & Form Score
        if (i < 5) {
            if (stats.win === 1) {
                last5.push('W');
                formScore += 3;
            } else if (stats.win === 0.5) {
                last5.push('D');
                formScore += 1;
            } else {
                last5.push('L');
            }

            formScore += (stats.goals || 0) * 1;
            formScore += (stats.assists || 0) * 0.5;
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
