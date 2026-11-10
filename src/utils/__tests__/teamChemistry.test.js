import {
    calculateTeamChemistry,
    findCrossTeamRivalries,
    getChemistryLabel
} from '../teamChemistry';

const BASE_SECONDS = 1777665600;
const ONE_DAY = 86400;

// Each match is spaced a day apart so the dedup window never collapses fixtures.
const makeMatch = (index, blueIds, whiteIds, blueScore, whiteScore, perPlayer = {}) => {
    const stats = {};
    blueIds.forEach((pid) => {
        stats[pid] = {
            team: 'blue',
            goalsFor: blueScore,
            goalsAgainst: whiteScore,
            goals: perPlayer[pid]?.goals || 0,
            assists: perPlayer[pid]?.assists || 0
        };
    });
    whiteIds.forEach((pid) => {
        stats[pid] = {
            team: 'white',
            goalsFor: whiteScore,
            goalsAgainst: blueScore,
            goals: perPlayer[pid]?.goals || 0,
            assists: perPlayer[pid]?.assists || 0
        };
    });
    return { id: `m${index}`, date: { seconds: BASE_SECONDS + index * ONE_DAY }, stats };
};

describe('Team Chemistry Engine', () => {
    const amar = { id: 'p1', name: 'Amar' };
    const nico = { id: 'p2', name: 'Nico' };
    const cam = { id: 'p3', name: 'Cam B' };

    it('returns a cold score for an empty roster', () => {
        const result = calculateTeamChemistry([], []);
        expect(result.score).toBe(0);
        expect(result.players).toHaveLength(0);
    });

    it('settles unproven pairings toward the cold baseline', () => {
        const result = calculateTeamChemistry([amar, nico], []);
        expect(result.score).toBeLessThan(50);
        expect(result.label).toBe('Cold');
    });

    it('rewards pairings that consistently win together', () => {
        const matches = Array.from({ length: 6 }).map((_, i) =>
            makeMatch(i, ['p1', 'p2'], ['p9'], 3, 1, {
                p1: { goals: 1, assists: 1 },
                p2: { goals: 1, assists: 0 }
            })
        );
        const result = calculateTeamChemistry([amar, nico], matches);
        expect(result.score).toBeGreaterThan(60);
        expect(result.players[0].topLink).not.toBeNull();
    });

    it('penalises pairings that keep losing together', () => {
        const winners = Array.from({ length: 6 }).map((_, i) =>
            makeMatch(i, ['p1', 'p2'], ['p9'], 3, 1)
        );
        const losers = Array.from({ length: 6 }).map((_, i) =>
            makeMatch(i, ['p3', 'p4'], ['p9'], 0, 4)
        );
        const winChem = calculateTeamChemistry(
            [amar, nico],
            winners
        ).score;
        const loseChem = calculateTeamChemistry(
            [cam, { id: 'p4', name: 'Weylu' }],
            losers
        ).score;
        expect(winChem).toBeGreaterThan(loseChem);
    });

    it('finds cross-team rivalries from shared history', () => {
        const matches = Array.from({ length: 4 }).map((_, i) =>
            makeMatch(i, ['p1', 'p2'], ['p9'], 2, 1)
        );
        const rivalries = findCrossTeamRivalries([amar], [nico], matches);
        expect(rivalries).toHaveLength(1);
        expect(rivalries[0].gamesTogether).toBe(4);
    });

    it('maps scores to labels', () => {
        expect(getChemistryLabel(85)).toBe('On Fire');
        expect(getChemistryLabel(72)).toBe('Strong');
        expect(getChemistryLabel(62)).toBe('Solid');
        expect(getChemistryLabel(52)).toBe('Balanced');
        expect(getChemistryLabel(40)).toBe('Cold');
    });
});
