import React, { useState, useMemo } from 'react';
import { Shirt, Zap, TrendingUp } from 'lucide-react';
import CheckInSystem from './CheckInSystem';
import LeaderboardRow from './LeaderboardRow';
import LastMatchCard from './LastMatchCard';
import { calculateOverall, getPlayerStats } from '../utils/helpers';
import { getPremierLeagueLeaderboards } from '../utils/statsEngine';

// Thursday/Friday are match-planning days: check-in goes first. Otherwise lead with the result.
const MATCH_PLANNING_DAYS = [4, 5];

export default function DashboardView({
    players,
    upcomingTeams,
    sortedPlayers: globalSortedPlayers, // Rename to avoid conflict
    playerStreaks,
    checkins,
    matches, // NEW: Matches for local calculation
    ratingWeights = {},
    authStatus,
    setSelectedPlayerForEdit,
    onViewAllMatches,
    onRegenerateReport = null,
    generatingMatchId = null,
    reportErrors = {}
}) {
    const [filterYear, setFilterYear] = useState('2026');
    const isPlanningDay = MATCH_PLANNING_DAYS.includes(new Date().getDay());

    const lastMatchSection = (
        <LastMatchCard
            matches={matches}
            players={players}
            ratingWeights={ratingWeights}
            onSelectPlayer={(p) => setSelectedPlayerForEdit(p, '2026')}
            onViewAllMatches={onViewAllMatches}
            canRegenerate={authStatus?.role === 'admin'}
            onRegenerateReport={onRegenerateReport}
            generatingMatchId={generatingMatchId}
            reportErrors={reportErrors}
        />
    );

    // Process Players with unified getPlayerStats
    const dashboardData = useMemo(() => {
        const data = players.map(p => {
            const dynamicStats = getPlayerStats(p, matches, filterYear, ratingWeights);

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
    }, [players, matches, filterYear, playerStreaks, ratingWeights]);

    // Premier League-style Leaderboards: Golden Boot, Playmaker, Most Wins, Clean Sheets
    const plLeaderboards = useMemo(
        () => getPremierLeagueLeaderboards(players, matches, filterYear, ratingWeights, getPlayerStats),
        [players, matches, filterYear, ratingWeights]
    );

    const topScorers = useMemo(() => plLeaderboards.goldenBoot.slice(0, 3), [plLeaderboards]);
    const topAssists = useMemo(() => plLeaderboards.playmaker.slice(0, 3), [plLeaderboards]);
    const topWins = useMemo(() => plLeaderboards.mostWins.slice(0, 3), [plLeaderboards]);
    const topCleanSheets = useMemo(() => plLeaderboards.cleanSheets.slice(0, 3), [plLeaderboards]);

    const RenderMiniLeaderboard = ({ title, subtitle, icon, playersList, statField, statName, subStatFormatter, onSelect }) => {
        return (
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg hover:border-slate-700/60 transition-all flex flex-col">
                <div className="border-b border-slate-800 pb-2 mb-3 sm:mb-4">
                    <h3 className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-2">
                        <span>{icon}</span> <span className="truncate">{title}</span>
                    </h3>
                    {subtitle && (
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mt-0.5">
                            {subtitle}
                        </span>
                    )}
                </div>
                <div className="space-y-2.5 sm:space-y-3">
                    {playersList.map((player, idx) => {
                        const rawVal = player[statField] || 0;
                        const value = statField === 'wins' && rawVal % 1 !== 0 ? rawVal.toFixed(1) : rawVal;
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
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-700 bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                        <img 
                                            src={player.photoUrl || '/logo.png'} 
                                            alt={player.name} 
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs sm:text-sm font-bold text-slate-200 group-hover/row:text-blue-400 transition-colors truncate block">
                                            {player.name}
                                        </span>
                                        {subStatFormatter && (
                                            <span className="text-[10px] text-slate-500 font-semibold block truncate">
                                                {subStatFormatter(player)}
                                            </span>
                                        )}
                                    </div>
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
            {!isPlanningDay && lastMatchSection}

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
                        <div className="grid grid-cols-2 gap-3 sm:gap-8 relative z-10">
                            <TeamList title="Blue Team" ids={upcomingTeams.blue} titleClass="text-blue-400" rowClass="bg-slate-800 text-white" />
                            <TeamList title="White Team" ids={upcomingTeams.white} titleClass="text-white" rowClass="bg-slate-700 text-slate-200" />
                        </div>

                        {isQuad && (
                            <>
                                <h3 className="text-slate-400 font-bold uppercase text-[10px] sm:text-xs tracking-wider mt-6 mb-3 relative z-10">⚽ Game 2 — Straight After</h3>
                                <div className="grid grid-cols-2 gap-3 sm:gap-8 relative z-10">
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

            {isPlanningDay && lastMatchSection}

            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-slate-300 font-black uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2">
                        <Zap size={16} className="text-yellow-400" /> {filterYear === '2026' ? '2026 Season Leaders' : 'All-Time Leaders'}
                    </h2>

                    {/* TOGGLE */}
                    <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700/80">
                        <button
                            onClick={() => setFilterYear('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterYear === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            All Time
                        </button>
                        <button
                            onClick={() => setFilterYear('2026')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterYear === '2026' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            2026
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    <RenderMiniLeaderboard 
                        title="Golden Boot" 
                        subtitle="Most Goals"
                        icon="👟⚽" 
                        playersList={topScorers} 
                        statField="goals" 
                        statName="goals" 
                        subStatFormatter={(p) => `${(p.goalsPerGame || 0).toFixed(2)} G/App · ${p.gamesPlayed} GP`}
                        onSelect={(p) => setSelectedPlayerForEdit(p, filterYear)} 
                    />
                    <RenderMiniLeaderboard 
                        title="Playmaker" 
                        subtitle="Most Assists"
                        icon="🎯" 
                        playersList={topAssists} 
                        statField="assists" 
                        statName="assists" 
                        subStatFormatter={(p) => `${(p.assistsPerGame || 0).toFixed(2)} A/App · ${p.goalContrib} G+A`}
                        onSelect={(p) => setSelectedPlayerForEdit(p, filterYear)} 
                    />
                    <RenderMiniLeaderboard 
                        title="Most Wins" 
                        subtitle="Victory Leaders"
                        icon="🏆" 
                        playersList={topWins} 
                        statField="wins" 
                        statName="wins" 
                        subStatFormatter={(p) => `${(p.winRate || 0).toFixed(0)}% Win · ${p.gamesPlayed} GP`}
                        onSelect={(p) => setSelectedPlayerForEdit(p, filterYear)} 
                    />
                    <RenderMiniLeaderboard 
                        title="Clean Sheets" 
                        subtitle="Golden Glove"
                        icon="🧤" 
                        playersList={topCleanSheets} 
                        statField="cleanSheets" 
                        statName="cs" 
                        subStatFormatter={(p) => `${p.gamesPlayed} GP · ${p.goalsAgainst || 0} GA`}
                        onSelect={(p) => setSelectedPlayerForEdit(p, filterYear)} 
                    />
                </div>
            </section>

            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-slate-300 font-black uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2">
                        <TrendingUp size={16} className="text-green-400" /> {filterYear === '2026' ? '2026 Standings' : 'All-Time Standings'}
                    </h2>
                    <span className="text-[11px] text-slate-500 font-bold">Tap player for card</span>
                </div>
                <div className="bg-slate-800/90 rounded-2xl overflow-hidden shadow-xl border border-slate-700/80">
                    {dashboardData.map((player, idx) => (
                        <div
                            key={player.id}
                            onClick={() => setSelectedPlayerForEdit(player, filterYear)}
                            className="cursor-pointer"
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
                    {dashboardData.length === 0 && (
                        <div className="p-8 text-center text-slate-500 text-sm">No active players for this period yet.</div>
                    )}
                </div>
            </section>
        </div>
    );
}
