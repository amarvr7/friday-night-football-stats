import React from 'react';

// Expanded two-column squad list for a match. Tapping a name opens the player card.
const MatchLineups = ({ summary, players, onSelectPlayer, className = '' }) => {
    const { labels, isRedGreen, bluePlayerIds, whitePlayerIds, playerRatings = {} } = summary;

    const renderName = (pid) => {
        const player = players.find(p => p.id === pid);
        const name = player?.name || 'Unknown';
        const mcr = playerRatings[pid]?.rating;
        const ratingBadge = typeof mcr === 'number' ? (
            <span className="font-mono text-[10px] font-bold text-purple-300 bg-slate-900/80 border border-slate-700/80 px-1.5 py-0.5 rounded ml-1.5 flex-shrink-0">
                {mcr.toFixed(1)}
            </span>
        ) : null;

        if (!player || !onSelectPlayer) {
            return (
                <div key={pid} className="flex items-center justify-between text-xs text-slate-300 font-medium py-0.5">
                    <span className="truncate">{name}</span>
                    {ratingBadge}
                </div>
            );
        }
        return (
            <button
                key={pid}
                type="button"
                onClick={() => onSelectPlayer(player)}
                aria-label={`Open ${name}'s player card`}
                className="w-full flex items-center justify-between text-left text-xs text-slate-300 hover:text-white font-medium py-0.5"
            >
                <span className="truncate">{name}</span>
                {ratingBadge}
            </button>
        );
    };

    return (
        <div className={`grid grid-cols-2 gap-3 ${className}`}>
            <div>
                <div className={`text-[11px] font-bold uppercase mb-1.5 pb-1 border-b ${isRedGreen ? 'text-red-400 border-red-500/20' : 'text-blue-400 border-blue-500/20'}`}>
                    {labels.blue} Squad
                </div>
                <div className="space-y-0.5">{bluePlayerIds.map(renderName)}</div>
            </div>
            <div>
                <div className={`text-[11px] font-bold uppercase mb-1.5 pb-1 border-b ${isRedGreen ? 'text-green-400 border-green-500/20' : 'text-white border-white/20'}`}>
                    {labels.white} Squad
                </div>
                <div className="space-y-0.5">{whitePlayerIds.map(renderName)}</div>
            </div>
        </div>
    );
};

export default MatchLineups;
