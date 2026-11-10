import React, { useMemo, useState } from 'react';
import { History, ChevronDown, ChevronUp, ChevronRight, Star } from 'lucide-react';
import { getMatchSummary, isSameCalendarDay } from '../utils/matchHelpers';
import MatchEventsList from './MatchEventsList';
import MatchLineups from './MatchLineups';
import MatchReportSection from './MatchReportSection';

const DAY_MS = 24 * 60 * 60 * 1000;

// "Last Friday" vs "Latest Result" depending on how fresh the match is
const getHeadline = (date) => {
    if (!date) return 'Latest Result';
    const ageDays = (Date.now() - date.getTime()) / DAY_MS;
    if (ageDays <= 7) return 'Last Friday';
    return 'Latest Result';
};

const ResultCard = ({
    summary,
    rawMatch,
    players,
    allMatches,
    ratingWeights,
    gameLabel,
    onSelectPlayer,
    canRegenerate,
    onRegenerateReport,
    generatingMatchId,
    reportError
}) => {
    const [expanded, setExpanded] = useState(false);
    const { labels, isRedGreen, blueScore, whiteScore, winner, wentToPks, motmPlayer, blueEvents, whiteEvents } = summary;

    const blueTone = isRedGreen ? 'text-red-400' : 'text-blue-400';
    const whiteTone = isRedGreen ? 'text-green-400' : 'text-slate-200';
    const winnerLabel = winner === 'blue' ? labels.blue : winner === 'white' ? labels.white : null;

    const handleToggle = () => setExpanded(prev => !prev);

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
            {(gameLabel || motmPlayer || wentToPks) && (
                <div className="flex items-center justify-between gap-2 px-3.5 pt-3 flex-wrap">
                    {gameLabel && <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{gameLabel}</span>}
                    <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                        {wentToPks && (
                            <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Won on PKs
                            </span>
                        )}
                        {motmPlayer && (
                            <button
                                type="button"
                                onClick={() => onSelectPlayer(motmPlayer)}
                                aria-label={`Man of the match ${motmPlayer.name}, open player card`}
                                className="bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 max-w-[180px]"
                            >
                                <Star size={10} fill="currentColor" /> <span className="truncate">MOTM: {motmPlayer.name}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={handleToggle}
                aria-expanded={expanded}
                aria-label={`${labels.blue} ${blueScore}, ${labels.white} ${whiteScore}. ${expanded ? 'Hide' : 'Show'} lineups`}
                className="w-full flex items-center justify-between px-3.5 py-3"
            >
                <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
                    <span className={`font-black uppercase text-xs sm:text-sm truncate ${blueTone} ${winner === 'white' ? 'opacity-60' : ''}`}>{labels.blue}</span>
                    <span className={`text-3xl sm:text-4xl font-black font-mono leading-none ${winner === 'white' ? 'text-slate-500' : 'text-white'}`}>{blueScore}</span>
                </div>
                <div className="px-3 sm:px-4 text-slate-600 font-black text-xs">–</div>
                <div className="flex-1 flex items-center justify-start gap-3 min-w-0">
                    <span className={`text-3xl sm:text-4xl font-black font-mono leading-none ${winner === 'blue' ? 'text-slate-500' : 'text-white'}`}>{whiteScore}</span>
                    <span className={`font-black uppercase text-xs sm:text-sm truncate ${whiteTone} ${winner === 'blue' ? 'opacity-60' : ''}`}>{labels.white}</span>
                </div>
                <span className="text-slate-500 pl-1.5 flex-shrink-0">
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
            </button>

            {winnerLabel && (
                <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 -mt-1 pb-2">
                    {winnerLabel} win{wentToPks ? ' on penalties' : ''}
                </div>
            )}
            {!winnerLabel && (
                <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 -mt-1 pb-2">Draw</div>
            )}

            <MatchEventsList blueEvents={blueEvents} whiteEvents={whiteEvents} className="px-3.5 pb-3 pt-2.5 border-t border-slate-800/80" />

            {/* AI Match Insights Section (Analyst Mode & Pundit Mode + 0-10 MCR) */}
            {rawMatch && (
                <div className="px-3.5 pb-3.5 pt-1">
                    <MatchReportSection
                        match={rawMatch}
                        players={players}
                        allMatches={allMatches}
                        ratingWeights={ratingWeights}
                        isGenerating={generatingMatchId === rawMatch.id}
                        error={reportError?.[rawMatch.id] || null}
                        canRegenerate={canRegenerate}
                        onRegenerate={onRegenerateReport}
                    />
                </div>
            )}

            {expanded && (
                <MatchLineups summary={summary} players={players} onSelectPlayer={onSelectPlayer} className="px-3.5 pb-3.5 pt-3 border-t border-slate-800" />
            )}
        </div>
    );
};

// Home page hero: the most recent match night (one card, or two on a Big Night)
const LastMatchCard = ({
    matches = [],
    players = [],
    ratingWeights = {},
    onSelectPlayer,
    onViewAllMatches,
    canRegenerate = false,
    onRegenerateReport = null,
    generatingMatchId = null,
    reportErrors = {}
}) => {
    const nightEntries = useMemo(() => {
        const latest = matches.find(m => m.stats && Object.keys(m.stats).length > 0);
        if (!latest) return [];
        return matches
            .filter(m => m.id === latest.id || isSameCalendarDay(m, latest))
            .slice(0, 2)
            .map(m => {
                const summary = getMatchSummary(m, players, ratingWeights);
                return summary ? { summary, rawMatch: m } : null;
            })
            .filter(Boolean)
            // Game 1 (Blue/White) before Game 2 (Red/Green) on Big Nights
            .sort((a, b) => Number(a.summary.isRedGreen) - Number(b.summary.isRedGreen));
    }, [matches, players, ratingWeights]);

    if (nightEntries.length === 0) return null;

    const first = nightEntries[0].summary;
    const isBigNight = nightEntries.length > 1;
    const fullDate = first.date
        ? first.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
        : 'Just now';

    return (
        <section>
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-slate-300 font-black uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2">
                    <History size={16} className="text-blue-400" /> {getHeadline(first.date)}
                    <span className="text-slate-500 font-bold normal-case tracking-normal">· {fullDate}</span>
                </h2>
                <button
                    type="button"
                    onClick={onViewAllMatches}
                    className="text-[11px] text-slate-400 hover:text-white font-bold flex items-center gap-0.5 min-h-[32px]"
                >
                    All matches <ChevronRight size={14} />
                </button>
            </div>

            <div className="space-y-3">
                {nightEntries.map(({ summary, rawMatch }, idx) => (
                    <ResultCard
                        key={summary.id}
                        summary={summary}
                        rawMatch={rawMatch}
                        players={players}
                        allMatches={matches}
                        ratingWeights={ratingWeights}
                        gameLabel={isBigNight ? `Game ${idx + 1}` : null}
                        onSelectPlayer={onSelectPlayer}
                        canRegenerate={canRegenerate}
                        onRegenerateReport={onRegenerateReport}
                        generatingMatchId={generatingMatchId}
                        reportError={reportErrors}
                    />
                ))}
            </div>
        </section>
    );
};

export default LastMatchCard;
