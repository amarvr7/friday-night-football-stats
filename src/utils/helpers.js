export const mapRating = (val) => {
    if (!val) return 60;
    const base = 35 + (val * 12);
    return Math.min(Math.round(base + (val > 4.5 ? 4 : 0)), 99);
};

// Calculate stats dynamically from a list of matches
export const calculateStatsFromMatches = (player, matches) => {
    let stats = {
        goals: 0,
        wins: 0,
        gamesPlayed: 0,
        assists: 0,
        cleanSheets: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        hatTricks: 0,
        motms: 0
    };

    matches.forEach(m => {
        const pStats = m.stats && m.stats[player.id];
        if (pStats) {
            stats.gamesPlayed++;
            stats.goals += (pStats.goals || 0);
            stats.wins += (pStats.win || 0);
            stats.assists += (pStats.assists || 0);
            if (pStats.cleanSheet) stats.cleanSheets++;
            stats.goalsFor += (pStats.goalsFor || 0);
            stats.goalsAgainst += (pStats.goalsAgainst || 0);
            if ((pStats.goals || 0) >= 3) stats.hatTricks++;
        }
        if (m.motm === player.id) stats.motms++;
    });

    return stats;
};

export const calculateOverall = (player, statsOverride = null, formBonus = 0) => {
    let baseRating;

    if (player.ratings) {
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

        if (!gamesPlayed || gamesPlayed === 0) return 65;

        // Base rating starts at 65
        let rating = 65;

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

        const goalsBonus = Math.min(goalsPerGame * 5, 10);
        const assistsBonus = Math.min(assistsPerGame * 5, 5);
        const csBonus = Math.min(csPerGame * 10, 10);
        const winBonus = winRate * 10;

        rating += goalsBonus + assistsBonus + csBonus + winBonus;

        baseRating = Math.round(rating);
    }

    // Apply Form Bonus (Max +5 for max form score of 20)
    const bonus = Math.round((formBonus || 0) / 4);
    return Math.min(baseRating + bonus, 99);
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
    const last5 = [];

    let formScore = 0;

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

    return { winStreak, lossStreak, goalStreak, assistStreak, cleanSheetStreak, playedStreak, last5, formScore: Math.min(formScore, 20) }; // Cap at 20
};
