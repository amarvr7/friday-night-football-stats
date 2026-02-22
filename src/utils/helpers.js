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
        const goals = statsOverride ? statsOverride.goals : player.goals;
        const wins = statsOverride ? statsOverride.wins : player.wins;
        const gamesPlayed = statsOverride ? statsOverride.gamesPlayed : player.gamesPlayed;

        const assists = statsOverride ? (statsOverride.assists || 0) : 0;
        const cleanSheets = statsOverride ? (statsOverride.cleanSheets || 0) : 0;
        const motms = statsOverride ? (statsOverride.motms || 0) : (player.motms || 0);

        if (!gamesPlayed || gamesPlayed === 0) return 60;

        const goalsPerGame = goals / gamesPlayed;
        const assistsPerGame = assists / gamesPlayed;
        const csPerGame = cleanSheets / gamesPlayed;
        const winRate = wins / gamesPlayed;
        const motmPerGame = motms / gamesPlayed;

        let rating = 60 + (goalsPerGame * 15) + (assistsPerGame * 10) + (csPerGame * 10) + (winRate * 20) + (motmPerGame * 30);
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
