import {
    DEFAULT_RATING_WEIGHTS,
    computeMatchFingerprint,
    deduplicateMatches,
    calculateMatchContributionRating,
    calculateAllMatchRatings,
    getLastFiveForm,
    getPremierLeagueLeaderboards
} from '../statsEngine';
import {
    getPlayerStats,
    calculateStatsFromMatches,
    calculateStreaks
} from '../helpers';

describe('Statistical Calculations & Edge Cases (statsEngine & helpers)', () => {
    const samplePlayers = [
        {
            id: 'p1',
            name: 'Amar',
            historical: { gamesPlayed: 100, goals: 50, wins: 55, assists: 20, cleanSheets: 10 },
            season2026: { games: 2, goals: 3, wins: 2, assists: 1, cleanSheets: 1 }
        },
        {
            id: 'p2',
            name: 'JT',
            historical: { gamesPlayed: 60, goals: 40, wins: 30, assists: 15, cleanSheets: 5 },
            season2026: { games: 0, goals: 0, wins: 0, assists: 0, cleanSheets: 0 }
        },
        {
            id: 'p3',
            name: 'ZeroAppsPlayer',
            historical: { gamesPlayed: 0, goals: 0, wins: 0, assists: 0, cleanSheets: 0 }
        }
    ];

    const baseDate2026 = Math.floor(new Date('2026-05-01T20:00:00Z').getTime() / 1000);

    const sampleMatches = [
        {
            id: 'm1',
            date: { seconds: baseDate2026 },
            motm: 'p1',
            stats: {
                p1: { team: 'blue', goals: 2, assists: 1, win: 1, cleanSheet: true, goalsFor: 4, goalsAgainst: 0, ownGoals: 0 },
                p2: { team: 'white', goals: 0, assists: 0, win: 0, cleanSheet: false, goalsFor: 0, goalsAgainst: 4, ownGoals: 1 }
            }
        },
        {
            id: 'm2',
            date: { seconds: baseDate2026 + 3600 }, // Big Night Game 2 (repeat appearance same night)
            motm: 'p2',
            stats: {
                p1: { team: 'blue', goals: 1, assists: 2, win: 0.5, cleanSheet: false, goalsFor: 3, goalsAgainst: 3, ownGoals: 0 },
                p2: { team: 'white', goals: 3, assists: 0, win: 0.5, cleanSheet: false, goalsFor: 3, goalsAgainst: 3, ownGoals: 0 }
            }
        }
    ];

    test('calculates accurate career totals, season totals, games played, GPG, APA, G+A, and win percentage', () => {
        const amarCareer = getPlayerStats(samplePlayers[0], sampleMatches, 'all');
        // Historical (100 GP, 50 G, 55 W, 20 A, 10 CS) + Matches (2 GP, 3 G, 1.5 W, 3 A, 1 CS) + season2026 manual (2 GP, 3 G, 2 W, 1 A, 1 CS)
        expect(amarCareer.gamesPlayed).toBe(104);
        expect(amarCareer.goals).toBe(56);
        expect(amarCareer.assists).toBe(24);
        expect(amarCareer.goalContrib).toBe(80);
        expect(amarCareer.wins).toBe(58.5);
        expect(amarCareer.cleanSheets).toBe(12);
        expect(amarCareer.goalsPerGame).toBeCloseTo(56 / 104, 4);
        expect(amarCareer.assistsPerGame).toBeCloseTo(24 / 104, 4);
        expect(amarCareer.winRate).toBeCloseTo((58.5 / 104) * 100, 4);

        const amar2026 = getPlayerStats(samplePlayers[0], sampleMatches, '2026');
        // Matches (2 GP, 3 G, 1.5 W, 3 A, 1 CS) + season2026 manual (2 GP, 3 G, 2 W, 1 A, 1 CS)
        expect(amar2026.gamesPlayed).toBe(4);
        expect(amar2026.goals).toBe(6);
        expect(amar2026.assists).toBe(4);
        expect(amar2026.goalContrib).toBe(10);
        expect(amar2026.wins).toBe(3.5);
        expect(amar2026.cleanSheets).toBe(2);
        expect(amar2026.goalsPerGame).toBeCloseTo(1.5, 4);
        expect(amar2026.assistsPerGame).toBeCloseTo(1.0, 4);
        expect(amar2026.winRate).toBeCloseTo(87.5, 4);
    });

    test('handles division by zero safely when player has 0 appearances', () => {
        const zeroStats = getPlayerStats(samplePlayers[2], [], '2026');
        expect(zeroStats.gamesPlayed).toBe(0);
        expect(zeroStats.goalsPerGame).toBe(0);
        expect(zeroStats.assistsPerGame).toBe(0);
        expect(zeroStats.winRate).toBe(0);
        expect(zeroStats.goalContrib).toBe(0);
        expect(zeroStats.avgMatchRating).toBe(0);
        expect(Number.isNaN(zeroStats.goalsPerGame)).toBe(false);
        expect(Number.isNaN(zeroStats.assistsPerGame)).toBe(false);
        expect(Number.isNaN(zeroStats.winRate)).toBe(false);
    });

    test('handles incomplete, null, undefined, or malformed records gracefully', () => {
        const nullPlayerStats = getPlayerStats(null, sampleMatches, '2026');
        expect(nullPlayerStats.gamesPlayed).toBe(0);
        expect(nullPlayerStats.goalsPerGame).toBe(0);

        const malformedMatches = [
            null,
            undefined,
            {},
            { id: 'empty', stats: {} },
            {
                id: 'partial',
                date: { seconds: baseDate2026 },
                stats: {
                    p1: { team: 'blue', goals: 'invalid', assists: null, win: undefined, cleanSheet: 0 }
                }
            }
        ];

        const p1Stats = calculateStatsFromMatches({ id: 'p1', name: 'Amar' }, malformedMatches);
        expect(p1Stats.gamesPlayed).toBe(1);
        expect(p1Stats.goals).toBe(0);
        expect(p1Stats.assists).toBe(0);
        expect(p1Stats.wins).toBe(0);
        expect(p1Stats.avgMatchRating).toBeGreaterThan(0);
    });

    test('deduplicates rapid duplicate match submissions and identical match IDs', () => {
        const matchOriginal = {
            id: 'm100',
            date: { seconds: baseDate2026 },
            motm: 'p1',
            stats: {
                p1: { team: 'blue', goals: 2, assists: 1, win: 1, cleanSheet: true, goalsFor: 2, goalsAgainst: 0 }
            }
        };
        // Same ID duplicate
        const matchSameId = { ...matchOriginal };
        // Different ID but identical payload submitted 15 seconds later (accidental double-tap)
        const matchDoubleSubmit = {
            ...matchOriginal,
            id: 'm101',
            date: { seconds: baseDate2026 + 15 }
        };
        // Distinct match a week later with same stats (legitimate separate game)
        const matchNextWeek = {
            ...matchOriginal,
            id: 'm102',
            date: { seconds: baseDate2026 + 7 * 86400 }
        };

        const deduped = deduplicateMatches([matchOriginal, matchSameId, matchDoubleSubmit, matchNextWeek]);
        expect(deduped).toHaveLength(2);
        expect(deduped.map(m => m.id)).toEqual(['m102', 'm100']);
    });

    test('handles match corrections by changing fingerprint and recalculating stats accurately', () => {
        const beforeCorrection = sampleMatches[0];
        const afterCorrection = {
            ...beforeCorrection,
            stats: {
                ...beforeCorrection.stats,
                p1: { ...beforeCorrection.stats.p1, goals: 4 } // Corrected from 2 goals to 4 goals
            }
        };

        const fpBefore = computeMatchFingerprint(beforeCorrection);
        const fpAfter = computeMatchFingerprint(afterCorrection);
        expect(fpBefore).not.toBe(fpAfter);

        const statsBefore = calculateStatsFromMatches({ id: 'p1' }, [beforeCorrection]);
        const statsAfter = calculateStatsFromMatches({ id: 'p1' }, [afterCorrection]);
        expect(statsBefore.goals).toBe(2);
        expect(statsAfter.goals).toBe(4);
        expect(statsAfter.hatTricks).toBe(1);
    });

    test('calculates last-five-match form in newest-first order and caps at 5 matches', () => {
        const sixMatches = [1, 2, 3, 4, 5, 6].map(idx => ({
            id: `m_${idx}`,
            date: { seconds: baseDate2026 + idx * 86400 },
            stats: {
                p1: {
                    team: 'blue',
                    goals: idx % 2,
                    assists: 1,
                    win: idx === 6 ? 1 : idx === 5 ? 0.5 : idx === 4 ? 0 : 1,
                    cleanSheet: idx === 6,
                    goalsFor: 3,
                    goalsAgainst: 1
                }
            }
        }));

        const form = getLastFiveForm({ id: 'p1' }, sixMatches, '2026');
        expect(form.results).toHaveLength(5);
        // Newest is idx=6 (W), idx=5 (D), idx=4 (L), idx=3 (W), idx=2 (W)
        expect(form.results).toEqual(['W', 'D', 'L', 'W', 'W']);
        expect(form.summary).toBe('W-D-L-W-W');

        const streaks = calculateStreaks({ id: 'p1' }, sixMatches);
        expect(streaks.last5).toEqual(['W', 'D', 'L', 'W', 'W']);
    });

    test('calculates configurable 0-10 Match Contribution Rating in code and clamps between 0 and 10', () => {
        const standoutPerf = {
            goals: 3,
            assists: 2,
            win: 1,
            cleanSheet: true,
            goalsFor: 5,
            goalsAgainst: 0,
            ownGoals: 0
        };
        const defaultRating = calculateMatchContributionRating(standoutPerf, true, DEFAULT_RATING_WEIGHTS);
        expect(defaultRating).toBe(10.0);

        const nightmarePerf = {
            goals: 0,
            assists: 0,
            win: 0,
            cleanSheet: false,
            goalsFor: 0,
            goalsAgainst: 6,
            ownGoals: 8
        };
        const minClamped = calculateMatchContributionRating(nightmarePerf, false, DEFAULT_RATING_WEIGHTS);
        expect(minClamped).toBe(0.0);

        // Custom weights test
        const customRating = calculateMatchContributionRating(
            { goals: 1, assists: 0, win: 1, cleanSheet: false, goalsFor: 2, goalsAgainst: 1, ownGoals: 0 },
            false,
            { ...DEFAULT_RATING_WEIGHTS, baseline: 5.0, goalWeight: 2.0, winBonus: 1.0, goalDiffMultiplier: 0 }
        );
        expect(customRating).toBe(8.0);

        const matchRatings = calculateAllMatchRatings(sampleMatches[0], samplePlayers);
        expect(matchRatings.p1.rating).toBeGreaterThan(matchRatings.p2.rating);
    });

    test('builds Golden Boot, Playmaker, Most Wins, and Clean Sheet leaderboards accurately', () => {
        const boards = getPremierLeagueLeaderboards(samplePlayers, sampleMatches, '2026', DEFAULT_RATING_WEIGHTS, getPlayerStats);

        // Amar has 6 goals in 2026 (3 match + 3 manual), JT has 3 goals (3 match)
        expect(boards.goldenBoot[0].name).toBe('Amar');
        expect(boards.goldenBoot[0].goals).toBe(6);
        expect(boards.goldenBoot[1].name).toBe('JT');
        expect(boards.goldenBoot[1].goals).toBe(3);

        // Playmaker: Amar has 4 assists in 2026
        expect(boards.playmaker[0].name).toBe('Amar');
        expect(boards.playmaker[0].assists).toBe(4);

        // Most Wins: Amar has 3.5 wins in 2026
        expect(boards.mostWins[0].name).toBe('Amar');
        expect(boards.mostWins[0].wins).toBe(3.5);

        // Clean Sheets: Amar has 2 CS in 2026
        expect(boards.cleanSheets[0].name).toBe('Amar');
        expect(boards.cleanSheets[0].cleanSheets).toBe(2);
    });
});
