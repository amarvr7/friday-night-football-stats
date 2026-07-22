import React from 'react';

const LeaderboardRow = ({ player, rank, overall, stats, showAssists }) => {
    const gp = stats ? stats.gamesPlayed : (player.gamesPlayed || 0);
    const wins = stats ? stats.wins : (player.wins || 0);
    const goals = stats ? stats.goals : (player.goals || 0);
    const assists = stats ? (stats.assists || 0) : (player.assists || 0);

    return (
        <div className="group flex items-center justify-between p-3 sm:p-4 bg-slate-800 border-b border-slate-700 last:border-0 hover:bg-slate-750 transition-colors min-h-[64px]">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-bold text-xs sm:text-sm flex-shrink-0 ${rank === 1 ? 'bg-yellow-500 text-slate-900' : rank === 2 ? 'bg-slate-300 text-slate-900' : rank === 3 ? 'bg-orange-400 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>{rank}</div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm sm:text-lg truncate">{player.name}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400 flex flex-wrap gap-x-1.5 sm:gap-x-2 gap-y-0.5 items-center">
                        <span>{gp} Matches</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-green-400">{wins} Wins</span>
                        <span className="text-slate-600 sm:hidden">•</span>
                        <span className="text-pink-400 sm:hidden">{goals} G</span>
                        {showAssists && (
                            <>
                                <span className="text-slate-600 sm:hidden">•</span>
                                <span className="text-yellow-405 sm:hidden">{assists} A</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                {showAssists && (
                    <div className="text-center hidden sm:block">
                        <div className="text-xs text-slate-500 uppercase font-bold">Assists</div>
                        <div className="text-white font-mono text-lg">{stats ? (stats.assists || 0) : 0}</div>
                    </div>
                )}
                <div className="text-center hidden sm:block">
                    <div className="text-xs text-slate-500 uppercase font-bold">Goals</div>
                    <div className="text-white font-mono text-lg">{stats ? stats.goals : (player.goals || 0)}</div>
                </div>
                <div className="text-center bg-slate-900 p-1.5 sm:p-2 rounded-lg border border-slate-700 min-w-[50px] sm:min-w-[60px]">
                    <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold">OVR</div>
                    <div className={`font-black text-lg sm:text-xl ${overall >= 80 ? 'text-yellow-400' : overall >= 70 ? 'text-green-400' : 'text-slate-200'}`}>{overall}</div>
                </div>
            </div>
        </div>
    );
};

export default LeaderboardRow;
