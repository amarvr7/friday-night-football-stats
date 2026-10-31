import React, { useState, useMemo, useEffect } from 'react';
import { ArrowDown, ArrowUp, BarChart2, Search, Plus, Edit2, Trash2, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateOverall, getPlayerStats } from '../utils/helpers';
import { filterMatchesBySeason, getMatchSummary } from '../utils/matchHelpers';
import LeaderboardGrid from './LeaderboardGrid';
import CompareView from './CompareView';
import MatchEventsList from './MatchEventsList';
import MatchLineups from './MatchLineups';

const VIEW_MODES = [
    { id: 'leaderboards', label: 'Leaders' },
    { id: 'players', label: 'Table' },
    { id: 'matches', label: 'Matches' },
    { id: 'compare', label: 'Compare' }
];

// navRequest: { mode, season, compareA, nonce } — lets other screens deep-link into a tab
const StatsView = ({ players, matches, playerStreaks, onSelectPlayer, onAddMatch, onEditMatch, onDeleteMatch, currentUserRole, navRequest = null }) => {
    const [sortField, setSortField] = useState('overall');
    const [sortDesc, setSortDesc] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState(navRequest?.season || '2026');
    const [viewMode, setViewMode] = useState(navRequest?.mode || 'leaderboards'); // 'leaderboards' | 'players' | 'matches' | 'compare'
    const [expandedMatches, setExpandedMatches] = useState({});
    const [compareA, setCompareA] = useState(navRequest?.compareA || null);

    useEffect(() => {
        if (!navRequest) return;
        if (navRequest.mode) setViewMode(navRequest.mode);
        if (navRequest.season) setFilterYear(navRequest.season);
        if (navRequest.compareA !== undefined) setCompareA(navRequest.compareA);
    }, [navRequest]);

    const filteredMatches = useMemo(() => filterMatchesBySeason(matches || [], filterYear), [matches, filterYear]);

    const processedPlayers = useMemo(() => {
        return players.map(p => {
            const dynamicStats = getPlayerStats(p, matches, filterYear);

            return {
                ...p,
                ...dynamicStats,
                overall: calculateOverall(p, dynamicStats, playerStreaks && playerStreaks[p.id], filterYear === '2026')
            };
        }).filter(p => filterYear === 'all' || p.gamesPlayed > 0);
    }, [players, matches, filterYear, playerStreaks]);

    const sortedData = useMemo(() => {
        let data = [...processedPlayers];
        if (searchTerm) {
            data = data.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        data.sort((a, b) => {
            let valA = a[sortField] ?? 0;
            let valB = b[sortField] ?? 0;
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
            }
            if (sortDesc) return valA < valB ? 1 : -1;
            return valA > valB ? 1 : -1;
        });
        return data;
    }, [processedPlayers, sortField, sortDesc, searchTerm]);

    const handleNavigateToFullList = (field, ascending) => {
        setSortField(field);
        setSortDesc(!ascending);
        setViewMode('players');
    };

    const toggleMatch = (id) => {
        setExpandedMatches(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleShareMatch = (summary) => {
        const { date, blueScore, whiteScore, blueEvents, whiteEvents, labels, wentToPks, pkWinner, motmPlayer } = summary;
        const dateText = date ? date.toLocaleDateString() : 'Recent Match';
        const bLabel = labels?.blue || 'Blue';
        const wLabel = labels?.white || 'White';
        const bEmoji = bLabel === 'Red' ? '🔴' : '🔵';
        const wEmoji = wLabel === 'Green' ? '🟢' : '⚪️';

        let text = `🏆 Friday Night Match Result - ${dateText} 🏆\n\n${bEmoji} ${bLabel}: ${blueScore}\n${wEmoji} ${wLabel}: ${whiteScore}\n`;
        if (wentToPks) {
            text += `(${pkWinner === 'blue' ? bLabel : wLabel} won on penalties!)\n`;
        }

        const formatEvents = (events) => {
            if (!events || events.length === 0) return 'None';
            return events.map(e => {
                let symbol = e.type === 'goal' ? '⚽' : (e.type === 'assist' ? '👟' : '❌');
                let countStr = e.count > 1 ? ` (x${e.count})` : '';
                return `${symbol} ${e.player}${countStr}`;
            }).join('\n');
        };

        if (blueEvents && blueEvents.length > 0) {
            text += `\n${bEmoji} ${bLabel} Events:\n${formatEvents(blueEvents)}\n`;
        }
        if (whiteEvents && whiteEvents.length > 0) {
            text += `\n${wEmoji} ${wLabel} Events:\n${formatEvents(whiteEvents)}\n`;
        }
        
        if (motmPlayer) {
            text += `\n⭐️ MOTM: ${motmPlayer.name}\n`;
        }

        if (navigator.share) {
            navigator.share({
                title: 'Match Result',
                text: text
            }).catch(err => {
                if (err?.name !== 'AbortError') {
                    navigator.clipboard.writeText(text);
                    alert("Match result copied to clipboard!");
                }
            });
        } else {
            navigator.clipboard.writeText(text);
            alert("Match result copied to clipboard!");
        }
    };

    const handleSort = (field) => {
        if (sortField === field) setSortDesc(!sortDesc);
        else { setSortField(field); setSortDesc(true); }
    };

    const SortHeader = ({ field, label, stickyLeft = false }) => (
        <th
            className={`p-2.5 sm:p-3 text-left cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap ${
                stickyLeft ? 'sticky left-0 z-20 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.3)]' : ''
            } ${sortField === field ? 'text-blue-400' : ''}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortField === field && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
            </div>
        </th>
    );

    return (
        <div className="bg-slate-800/90 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col">
            {/* Sticky Control Bar */}
            <div className="p-3 sm:p-4 border-b border-slate-700/80 sticky top-14 z-20 bg-slate-900/95 backdrop-blur-md rounded-t-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2 uppercase italic tracking-wide">
                            <BarChart2 className="text-blue-400" size={20} /> Stats Hub
                        </h2>
                        {/* Season Toggle on Mobile Header Row */}
                        <div className="flex sm:hidden bg-slate-950 rounded-lg p-1 border border-slate-800">
                            <button onClick={() => setFilterYear('all')} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${filterYear === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}>All Time</button>
                            <button onClick={() => setFilterYear('2026')} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${filterYear === '2026' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500'}`}>2026</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 flex-1 sm:flex-none" role="tablist" aria-label="Stats views">
                            {VIEW_MODES.map(mode => (
                                <button
                                    key={mode.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={viewMode === mode.id}
                                    onClick={() => setViewMode(mode.id)}
                                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex-1 sm:flex-none whitespace-nowrap ${viewMode === mode.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    {mode.label}
                                    {mode.id === 'matches' && <span className="hidden sm:inline"> ({filteredMatches.length})</span>}
                                </button>
                            ))}
                        </div>
                        <div className="hidden sm:flex bg-slate-950 rounded-xl p-1 border border-slate-800">
                            <button onClick={() => setFilterYear('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterYear === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>All Time</button>
                            <button onClick={() => setFilterYear('2026')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterYear === '2026' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>2026</button>
                        </div>
                    </div>
                </div>

                {viewMode === 'players' && (
                    <div className="relative mt-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search player name..."
                            className="w-full bg-slate-950 text-white pl-9 pr-8 py-2.5 rounded-xl border border-slate-800 focus:border-blue-500 outline-none text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white font-bold"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content Area - Natural page scroll */}
            <div>
                {viewMode === 'leaderboards' ? (
                    <LeaderboardGrid 
                        players={players} 
                        matches={matches} 
                        filterYear={filterYear} 
                        onSelectPlayer={(p) => onSelectPlayer(p, filterYear)} 
                        onNavigateToFullList={handleNavigateToFullList} 
                    />
                ) : viewMode === 'players' ? (
                    <div>
                        <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-800 text-[11px] text-slate-400 flex justify-between items-center sm:hidden">
                            <span>Tap any column header to sort</span>
                            <span>Swipe table →</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm text-slate-300 min-w-[760px]">
                                <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] sm:text-xs border-b border-slate-700">
                                    <tr>
                                        <SortHeader field="name" label="Player" stickyLeft />
                                        <SortHeader field="overall" label="OVR" />
                                        <SortHeader field="gamesPlayed" label="GP" />
                                        <SortHeader field="wins" label="Wins" />
                                        <SortHeader field="winRate" label="Win %" />
                                        <SortHeader field="goals" label="G" />
                                        <SortHeader field="assists" label="A" />
                                        <SortHeader field="goalContrib" label="G+A" />
                                        <SortHeader field="goalsPerGame" label="GPG" />
                                        <SortHeader field="cleanSheets" label="CS" />
                                        <SortHeader field="hatTricks" label="HT" />
                                        <SortHeader field="motms" label="MOTM" />
                                        <SortHeader field="goalsFor" label="GF" />
                                        <SortHeader field="goalsAgainst" label="GA" />
                                        <SortHeader field="ownGoals" label="OG" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {sortedData.map((p, idx) => (
                                        <tr
                                            key={p.id}
                                            onClick={() => onSelectPlayer(p, filterYear)}
                                            className="hover:bg-slate-700/40 active:bg-slate-700/60 cursor-pointer transition-colors"
                                        >
                                            <td className="p-2.5 sm:p-3 font-bold text-white sticky left-0 z-10 bg-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-slate-500 w-4 flex-shrink-0">{idx + 1}</span>
                                                    <div className="w-7 h-7 rounded-full border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                                                        <img 
                                                            src={p.photoUrl || '/logo.png'} 
                                                            alt={p.name} 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <span className="truncate max-w-[105px] sm:max-w-[160px]">{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-2.5 sm:p-3 font-black text-cyan-400">{p.overall}</td>
                                            <td className="p-2.5 sm:p-3 font-mono">{p.gamesPlayed}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-green-400">{p.wins % 1 === 0 ? p.wins : p.wins.toFixed(1)}</td>
                                            <td className="p-2.5 sm:p-3 font-mono">{p.winRate.toFixed(0)}%</td>
                                            <td className="p-2.5 sm:p-3 font-mono font-bold text-white">{p.goals}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-slate-200">{p.assists}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-blue-400 font-bold">{p.goalContrib}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-slate-300">{p.goalsPerGame.toFixed(2)}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-teal-400">{p.cleanSheets}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-pink-400">{p.hatTricks || 0}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-yellow-400 font-bold">{p.motms || 0}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-slate-400">{p.goalsFor}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-slate-400">{p.goalsAgainst}</td>
                                            <td className="p-2.5 sm:p-3 font-mono text-red-400/80">{p.ownGoals || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {sortedData.length === 0 && <div className="p-8 text-center text-slate-500">No players found.</div>}
                        </div>
                    </div>
                ) : viewMode === 'compare' ? (
                    <CompareView
                        players={players}
                        matches={matches}
                        playerStreaks={playerStreaks}
                        filterYear={filterYear}
                        initialA={compareA}
                        onSelectPlayer={(p) => onSelectPlayer(p, filterYear)}
                    />
                ) : (
                    <div className="p-3 sm:p-4 space-y-3">
                        {currentUserRole === 'admin' && (
                            <button
                                onClick={onAddMatch}
                                className="w-full bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/40 p-3.5 rounded-xl flex items-center justify-center gap-2 font-bold mb-3 transition-all min-h-[48px]"
                            >
                                <Plus size={18} /> Log New Match Result
                            </button>
                        )}
                        {filteredMatches.map(m => {
                            const summary = getMatchSummary(m, players);
                            if (!summary) return null;
                            const { blueScore, whiteScore, labels, isRedGreen, wentToPks, pkWinner, motmPlayer, blueEvents, whiteEvents } = summary;
                            const date = summary.date ? summary.date.toLocaleDateString() : 'Just Now';

                            return (
                                <div key={m.id} className="bg-slate-900/90 p-3.5 sm:p-4 rounded-xl border border-slate-700/80 shadow-md">
                                    {/* Top Meta & Action Bar */}
                                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800">
                                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                            <span className="text-slate-400 text-xs font-bold uppercase">{date}</span>
                                            {motmPlayer && (
                                                <span className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[160px]">
                                                    ★ MOTM: {motmPlayer.name}
                                                </span>
                                            )}
                                            {wentToPks && (
                                                <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                    PKs: {pkWinner === 'blue' ? labels.blue : labels.white}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={() => handleShareMatch(summary)}
                                                className="p-2 bg-slate-800 text-blue-400 hover:text-blue-300 rounded-lg border border-slate-700 transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center"
                                                title="Share Match"
                                            >
                                                <Share2 size={14} />
                                            </button>
                                            {currentUserRole === 'admin' && (
                                                <>
                                                    <button
                                                        onClick={() => onEditMatch(m)}
                                                        className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center"
                                                        title="Edit Match"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteMatch(m)}
                                                        className="p-2 bg-slate-800 text-red-400 hover:text-red-300 rounded-lg border border-slate-700 transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center"
                                                        title="Delete Match"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scoreline Row */}
                                    <button
                                        type="button"
                                        onClick={() => toggleMatch(m.id)}
                                        aria-expanded={!!expandedMatches[m.id]}
                                        aria-label={`${labels.blue} ${blueScore}, ${labels.white} ${whiteScore}. ${expandedMatches[m.id] ? 'Hide' : 'Show'} lineups`}
                                        className="w-full flex items-center justify-between py-1"
                                    >
                                        <div className="flex-1 flex items-center justify-end gap-3">
                                            <span className={`font-black uppercase text-xs sm:text-sm ${isRedGreen ? 'text-red-400' : 'text-blue-400'}`}>
                                                {labels.blue}
                                            </span>
                                            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{blueScore}</span>
                                        </div>
                                        <div className="px-3 sm:px-5 text-slate-600 font-black text-xs sm:text-sm">VS</div>
                                        <div className="flex-1 flex items-center justify-start gap-3">
                                            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{whiteScore}</span>
                                            <span className={`font-black uppercase text-xs sm:text-sm ${isRedGreen ? 'text-green-400' : 'text-slate-200'}`}>
                                                {labels.white}
                                            </span>
                                        </div>
                                        <div className="text-slate-500 pl-2">
                                            {expandedMatches[m.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </button>

                                    {/* Match Events (Two-Column Split even on Mobile for Duo Readability) */}
                                    <MatchEventsList blueEvents={blueEvents} whiteEvents={whiteEvents} className="border-t border-slate-800/80 pt-3 mt-3" />

                                    {/* Expanded Lineups */}
                                    {expandedMatches[m.id] && (
                                        <MatchLineups
                                            summary={summary}
                                            players={players}
                                            onSelectPlayer={(p) => onSelectPlayer(p, filterYear)}
                                            className="mt-3 pt-3 border-t border-slate-800"
                                        />
                                    )}
                                </div>
                            );
                        })}
                        {filteredMatches.length === 0 && <div className="text-center text-slate-500 py-8">No matches recorded yet.</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsView;
