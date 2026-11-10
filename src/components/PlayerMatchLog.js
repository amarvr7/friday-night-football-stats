import React, { useMemo, useState } from 'react';
import { History, Star } from 'lucide-react';
import { getPlayerMatchLog } from '../utils/matchHelpers';

const INITIAL_ROWS = 10;
const PAGE_SIZE = 10;

const RESULT_STYLES = {
    W: 'bg-green-600 text-white',
    D: 'bg-slate-500 text-white',
    L: 'bg-red-600 text-white'
};

const teamTone = (label) => {
    if (label === 'Red') return 'text-red-400';
    if (label === 'Green') return 'text-green-400';
    if (label === 'Blue') return 'text-blue-400';
    return 'text-slate-200';
};

// Per-match history for one player, newest first
const PlayerMatchLog = ({ player, matches = [], players = [], season = 'all', ratingWeights = {} }) => {
    const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);

    const log = useMemo(
        () => getPlayerMatchLog(player, matches, players, season, ratingWeights),
        [player, matches, players, season, ratingWeights]
    );

    const visibleRows = log.slice(0, visibleCount);
    const hasMore = visibleCount < log.length;

    const handleShowMore = () => setVisibleCount(prev => prev + PAGE_SIZE);

    return (
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 mt-3 relative z-10">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/60">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <History size={13} className="text-blue-400" /> Match Log
                </h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase">{log.length} tracked</span>
            </div>

            {log.length === 0 && (
                <p className="text-slate-500 text-xs text-center py-4">
                    No tracked matches {season === '2026' ? 'this season' : 'yet'}.
                </p>
            )}

            <ul className="divide-y divide-slate-800/60">
                {visibleRows.map(row => (
                    <li key={row.id} className="flex items-center gap-2 py-1.5 text-xs">
                        <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0 ${RESULT_STYLES[row.result] || RESULT_STYLES.L}`}
                            aria-label={row.result === 'W' ? 'Win' : row.result === 'D' ? 'Draw' : 'Loss'}
                        >
                            {row.result}
                        </span>
                        <span className="text-slate-500 font-bold w-12 flex-shrink-0 tabular-nums">{row.summary.dateLabel}</span>

                        <span className="flex-1 min-w-0 flex items-center gap-1 font-mono font-bold">
                            <span className={`truncate font-sans uppercase text-[10px] ${teamTone(row.teamLabel)}`}>{row.teamLabel}</span>
                            <span className="text-white">{row.teamScore}</span>
                            <span className="text-slate-600">–</span>
                            <span className="text-slate-400">{row.opponentScore}</span>
                            <span className={`truncate font-sans uppercase text-[10px] opacity-70 ${teamTone(row.opponentLabel)}`}>{row.opponentLabel}</span>
                            {row.summary.wentToPks && <span className="text-[9px] text-purple-300 font-sans font-bold">PKs</span>}
                        </span>

                        <span className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                            {row.goals > 0 && <span title={`${row.goals} goal${row.goals > 1 ? 's' : ''}`}>⚽{row.goals > 1 ? `×${row.goals}` : ''}</span>}
                            {row.assists > 0 && <span title={`${row.assists} assist${row.assists > 1 ? 's' : ''}`}>👟{row.assists > 1 ? `×${row.assists}` : ''}</span>}
                            {row.ownGoals > 0 && <span title="Own goal" className="text-red-400">❌{row.ownGoals > 1 ? `×${row.ownGoals}` : ''}</span>}
                            {row.cleanSheet && <span title="Clean sheet">🧤</span>}
                            {row.isMotm && <Star size={12} className="text-yellow-400" fill="currentColor" aria-label="Man of the match" />}
                            {typeof row.matchRating === 'number' && (
                                <span
                                    title="Match Contribution Rating (0-10)"
                                    className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-[10px] text-purple-300"
                                >
                                    {row.matchRating.toFixed(1)}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>

            {hasMore && (
                <button
                    type="button"
                    onClick={handleShowMore}
                    className="w-full mt-2 text-[11px] font-bold text-slate-400 hover:text-white py-2 rounded-lg bg-slate-900/60 border border-slate-800"
                >
                    Show {Math.min(PAGE_SIZE, log.length - visibleCount)} more
                </button>
            )}
        </div>
    );
};

export default PlayerMatchLog;
