// test_lower_baseline.js
const calculateOverallNew = (player, statsOverride = null, formBonus = 0) => {
    let baseRating;

    const goals = statsOverride ? statsOverride.goals : (player.goals || 0);
    const wins = statsOverride ? statsOverride.wins : (player.wins || 0);
    const gamesPlayed = statsOverride ? statsOverride.gamesPlayed : (player.gamesPlayed || 0);

    const assists = statsOverride ? (statsOverride.assists || 0) : (player.assists || 0);
    const cleanSheets = statsOverride ? (statsOverride.cleanSheets || 0) : (player.cleanSheets || 0);
    const motms = statsOverride ? (statsOverride.motms || 0) : (player.motms || 0);

    if (!gamesPlayed || gamesPlayed === 0) return 60; // LOWER BASELINE

    let rating = 60; // LOWER BASELINE

    // 1. Accumulation Bonus (Volume/Elo)
    rating += Math.min(gamesPlayed * 0.1, 5);
    rating += Math.min(wins * 0.2, 5);
    rating += Math.min(motms * 0.5, 5);

    // 2. Performance Bonus via Bayesian Smoothing
    const smoothingGames = gamesPlayed < 5 ? 2 : 0;
    const adjustedGames = gamesPlayed + smoothingGames;

    const goalsPerGame = goals / adjustedGames;
    const assistsPerGame = assists / adjustedGames;
    const csPerGame = cleanSheets / adjustedGames;
    const winRate = wins / adjustedGames; // 1 win / 5 = 0.2

    // Increase caps slightly to compensate for lower base, ensuring elite players still hit 90+
    const goalsBonus = Math.min(goalsPerGame * 7, 12); // Max +12
    const assistsBonus = Math.min(assistsPerGame * 5, 8); // Max +8
    const csBonus = Math.min(csPerGame * 12, 12); // Max +12
    const winBonus = winRate * 12; // Max +12

    rating += goalsBonus + assistsBonus + csBonus + winBonus;
    // Max theoretical rating = 60 + 5 + 5 + 5 + 12 + 8 + 12 + 12 = 119 => capped at 99

    baseRating = Math.round(rating);
    const bonus = Math.round((formBonus || 0) / 4);
    return Math.min(baseRating + bonus, 99);
};

const tim0 = { name: "Tim (3g, 1w, 0g, 0a, 0cs)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 0, motms: 0 };
const tim1 = { name: "Tim (3g, 1w, 0g, 0a, 1cs)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 1, motms: 0 };
const tim2 = { name: "Tim (3g, 1w, 0g, 0a, 2cs)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 2, motms: 0 };
const newb = { name: "1-Game Wonder (1g, 1w, 2goals)", goals: 2, wins: 1, gamesPlayed: 1, assists: 0, cleanSheets: 0, motms: 0 };
const vet = { name: "Veteran Average (5g, 2w, 2goals)", goals: 2, wins: 2, gamesPlayed: 5, assists: 1, cleanSheets: 1, motms: 0 };
const vetElite = { name: "Veteran Elite (5g, 5w, 8goals, 3cs)", goals: 8, wins: 5, gamesPlayed: 5, assists: 3, cleanSheets: 3, motms: 2 };

[tim0, tim1, tim2, newb, vet, vetElite].forEach(p => {
    console.log(`${p.name.padEnd(45)} => Rating: ${calculateOverallNew(p)}`);
});
