import React from 'react';

// Expanded two-column squad list for a match. Tapping a name opens the player card.
const MatchLineups = ({ summary, players, onSelectPlayer, className = '' }) => {
    const { labels, isRedGreen, bluePlayerIds, whitePlayerIds } = summary;

    const renderName = (pid) => {
        const player = players.find(p => p.id === pid);
        const name = player?.name || 'Unknown';
        if (!player || !onSelectPlayer) {
            return <div key={pid} className="text-xs text-slate-300 font-medium truncate">{name}</div>;
        }
        return (
            <button
                key={pid}
                type="button"
                onClick={() => onSelectPlayer(player)}
                aria-label={`Open ${name}'s player card`}
                className="block w-full text-left text-xs text-slate-300 hover:text-white font-medium truncate py-0.5"
            >
                {name}
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
