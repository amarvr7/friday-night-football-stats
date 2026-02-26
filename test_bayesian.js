// test_bayesian.js
const calculateOverallNew = (player, statsOverride = null, formBonus = 0) => {
    let baseRating;

    const goals = statsOverride ? statsOverride.goals : (player.goals || 0);
    const wins = statsOverride ? statsOverride.wins : (player.wins || 0);
    const gamesPlayed = statsOverride ? statsOverride.gamesPlayed : (player.gamesPlayed || 0);

    const assists = statsOverride ? (statsOverride.assists || 0) : (player.assists || 0);
    const cleanSheets = statsOverride ? (statsOverride.cleanSheets || 0) : (player.cleanSheets || 0);
    const motms = statsOverride ? (statsOverride.motms || 0) : (player.motms || 0);

    if (!gamesPlayed || gamesPlayed === 0) return 65;

    let rating = 65;

    // 1. Accumulation Bonus (Volume/Elo)
    rating += Math.min(gamesPlayed * 0.1, 5);
    rating += Math.min(wins * 0.2, 5);
    rating += Math.min(motms * 0.5, 5);

    // 2. Performance Bonus using Bayesian Smoothing (adds 2 dummy games of 0 stats to combat 1-game wonders)
    const smoothingGames = gamesPlayed < 5 ? 2 : 0; // Only smooth for low sample size
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
    const bonus = Math.round((formBonus || 0) / 4);
    return Math.min(baseRating + bonus, 99);
};

const tim = { name: "Tim (3g, 1w, 0g, 0a, 2cs)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 2, motms: 0 };
const newb = { name: "1-Game Wonder (1g, 1w, 2goals)", goals: 2, wins: 1, gamesPlayed: 1, assists: 0, cleanSheets: 0, motms: 0 };
const vet = { name: "2026 Veteran (5g, 4w, 6goals)", goals: 6, wins: 4, gamesPlayed: 5, assists: 0, cleanSheets: 1, motms: 1 };

[tim, newb, vet].forEach(p => {
    console.log(`${p.name.padEnd(45)} => Rating: ${calculateOverallNew(p)}`);
});
