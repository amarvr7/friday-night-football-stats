import React, { useState, useMemo } from 'react';
import { Shirt, Zap, TrendingUp } from 'lucide-react';
import CheckInSystem from './CheckInSystem';
import PlayerCard from './PlayerCard';
import LeaderboardRow from './LeaderboardRow';
import { calculateOverall, calculateStatsFromMatches } from '../utils/helpers';

export default function DashboardView({
    players,
    upcomingTeams,
    sortedPlayers: globalSortedPlayers, // Rename to avoid conflict
    playerStreaks,
    checkins,
    matches, // NEW: Matches for local calculation
    authStatus,
    setSelectedPlayerForEdit
}) {
    const [filterYear, setFilterYear] = useState('2026');

    // 1. Filter Matches
    const filteredMatches = useMemo(() => {
        if (!matches) return [];
        if (filterYear === 'all') return matches;
        return matches.filter(m => {
            if (!m.date) return false;
            const date = new Date(m.date.seconds * 1000);
            return date.getFullYear() === 2026;
        });
    }, [matches, filterYear]);

    // 2. Process Players (Calculate 2026 stats if needed)
    const dashboardData = useMemo(() => {
        const data = players.map(p => {
            let dynamicStats;
            if (filterYear === '2026') {
                const matchStats = calculateStatsFromMatches(p, filteredMatches);
                dynamicStats = {
                    goals: matchStats.goals + (p.season2026?.goals || 0),
                    wins: matchStats.wins + (p.season2026?.wins || 0),
                    gamesPlayed: matchStats.gamesPlayed + (p.season2026?.games || 0),
                    assists: matchStats.assists + (p.season2026?.assists || 0),
                    cleanSheets: matchStats.cleanSheets + (p.season2026?.cleanSheets || 0),
                    goalsFor: matchStats.goalsFor + (p.season2026?.goalsFor || 0),
                    goalsAgainst: matchStats.goalsAgainst + (p.season2026?.goalsAgainst || 0),
                    motms: (matchStats.motms || 0) + (p.season2026?.motms || 0)
                };
                dynamicStats.goalContrib = dynamicStats.goals + dynamicStats.assists;
            } else {
                // Use stored stats for All Time
                dynamicStats = {
                    goals: p.goals || 0,
                    wins: p.wins || 0,
                    gamesPlayed: p.gamesPlayed || 0,
                    assists: p.assists || 0,
                    cleanSheets: p.cleanSheets || 0, // Fallback if not in top-level
                    goalContrib: (p.goals || 0) + (p.assists || 0),
                    motms: p.motms || 0
                };
            }

            return {
                ...p,
                ...dynamicStats,
                // Recalculate OVR based on these stats
                overall: calculateOverall(p, dynamicStats, playerStreaks && playerStreaks[p.id]?.formScore, filterYear === '2026')
            };
        });

        // Filter out 0 games for the Standings List
        const activePlayers = data.filter(p => p.gamesPlayed > 0);

        // Sort by Overall
        return activePlayers.sort((a, b) => b.overall - a.overall);
    }, [players, filteredMatches, filterYear, playerStreaks]);


    // 3. Leaders Logic (Min Games Rule)
    const leaders = useMemo(() => {
        const totalMatches = filteredMatches.length;
        // Logic: All Time > 5. 2026 > 1 (until 5 games played).
        // If filterYear 2026 AND total matches < 5, min is 1.
        // If filterYear 2026 AND total matches >= 5, min is 5 (following standard rule logic, or sticky to 1? User said "until 5 games have been played" implies rule changes after).
        // Let's interpret "until 5 games have been played" as: if the filtered set has < 5 matches total, we accept low game counts.

        let minGames = 5;
        if (filterYear === '2026') {
            minGames = totalMatches < 5 ? 1 : 5;
        }

        return dashboardData.filter(p => p.gamesPlayed >= minGames).slice(0, 3);
    }, [dashboardData, filteredMatches, filterYear]);
    return (
        <div className="space-y-12">
            <CheckInSystem players={players} currentUserRole={authStatus.role} />

            {upcomingTeams && (
                <section className="bg-slate-900/50 p-6 rounded-xl border border-blue-500/20 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Shirt size={120} /></div>
                    <h2 className="text-white font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2 relative z-10">
                        <Shirt size={16} className="text-blue-400" /> Upcoming Match Squads
                    </h2>
                    <div className="grid grid-cols-2 gap-8 relative z-10">
                        <div>
                            <h3 className="text-blue-400 font-black uppercase text-center mb-3">Blue Team</h3>
                            <div className="space-y-1">
                                {upcomingTeams.blue && upcomingTeams.blue.map(pid => {
                                    const p = players.find(x => x.id === pid);
                                    return p ? <div key={pid} className="bg-slate-800 text-white text-xs font-bold px-2 py-1.5 rounded">{p.name}</div> : null;
                                })}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-white font-black uppercase text-center mb-3">White Team</h3>
                            <div className="space-y-1">
                                {upcomingTeams.white && upcomingTeams.white.map(pid => {
                                    const p = players.find(x => x.id === pid);
                                    return p ? <div key={pid} className="bg-slate-700 text-slate-200 text-xs font-bold px-2 py-1.5 rounded">{p.name}</div> : null;
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="text-center mt-4 text-[10px] text-slate-500 uppercase font-mono">
                        Generated {upcomingTeams.timestamp ? new Date(upcomingTeams.timestamp.seconds * 1000).toLocaleString() : ''}
                    </div>
                </section>
            )}

            <section>
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-slate-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                        <Zap size={16} /> Current Form Leaders
                    </h2>

                    {/* TOGGLE */}
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setFilterYear('all')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${filterYear === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            All Time
                        </button>
                        <button
                            onClick={() => setFilterYear('2026')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${filterYear === '2026' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            2026
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                    <div className="md:order-2 transform md:-translate-y-4 z-10">
                        {leaders[0] && <PlayerCard player={leaders[0]} rank={1} streaks={playerStreaks[leaders[0].id]} seasonStats={leaders[0]} forceDynamic={filterYear === '2026'} />}
                    </div>
                    <div className="md:order-1 transform md:translate-y-4">
                        {leaders[1] && <PlayerCard player={leaders[1]} rank={2} streaks={playerStreaks[leaders[1].id]} seasonStats={leaders[1]} forceDynamic={filterYear === '2026'} />}
                    </div>
                    <div className="hidden md:block md:order-3 transform md:translate-y-8">
                        {leaders[2] && <PlayerCard player={leaders[2]} rank={3} streaks={playerStreaks[leaders[2].id]} seasonStats={leaders[2]} forceDynamic={filterYear === '2026'} />}
                    </div>
                    <div className="block md:hidden col-span-2 sm:col-span-1 mx-auto w-1/2 sm:w-full">
                        {leaders[2] && <PlayerCard player={leaders[2]} rank={3} streaks={playerStreaks[leaders[2].id]} seasonStats={leaders[2]} forceDynamic={filterYear === '2026'} />}
                    </div>
                </div>
            </section>

            <section>
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-slate-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                        <TrendingUp size={16} /> Season Standings
                    </h2>
                </div>
                <div className="bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
                    {dashboardData.map((player, idx) => (
                        <div
                            key={player.id}
                            onClick={() => { if (authStatus.role === 'admin') setSelectedPlayerForEdit(player); }}
                            className={`${authStatus.role === 'admin' ? 'cursor-pointer' : ''}`}
                        >
                            <LeaderboardRow
                                player={player}
                                rank={idx + 1}
                                overall={player.overall}
                                stats={player}
                                showAssists={filterYear === '2026'}
                            />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
