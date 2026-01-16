import React from 'react';

const LeaderboardRow = ({ player, rank, overall, stats, showAssists }) => (
    <div className="group flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 last:border-0 hover:bg-slate-750 transition-colors">
        <div className="flex items-center gap-4">
            <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${rank === 1 ? 'bg-yellow-500 text-slate-900' : rank === 2 ? 'bg-slate-300 text-slate-900' : rank === 3 ? 'bg-orange-400 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>{rank}</div>
            <div>
                <div className="font-bold text-white text-lg">{player.name}</div>
                <div className="text-xs text-slate-400 flex gap-2">
                    <span>{stats ? stats.gamesPlayed : (player.gamesPlayed || 0)} Matches</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-green-400">{stats ? stats.wins : (player.wins || 0)} Wins</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-6">
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
            <div className="text-center bg-slate-900 p-2 rounded-lg border border-slate-700 min-w-[60px]">
                <div className="text-[10px] text-slate-500 uppercase font-bold">OVR</div>
                <div className={`font-black text-xl ${overall >= 80 ? 'text-yellow-400' : overall >= 70 ? 'text-green-400' : 'text-slate-200'}`}>{overall}</div>
            </div>
        </div>
    </div>
);

export default LeaderboardRow;
