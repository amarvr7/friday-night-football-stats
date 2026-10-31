import React from 'react';

const EVENT_ICON = { goal: '⚽', assist: '👟', own_goal: '❌' };

// Two-column scorers/assists/own-goals list used by match cards
const MatchEventsList = ({ blueEvents = [], whiteEvents = [], className = '' }) => {
    if (blueEvents.length === 0 && whiteEvents.length === 0) return null;

    const renderEvent = (event, idx, alignEnd) => {
        const icon = (
            <span className="flex-shrink-0">
                {EVENT_ICON[event.type]}{event.count > 1 ? `×${event.count}` : ''}
            </span>
        );
        const name = (
            <span className={`font-bold truncate ${event.type === 'own_goal' ? 'text-red-400' : 'text-slate-200'}`}>
                {event.player}
            </span>
        );
        return (
            <div key={`${event.type}-${event.playerId || event.player}-${idx}`} className={`flex items-center gap-1 ${alignEnd ? 'justify-end' : 'justify-start'}`}>
                {alignEnd ? <>{name}{icon}</> : <>{icon}{name}</>}
            </div>
        );
    };

    return (
        <div className={`grid grid-cols-2 gap-2 text-[11px] text-slate-400 ${className}`}>
            <div className="pr-2 space-y-1">
                {blueEvents.map((event, idx) => renderEvent(event, idx, true))}
            </div>
            <div className="pl-2 border-l border-slate-800 space-y-1">
                {whiteEvents.map((event, idx) => renderEvent(event, idx, false))}
            </div>
        </div>
    );
};

export default MatchEventsList;
