import React, { useMemo } from 'react';
import { ArrowRight, Trophy, Target, Zap, Percent, Sparkles, Shield, Flame, Activity } from 'lucide-react';
import { getPlayerStats } from '../utils/helpers';

// Map icon string to Component
const getIcon = (id, size = 16) => {
    switch (id) {
        case 'goals': return <Target size={size} className="text-pink-500" />;
        case 'assists': return <Zap size={size} className="text-yellow-500" />;
        case 'goalContrib': return <Flame size={size} className="text-orange-500" />;
        case 'goalsPerGame': return <Activity size={size} className="text-cyan-500" />;
        case 'wins': return <Trophy size={size} className="text-yellow-400" fill="currentColor" fillOpacity={0.2} />;
        case 'winRate': return <Percent size={size} className="text-green-500" />;
        case 'cleanSheets': return <Sparkles size={size} className="text-teal-400" />;
        case 'goalsFor': return <Shield size={size} className="text-blue-500" />;
        case 'goalsAgainst': return <Shield size={size} className="text-red-500" />;
        default: return null;
    }
};

const LeaderboardGrid = ({ 
    players, 
    matches, 
    filterYear, 
    onSelectPlayer, 
    onNavigateToFullList 
}) => {
    
    // 1. Filter matches based on the selected year
    const filteredMatches = useMemo(() => {
        if (!matches) return [];
        if (filterYear === 'all') return matches;
        return matches.filter(m => {
            if (!m.date) return false;
            const date = new Date(m.date.seconds * 1000);
            return date.getFullYear() === 2026;
        });
    }, [matches, filterYear]);

    // 2. Pre-process stats for all players
    const playersData = useMemo(() => {
        return players.map(p => {
            const stats = getPlayerStats(p, matches, filterYear);
            return {
                ...p,
                ...stats
            };
        });
    }, [players, matches, filterYear]);

    // 3. Define the 9 categories
    const categories = [
        { id: 'goals', label: 'Goals', sortField: 'goals', type: 'count' },
        { id: 'assists', label: 'Assists', sortField: 'assists', type: 'count' },
        { id: 'goalContrib', label: 'Goal Contributions', sortField: 'goalContrib', type: 'count' },
        { id: 'goalsPerGame', label: 'Goals Per Game', sortField: 'goalsPerGame', type: 'decimal' },
        { id: 'wins', label: 'Wins', sortField: 'wins', type: 'count' },
        { id: 'winRate', label: 'Win Percentage', sortField: 'winRate', type: 'percentage' },
        { id: 'cleanSheets', label: 'Clean Sheets', sortField: 'cleanSheets', type: 'count' },
        { id: 'goalsFor', label: 'Goals For', sortField: 'goalsFor', type: 'count' },
        { id: 'goalsAgainst', label: 'Goals Against', sortField: 'goalsAgainst', type: 'count_asc', ascending: true }
    ];

    // Render ranks with customized styles
    const renderRankBadge = (rank) => {
        if (rank === 1) return <span className="w-5 h-5 flex items-center justify-center rounded-full bg-yellow-500/10 border border-yellow-500 text-yellow-500 font-extrabold text-[10px]">1</span>;
        if (rank === 2) return <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-400/10 border border-slate-400 text-slate-400 font-extrabold text-[10px]">2</span>;
        if (rank === 3) return <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-600/10 border border-amber-600 text-amber-600 font-extrabold text-[10px]">3</span>;
        return <span className="w-5 h-5 flex items-center justify-center text-slate-500 font-bold text-[10px]">{rank}</span>;
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 p-3 sm:p-4">
            {categories.map(cat => {
                // 4. Sort and filter data for this specific category inline (no useMemo to respect Hook Rules)
                let dataset = playersData.filter(p => p.gamesPlayed > 0);

                // Rate-based or Defense-based metrics get a minimum match filter to prevent outliers
                // Min matches: 5 for All Time, or 2 for 2026 (or 1 if total matches is < 2)
                if (cat.id === 'goalsPerGame' || cat.id === 'winRate' || cat.id === 'goalsAgainst') {
                    const totalMatches = filteredMatches.length;
                    const minMatches = filterYear === '2026' ? (totalMatches < 4 ? 1 : 3) : 5;
                    dataset = dataset.filter(p => p.gamesPlayed >= minMatches);
                }

                const topPlayers = [...dataset].sort((a, b) => {
                    const valA = a[cat.sortField];
                    const valB = b[cat.sortField];
                    if (cat.ascending) {
                        return valA - valB; // Ascending (GA - fewer conceded is better)
                    }
                    return valB - valA; // Descending
                }).slice(0, 5);

                return (
                    <div 
                        key={cat.id} 
                        className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700/80 transition-all flex flex-col h-[280px] sm:h-[320px]"
                    >
                        {/* Card Header (Clicking routes to full list) */}
                        <div 
                            onClick={() => onNavigateToFullList(cat.sortField, cat.ascending || false)}
                            className="bg-gradient-to-r from-slate-950/80 to-slate-900/80 p-3 sm:p-4 border-b border-slate-800/80 flex justify-between items-center cursor-pointer group/header hover:from-purple-950/30 hover:to-indigo-950/30 transition-all min-h-[60px]"
                        >
                            <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                                <div className="p-1.5 sm:p-2 bg-slate-800/80 rounded-xl border border-slate-750 flex-shrink-0">
                                    {getIcon(cat.id)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-wider truncate">
                                        {cat.label}
                                    </h3>
                                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                        {filterYear === '2026' ? '2026 Season' : 'All-Time'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-slate-500 group-hover/header:text-purple-400 group-hover/header:translate-x-1 transition-all flex-shrink-0">
                                <ArrowRight size={16} />
                            </div>
                        </div>

                        {/* Top 5 List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-855/50">
                            {topPlayers.map((player, idx) => {
                                const statValue = player[cat.sortField];
                                
                                // Format display values
                                let displayVal = statValue;
                                if (cat.type === 'decimal') displayVal = statValue.toFixed(2);
                                if (cat.type === 'percentage') displayVal = `${statValue.toFixed(0)}%`;

                                return (
                                    <div 
                                        key={player.id}
                                        onClick={() => onSelectPlayer(player)}
                                        className="flex items-center justify-between py-2 sm:py-2.5 px-3 sm:px-4 hover:bg-slate-800/30 cursor-pointer transition-colors min-h-[48px]"
                                    >
                                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                            {/* Rank */}
                                            {renderRankBadge(idx + 1)}

                                            {/* Circular Logo/Avatar */}
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-750 bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                                <img 
                                                    src={player.photoUrl || '/logo.png'} 
                                                    alt={player.name} 
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            {/* Player Name */}
                                            <span className="text-slate-200 font-bold text-xs sm:text-sm hover:text-white transition-colors truncate">
                                                {player.name}
                                            </span>
                                        </div>

                                        {/* Value */}
                                        <span className="text-cyan-400 font-black text-sm sm:text-base font-mono flex-shrink-0 ml-2">
                                            {displayVal}
                                        </span>
                                    </div>
                                );
                            })}

                            {topPlayers.length === 0 && (
                                <div className="h-full flex items-center justify-center text-slate-500 text-[10px] sm:text-xs font-bold py-8 sm:py-12">
                                    No qualifying player data.
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default LeaderboardGrid;
