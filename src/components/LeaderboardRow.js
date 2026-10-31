import React from 'react';

const LeaderboardRow = ({ player, rank, overall, stats, showAssists }) => {
    const gp = stats ? stats.gamesPlayed : (player.gamesPlayed || 0);
    const winsRaw = stats ? stats.wins : (player.wins || 0);
    const wins = winsRaw % 1 === 0 ? winsRaw : winsRaw.toFixed(1);
    const goals = stats ? stats.goals : (player.goals || 0);
    const assists = stats ? (stats.assists || 0) : (player.assists || 0);
    const cs = stats ? (stats.cleanSheets || 0) : (player.cleanSheets || 0);

    return (
        <div className="group flex items-center justify-between p-3 sm:p-4 bg-slate-800/80 border-b border-slate-700/70 last:border-0 hover:bg-slate-700/40 active:bg-slate-700/60 transition-colors min-h-[64px]">
            <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full font-black text-[11px] sm:text-xs flex-shrink-0 ${
                    rank === 1 ? 'bg-yellow-500 text-slate-950 shadow-[0_0_10px_rgba(234,179,8,0.4)]' :
                    rank === 2 ? 'bg-slate-300 text-slate-950' :
                    rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-slate-700/80 text-slate-400'
                }`}>
                    {rank}
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                    <img src={player.photoUrl || '/logo.png'} alt={player.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm sm:text-base truncate">{player.name}</div>
                    <div className="text-[11px] sm:text-xs text-slate-400 flex flex-wrap gap-x-1.5 sm:gap-x-2 gap-y-0.5 items-center">
                        <span>{gp} GP</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-green-400 font-semibold">{wins} W</span>
                        <span className="text-slate-600 sm:hidden">•</span>
                        <span className="text-pink-400 font-semibold sm:hidden">{goals} G</span>
                        {showAssists && (
                            <>
                                <span className="text-slate-600 sm:hidden">•</span>
                                <span className="text-yellow-400 font-semibold sm:hidden">{assists} A</span>
                            </>
                        )}
                        {cs > 0 && (
                            <>
                                <span className="text-slate-600 sm:hidden">•</span>
                                <span className="text-teal-400 font-semibold sm:hidden">{cs} CS</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0 ml-2">
                {cs > 0 && (
                    <div className="text-center hidden md:block">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">CS</div>
                        <div className="text-teal-400 font-mono text-base font-bold">{cs}</div>
                    </div>
                )}
                {showAssists && (
                    <div className="text-center hidden sm:block">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Assists</div>
                        <div className="text-white font-mono text-base font-bold">{assists}</div>
                    </div>
                )}
                <div className="text-center hidden sm:block">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Goals</div>
                    <div className="text-white font-mono text-base font-bold">{goals}</div>
                </div>
                <div className="text-center bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-700/80 min-w-[48px] sm:min-w-[56px]">
                    <div className="text-[8px] sm:text-[9px] text-slate-500 uppercase font-black leading-none mb-0.5">OVR</div>
                    <div className={`font-black text-base sm:text-lg leading-none ${overall >= 80 ? 'text-yellow-400' : overall >= 70 ? 'text-green-400' : 'text-cyan-400'}`}>{overall}</div>
                </div>
            </div>
        </div>
    );
};

export default LeaderboardRow;
