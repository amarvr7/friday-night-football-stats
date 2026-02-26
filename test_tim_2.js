// test_tim_2.js
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

    // 1. Accumulation Bonus (Volume)
    rating += Math.min(gamesPlayed * 0.1, 5); // Max +5
    rating += Math.min(wins * 0.2, 5); // Max +5
    rating += Math.min(motms * 0.5, 5); // Max +5

    // 2. Performance Averages
    const goalsPerGame = goals / gamesPlayed;
    const assistsPerGame = assists / gamesPlayed;
    const csPerGame = cleanSheets / gamesPlayed;
    const winRate = wins / gamesPlayed;

    rating += Math.min(goalsPerGame * 5, 8); // Max +8
    rating += Math.min(assistsPerGame * 5, 5); // Max +5
    rating += Math.min(csPerGame * 10, 8); // Max +8 (Reduced from 15 to 10)
    rating += (winRate * 10); // Re-added Win Rate! Max +10

    // 3. Graduated "Prove It" Phase
    // Instead of completely taking training wheels off at 3 games, 
    // we dampen their stats if they have fewer than 5 games
    // 1 game: 80% dampen, 2 games: 60% dampen, 3 games: 40% dampen, 4 games: 20% dampen
    if (gamesPlayed < 5) {
        const trueRating = rating;
        const diff = trueRating - 65;
        // dampen the difference from baseline
        const dampenFactor = gamesPlayed / 5;
        rating = 65 + (diff * dampenFactor);
    }

    baseRating = Math.round(rating);
    const bonus = Math.round((formBonus || 0) / 4);
    return Math.min(baseRating + bonus, 99);
};

const tim = { name: "Tim (3g, 1w, 0g, 0a, 1cs)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 1, motms: 0 };
const tim2 = { name: "Tim (3g, 1w, 0g, 0a, 2cs)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 2, motms: 0 };
const vetEmpty = { name: "Vet Empty (20g, 10w, 0g, 0a, 0cs)", goals: 0, wins: 10, gamesPlayed: 20, assists: 0, cleanSheets: 0, motms: 0 };
const vetMid = { name: "Vet Mid (20g, 10w, 5g, 5a, 5cs, 2m)", goals: 5, wins: 10, gamesPlayed: 20, assists: 5, cleanSheets: 5, motms: 2 };
const vetStars = { name: "Vet Elite (30g, 20w, 40g, 15a, 5cs, 10m)", goals: 40, wins: 20, gamesPlayed: 30, assists: 15, cleanSheets: 5, motms: 10 };

[tim, tim2, vetEmpty, vetMid, vetStars].forEach(p => {
    console.log(`${p.name.padEnd(45)} => Rating: ${calculateOverallNew(p)}`);
});
