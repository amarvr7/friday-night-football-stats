import React, { useState, useMemo } from 'react';
import { ArrowDown, ArrowUp, BarChart2, Search, Plus } from 'lucide-react';
import { calculateOverall, calculateStatsFromMatches } from '../utils/helpers';

const StatsView = ({ players, matches, playerStreaks, onSelectPlayer, onAddMatch, currentUserRole }) => {
    const [sortField, setSortField] = useState('overall');
    const [sortDesc, setSortDesc] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState('all');

    const filteredMatches = useMemo(() => {
        if (filterYear === 'all') return matches;
        return matches.filter(m => {
            if (!m.date) return false;
            const date = new Date(m.date.seconds * 1000);
            return date.getFullYear() === 2026;
        });
    }, [matches, filterYear]);

    const processedPlayers = useMemo(() => {
        return players.map(p => {
            let dynamicStats = { goals: 0, wins: 0, gamesPlayed: 0, assists: 0, cleanSheets: 0, goalContrib: 0, goalsFor: 0, goalsAgainst: 0 };

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
                const matchStats = calculateStatsFromMatches(p, filteredMatches); // filteredMatches is ALL matches here
                dynamicStats = {
                    goals: (p.goals || 0) + (p.season2026?.goals || 0) + matchStats.goals,
                    wins: (p.wins || 0) + (p.season2026?.wins || 0) + matchStats.wins,
                    gamesPlayed: (p.gamesPlayed || 0) + (p.season2026?.games || 0) + matchStats.gamesPlayed,
                    assists: (p.assists || 0) + (p.season2026?.assists || 0) + matchStats.assists,
                    cleanSheets: (p.cleanSheets || 0) + (p.season2026?.cleanSheets || 0) + matchStats.cleanSheets,
                    goalContrib: (p.goals || 0) + (p.assists || 0) + (p.season2026?.goals || 0) + (p.season2026?.assists || 0) + matchStats.goals + matchStats.assists,
                    goalsFor: (p.goalsFor || 0) + (p.season2026?.goalsFor || 0) + matchStats.goalsFor,
                    goalsAgainst: (p.goalsAgainst || 0) + (p.season2026?.goalsAgainst || 0) + matchStats.goalsAgainst,
                    motms: (p.motms || 0) + (p.season2026?.motms || 0) + matchStats.motms
                };
            }

            return {
                ...p,
                ...dynamicStats,
                winRate: dynamicStats.gamesPlayed > 0 ? (dynamicStats.wins / dynamicStats.gamesPlayed) * 100 : 0,
                goalsPerGame: dynamicStats.gamesPlayed > 0 ? dynamicStats.goals / dynamicStats.gamesPlayed : 0,
                overall: calculateOverall(p, dynamicStats, playerStreaks && playerStreaks[p.id]?.formScore, filterYear === '2026')
            };
        }).filter(p => filterYear === 'all' || p.gamesPlayed > 0);
    }, [players, filteredMatches, filterYear, playerStreaks]);

    const sortedData = useMemo(() => {
        let data = [...processedPlayers];
        if (searchTerm) {
            data = data.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        data.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }
            if (sortDesc) return valA < valB ? 1 : -1;
            return valA > valB ? 1 : -1;
        });
        return data;
    }, [processedPlayers, sortField, sortDesc, searchTerm]);

    const [viewMode, setViewMode] = useState('players'); // 'players' or 'matches'

    const handleSort = (field) => {
        if (sortField === field) setSortDesc(!sortDesc);
        else { setSortField(field); setSortDesc(true); }
    };

    const SortHeader = ({ field, label }) => (
        <th className="p-3 text-left cursor-pointer hover:text-white transition-colors" onClick={() => handleSort(field)}>
            <div className="flex items-center gap-1">
                {label}
                {sortField === field && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
            </div>
        </th>
    );

    return (
        <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 flex flex-col h-full max-h-[80vh]">
            <div className="p-4 border-b border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BarChart2 className="text-blue-400" /> Stats
                    </h2>
                    <div className="flex gap-2">
                        <div className="flex bg-slate-900 rounded-lg p-1">
                            <button onClick={() => setViewMode('players')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${viewMode === 'players' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Players</button>
                            <button onClick={() => setViewMode('matches')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${viewMode === 'matches' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Matches</button>
                        </div>
                        <div className="flex bg-slate-900 rounded-lg p-1">
                            <button onClick={() => setFilterYear('all')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${filterYear === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>All Time</button>
                            <button onClick={() => setFilterYear('2026')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${filterYear === '2026' ? 'bg-green-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>2026</button>
                        </div>
                    </div>
                </div>

                {viewMode === 'players' && (
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                        <input type="text" placeholder="Find a player..." className="w-full bg-slate-900 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                )}
            </div>

            <div className="overflow-auto flex-1">
                {viewMode === 'players' ? (
                    <>
                        <table className="w-full text-sm text-slate-300">
                            <thead className="bg-slate-900 text-slate-500 uppercase font-bold text-xs sticky top-0 z-10">
                                <tr>
                                    <SortHeader field="name" label="Player" />
                                    <SortHeader field="gamesPlayed" label="GP" />
                                    <SortHeader field="wins" label="Wins" />
                                    <SortHeader field="winRate" label="Win %" />
                                    <SortHeader field="goals" label="G" />
                                    <SortHeader field="goalsPerGame" label="GPG" />
                                    {filterYear === '2026' && <SortHeader field="assists" label="A" />}
                                    {filterYear === '2026' && <SortHeader field="goalContrib" label="G+A" />}
                                    {filterYear === '2026' && <SortHeader field="cleanSheets" label="CS" />}
                                    {filterYear === '2026' && <SortHeader field="goalsFor" label="GF" />}
                                    {filterYear === '2026' && <SortHeader field="goalsAgainst" label="GA" />}
                                    <SortHeader field="motms" label="MOTM" />
                                    <SortHeader field="overall" label="OVR" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {sortedData.map(p => (
                                    <tr key={p.id} onClick={() => onSelectPlayer(p)} className="hover:bg-slate-700/50 cursor-pointer transition-colors">
                                        <td className="p-3 font-bold text-white">{p.name}</td>
                                        <td className="p-3">{p.gamesPlayed}</td>
                                        <td className="p-3 text-green-400">{p.wins % 1 === 0 ? p.wins : p.wins.toFixed(1)}</td>
                                        <td className="p-3">{p.winRate.toFixed(1)}%</td>
                                        <td className="p-3 text-white">{p.goals}</td>
                                        <td className="p-3 text-white">{p.goalsPerGame.toFixed(2)}</td>
                                        {filterYear === '2026' && <td className="p-3">{p.assists}</td>}
                                        {filterYear === '2026' && <td className="p-3 text-blue-400 font-bold">{p.goalContrib}</td>}
                                        {filterYear === '2026' && <td className="p-3 text-yellow-400">{p.cleanSheets}</td>}
                                        {filterYear === '2026' && <td className="p-3">{p.goalsFor}</td>}
                                        {filterYear === '2026' && <td className="p-3">{p.goalsAgainst}</td>}
                                        <td className="p-3 text-orange-400 font-bold">{p.motms || 0}</td>
                                        <td className="p-3 font-bold text-yellow-500">{p.overall}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedData.length === 0 && <div className="p-8 text-center text-slate-500">No players found.</div>}
                    </>
                ) : (
                    <div className="p-4 space-y-3">
                        {currentUserRole === 'admin' && (
                            <button
                                onClick={onAddMatch}
                                className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/50 p-4 rounded-xl flex items-center justify-center gap-2 font-bold mb-4 transition-all"
                            >
                                <Plus size={20} /> Log New Match Result
                            </button>
                        )}
                        {filteredMatches.map(m => {
                            // Derive score from first player stats
                            const pIds = Object.keys(m.stats);
                            if (pIds.length === 0) return null;
                            const firstP = m.stats[pIds[0]];
                            const isBlue = firstP.team === 'blue';
                            const blueScore = isBlue ? firstP.goalsFor : firstP.goalsAgainst;
                            const whiteScore = isBlue ? firstP.goalsAgainst : firstP.goalsFor;
                            const date = m.date ? new Date(m.date.seconds * 1000).toLocaleDateString() : 'Unknown Date';

                            // Helper to get events
                            const getEvents = (teamColor) => {
                                const events = [];
                                pIds.forEach(pid => {
                                    const pStats = m.stats[pid];
                                    if (pStats.team === teamColor) {
                                        if (pStats.goals > 0) events.push({ type: 'goal', player: players.find(p => p.id === pid)?.name, count: pStats.goals });
                                        if (pStats.assists > 0) events.push({ type: 'assist', player: players.find(p => p.id === pid)?.name, count: pStats.assists });
                                    }
                                });
                                return events;
                            };

                            const blueEvents = getEvents('blue');
                            const whiteEvents = getEvents('white');

                            return (
                                <div key={m.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="text-slate-500 text-xs font-bold uppercase w-20">{date}</div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <span className="text-blue-400 font-bold uppercase text-xs block">Blue</span>
                                                <span className="text-2xl font-black text-white">{blueScore}</span>
                                            </div>
                                            <div className="text-slate-600 font-black text-lg">VS</div>
                                            <div className="text-left">
                                                <span className="text-slate-300 font-bold uppercase text-xs block">White</span>
                                                <span className="text-2xl font-black text-white">{whiteScore}</span>
                                            </div>
                                        </div>
                                        <div className="w-20 text-right">
                                            {m.motm && (
                                                <div className="inline-block text-center">
                                                    <span className="text-[10px] text-yellow-500 font-bold block uppercase">MOTM</span>
                                                    <span className="text-xs text-white font-bold max-w-[80px] truncate block">
                                                        {players.find(p => p.id === m.motm)?.name || 'Unknown'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Match Events */}
                                    <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-3 mt-3">
                                        <div className="w-1/2 pr-2">
                                            {blueEvents.map((e, idx) => (
                                                <div key={idx} className="flex justify-end gap-1 mb-1">
                                                    <span className="text-white font-bold">{e.player}</span>
                                                    {e.type === 'goal' && <span>⚽ {e.count > 1 ? `(${e.count})` : ''}</span>}
                                                    {e.type === 'assist' && <span>👟 {e.count > 1 ? `(${e.count})` : ''}</span>}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="w-1/2 pl-2 border-l border-slate-800">
                                            {whiteEvents.map((e, idx) => (
                                                <div key={idx} className="flex justify-start gap-1 mb-1">
                                                    {e.type === 'goal' && <span>⚽ {e.count > 1 ? `(${e.count})` : ''}</span>}
                                                    {e.type === 'assist' && <span>👟 {e.count > 1 ? `(${e.count})` : ''}</span>}
                                                    <span className="text-white font-bold">{e.player}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredMatches.length === 0 && <div className="text-center text-slate-500 mt-8">No matches recorded yet.</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsView;
