import React, { useState, useMemo } from 'react';
import { Shirt, Zap, TrendingUp } from 'lucide-react';
import CheckInSystem from './CheckInSystem';
import LeaderboardRow from './LeaderboardRow';
import { calculateOverall, getPlayerStats } from '../utils/helpers';

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

    // Process Players with unified getPlayerStats
    const dashboardData = useMemo(() => {
        const data = players.map(p => {
            const dynamicStats = getPlayerStats(p, matches, filterYear);

            return {
                ...p,
                ...dynamicStats,
                // Recalculate OVR based on these stats
                overall: calculateOverall(p, dynamicStats, playerStreaks && playerStreaks[p.id], filterYear === '2026')
            };
        });

        // Filter out 0 games for the Standings List
        const activePlayers = data.filter(p => p.gamesPlayed > 0);

        // Sort by Overall
        return activePlayers.sort((a, b) => b.overall - a.overall);
    }, [players, matches, filterYear, playerStreaks]);




    // 4. Compact Mini Leaderboards for Scorers, Assists, Clean Sheets
    const topScorers = useMemo(() => {
        return [...dashboardData].sort((a, b) => b.goals - a.goals).slice(0, 3);
    }, [dashboardData]);

    const topAssists = useMemo(() => {
        return [...dashboardData].sort((a, b) => b.assists - a.assists).slice(0, 3);
    }, [dashboardData]);

    const topCleanSheets = useMemo(() => {
        return [...dashboardData].sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 3);
    }, [dashboardData]);

    const RenderMiniLeaderboard = ({ title, icon, playersList, statField, statName, onSelect }) => {
        return (
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-805 rounded-2xl p-3 sm:p-4 shadow-lg hover:border-slate-700/60 transition-all flex flex-col">
                <h3 className="text-white font-black text-xs uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                    {icon} {title}
                </h3>
                <div className="space-y-2.5 sm:space-y-3">
                    {playersList.map((player, idx) => {
                        const value = player[statField] || 0;
                        return (
                            <div 
                                key={player.id} 
                                onClick={() => onSelect(player)}
                                className="flex items-center justify-between group/row cursor-pointer py-1 min-h-[44px]"
                            >
                                <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                                    <span className={`w-4 text-center text-[10px] font-black flex-shrink-0 ${
                                        idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-400' : 'text-amber-600'
                                    }`}>
                                        {idx + 1}.
                                    </span>
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-750 bg-slate-850 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                        <img 
                                            src={player.photoUrl || '/logo.png'} 
                                            alt={player.name} 
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <span className="text-xs sm:text-sm font-bold text-slate-200 group-hover/row:text-blue-405 transition-colors truncate">
                                        {player.name}
                                    </span>
                                </div>
                                <span className="text-cyan-400 font-black text-sm sm:text-base font-mono flex-shrink-0 ml-2">
                                    {value} <span className="text-[9px] text-slate-500 font-bold uppercase hidden xs:inline">{statName}</span>
                                </span>
                            </div>
                        );
                    })}
                    {playersList.length === 0 && (
                        <div className="text-slate-600 text-xs font-bold text-center py-6">No data available</div>
                    )}
                </div>
            </div>
        );
    };
    return (
        <div className="space-y-12">
            <CheckInSystem players={players} currentUserRole={authStatus.role} />

            {upcomingTeams && (() => {
                const isQuad = upcomingTeams.mode === 'quad';

                const TeamList = ({ title, ids, titleClass, rowClass }) => (
                    <div>
                        <h3 className={`font-black uppercase text-center text-xs sm:text-sm mb-3 ${titleClass}`}>{title}</h3>
                        <div className="space-y-1">
                            {(ids || []).map(pid => {
                                const p = players.find(x => x.id === pid);
                                return p ? <div key={pid} className={`text-xs font-bold px-3 py-2 rounded ${rowClass}`}>{p.name}</div> : null;
                            })}
                        </div>
                    </div>
                );

                return (
                    <section className="bg-slate-900/50 p-4 sm:p-6 rounded-xl border border-blue-500/20 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Shirt size={120} /></div>
                        <h2 className="text-white font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2 relative z-10">
                            <Shirt size={16} className="text-blue-400" /> {isQuad ? 'Big Night — 2 Games, 4 Teams' : 'Upcoming Match Squads'}
                        </h2>

                        {isQuad && (
                            <h3 className="text-slate-400 font-bold uppercase text-[10px] sm:text-xs tracking-wider mb-3 relative z-10">⚽ Game 1 — Kickoff First</h3>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 relative z-10">
                            <TeamList title="Blue Team" ids={upcomingTeams.blue} titleClass="text-blue-400" rowClass="bg-slate-800 text-white" />
                            <TeamList title="White Team" ids={upcomingTeams.white} titleClass="text-white" rowClass="bg-slate-700 text-slate-200" />
                        </div>

                        {isQuad && (
                            <>
                                <h3 className="text-slate-400 font-bold uppercase text-[10px] sm:text-xs tracking-wider mt-6 mb-3 relative z-10">⚽ Game 2 — Straight After</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 relative z-10">
                                    <TeamList title="Red Team" ids={upcomingTeams.red} titleClass="text-red-400" rowClass="bg-red-900/30 text-white border border-red-500/20" />
                                    <TeamList title="Green Team" ids={upcomingTeams.green} titleClass="text-green-400" rowClass="bg-green-900/30 text-white border border-green-500/20" />
                                </div>
                            </>
                        )}

                        <div className="text-center mt-4 text-[9px] sm:text-[10px] text-slate-500 uppercase font-mono break-words">
                            Generated {upcomingTeams.timestamp ? new Date(upcomingTeams.timestamp.seconds * 1000).toLocaleString() : ''}
                        </div>
                    </section>
                );
            })()}

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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    <RenderMiniLeaderboard 
                        title="Top Scorers" 
                        icon="⚽" 
                        playersList={topScorers} 
                        statField="goals" 
                        statName="goals" 
                        onSelect={(p) => setSelectedPlayerForEdit(p)} 
                    />
                    <RenderMiniLeaderboard 
                        title="Top Playmakers" 
                        icon="👟" 
                        playersList={topAssists} 
                        statField="assists" 
                        statName="assists" 
                        onSelect={(p) => setSelectedPlayerForEdit(p)} 
                    />
                    <RenderMiniLeaderboard 
                        title="Clean Sheets" 
                        icon="🧤" 
                        playersList={topCleanSheets} 
                        statField="cleanSheets" 
                        statName="cs" 
                        onSelect={(p) => setSelectedPlayerForEdit(p)} 
                    />
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
                                showAssists={true}
                            />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
