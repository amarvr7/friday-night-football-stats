import React, { useState, useMemo } from 'react';
import { Sparkles, BarChart2, Flame, RefreshCw, AlertCircle, CheckCircle2, Share2, Mic } from 'lucide-react';
import {
    buildVerifiedMatchPayload,
    buildDeterministicFallbackReport,
    validateAiReportResponse,
    buildShareableRecapText
} from '../services/aiReportService';

const MatchReportSection = ({
    match,
    players = [],
    allMatches = [],
    ratingWeights = {},
    isGenerating = false,
    error = null,
    canRegenerate = false,
    onRegenerate = null,
    className = ''
}) => {
    const [mode, setMode] = useState('analyst'); // 'analyst' | 'pundit'

    const verifiedPayload = useMemo(
        () => buildVerifiedMatchPayload(match, players, allMatches, ratingWeights),
        [match, players, allMatches, ratingWeights]
    );

    const activeReport = useMemo(() => {
        if (match?.aiReports) {
            const check = validateAiReportResponse(match.aiReports, verifiedPayload);
            if (check.valid) {
                return {
                    ...check.data,
                    source: match.aiReports.source || 'cached',
                    model: match.aiReports.model || 'anthropic/claude-haiku-5.5',
                    isCached: true
                };
            }
        }
        const fallback = buildDeterministicFallbackReport(verifiedPayload);
        return fallback
            ? { ...fallback, source: 'verified-local', model: 'Code Engine', isCached: false }
            : null;
    }, [match, verifiedPayload]);

    if (!activeReport || !verifiedPayload) return null;

    const topRated = (verifiedPayload.topPerformers || []).slice(0, 3);
    const persona = verifiedPayload.punditPersona || null;
    const handleModeChange = (nextMode) => setMode(nextMode);

    const handleRegenerateClick = (e) => {
        e.stopPropagation();
        if (onRegenerate && !isGenerating) {
            onRegenerate(match);
        }
    };

    const handleShareRecap = async (e) => {
        e.stopPropagation();
        const text = buildShareableRecapText(verifiedPayload, activeReport, persona);
        if (!text) return;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Friday Night Football — Full Time', text });
            } else {
                await navigator.clipboard.writeText(text);
                alert('Full-time recap copied to clipboard!');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                try {
                    await navigator.clipboard.writeText(text);
                    alert('Full-time recap copied to clipboard!');
                } catch (clipboardErr) {
                    console.error('Failed to share recap', clipboardErr);
                }
            }
        }
    };

    return (
        <div className={`bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 sm:p-4 ${className}`}>
            {/* Header & Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-400 flex-shrink-0" />
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white">
                        Match Insights
                    </span>
                    {activeReport.isCached ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <CheckCircle2 size={9} /> AI Cached
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Verified Stats
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                    <div
                        className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800"
                        role="tablist"
                        aria-label="Match report tone mode"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'analyst'}
                            onClick={() => handleModeChange('analyst')}
                            className={`px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all ${
                                mode === 'analyst'
                                    ? 'bg-cyan-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <BarChart2 size={11} /> Analyst
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'pundit'}
                            onClick={() => handleModeChange('pundit')}
                            className={`px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all ${
                                mode === 'pundit'
                                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Flame size={11} /> Pundit
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleShareRecap}
                        aria-label="Share full-time recap"
                        title="Share full-time recap"
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                    >
                        <Share2 size={12} />
                    </button>

                    {canRegenerate && onRegenerate && (
                        <button
                            type="button"
                            onClick={handleRegenerateClick}
                            disabled={isGenerating}
                            aria-label="Regenerate AI match report"
                            title="Regenerate AI Match Report"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw size={12} className={isGenerating ? 'animate-spin text-purple-400' : ''} />
                        </button>
                    )}
                </div>
            </div>

            {isGenerating && (
                <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/30 border border-purple-500/30 rounded-lg px-3 py-2 mb-3">
                    <RefreshCw size={13} className="animate-spin flex-shrink-0" />
                    <span>Generating verified AI match report via Claude Haiku 5.5…</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
                    <AlertCircle size={13} className="flex-shrink-0 text-amber-400" />
                    <span>{error} Showing verified statistical report.</span>
                </div>
            )}

            {/* Mode Content */}
            {mode === 'analyst' ? (
                <div className="space-y-2.5">
                    <h4 className="text-xs sm:text-sm font-black text-cyan-300 tracking-tight">
                        {activeReport.analyst.headline}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        {activeReport.analyst.summary}
                    </p>
                    {activeReport.analyst.keyStats && activeReport.analyst.keyStats.length > 0 && (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {activeReport.analyst.keyStats.map((statLine, idx) => (
                                <li
                                    key={idx}
                                    className="text-[11px] text-slate-300 bg-slate-900/80 border border-slate-800/80 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5"
                                >
                                    <span className="text-cyan-400 font-black">•</span>
                                    <span>{statLine}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {activeReport.analyst.mvpAnalysis && (
                        <div className="text-[11px] text-slate-400 italic pt-0.5">
                            {activeReport.analyst.mvpAnalysis}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2.5">
                    {persona && (
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                            <Mic size={10} /> In the studio: {persona.name}
                        </div>
                    )}
                    <h4 className="text-xs sm:text-sm font-black text-amber-400 tracking-tight">
                        {activeReport.pundit.headline}
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed">
                        {activeReport.pundit.summary}
                    </p>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-200">
                        <span className="font-black uppercase text-[10px] tracking-wider text-amber-400 block mb-0.5">
                            Studio Verdict
                        </span>
                        {activeReport.pundit.hotTake}
                    </div>
                </div>
            )}

            {/* Code-Calculated Top Match Contribution Ratings (0-10) */}
            {topRated.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Match Contribution Ratings (0–10)
                        </span>
                        <span className="text-[9px] font-bold uppercase text-slate-500">
                            Calculated in Code
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {topRated.map((perf, idx) => (
                            <div
                                key={perf.name + idx}
                                className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1.5 flex items-center justify-between min-w-0"
                            >
                                <div className="min-w-0 pr-1">
                                    <div className="text-[11px] font-bold text-white truncate">
                                        {perf.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                        {perf.goals}G · {perf.assists}A{perf.cleanSheet ? ' · CS' : ''}
                                    </div>
                                </div>
                                <span
                                    className={`text-xs font-mono font-black px-1.5 py-0.5 rounded flex-shrink-0 ${
                                        perf.matchContributionRating >= 8.5
                                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                            : perf.matchContributionRating >= 7.0
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    }`}
                                >
                                    {perf.matchContributionRating.toFixed(1)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatchReportSection;
