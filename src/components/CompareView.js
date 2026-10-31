import React, { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Swords, Users, ArrowLeftRight } from 'lucide-react';
import { calculateOverall, getPlayerStats } from '../utils/helpers';
import { getHeadToHead } from '../utils/matchHelpers';

const STAT_ROWS = [
    { key: 'overall', label: 'Overall', format: 'int' },
    { key: 'gamesPlayed', label: 'Played', format: 'int' },
    { key: 'wins', label: 'Wins', format: 'wins' },
    { key: 'winRate', label: 'Win %', format: 'pct' },
    { key: 'goals', label: 'Goals', format: 'int' },
    { key: 'assists', label: 'Assists', format: 'int' },
    { key: 'goalContrib', label: 'G + A', format: 'int' },
    { key: 'goalsPerGame', label: 'Goals / Game', format: 'dec' },
    { key: 'cleanSheets', label: 'Clean Sheets', format: 'int' },
    { key: 'motms', label: 'MOTM', format: 'int' },
    { key: 'hatTricks', label: 'Hat-Tricks', format: 'int' },
    { key: 'goalsFor', label: 'Goals For', format: 'int' },
    { key: 'goalsAgainst', label: 'Goals Against', format: 'int', lowerIsBetter: true },
    { key: 'ownGoals', label: 'Own Goals', format: 'int', lowerIsBetter: true }
];

const formatValue = (value, format) => {
    const num = Number(value) || 0;
    if (format === 'pct') return `${num.toFixed(0)}%`;
    if (format === 'dec') return num.toFixed(2);
    if (format === 'wins') return num % 1 === 0 ? num : num.toFixed(1);
    return num;
};

const pctOf = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 50);

const buildComparableStats = (player, matches, filterYear, playerStreaks) => {
    if (!player) return null;
    const stats = getPlayerStats(player, matches, filterYear);
    return {
        ...stats,
        overall: calculateOverall(player, stats, playerStreaks?.[player.id], filterYear === '2026')
    };
};

const PlayerPicker = ({ label, value, onChange, players, excludeId, align = 'left' }) => {
    const selected = players.find(p => p.id === value) || null;
    const options = [...players].sort((a, b) => a.name.localeCompare(b.name));
    const alignClass = align === 'right' ? 'items-end text-right' : 'items-start text-left';

    return (
        <div className={`flex flex-col gap-2 flex-1 min-w-0 ${alignClass}`}>
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 overflow-hidden bg-slate-800 flex items-center justify-center ${selected ? 'border-cyan-500/50' : 'border-slate-700 border-dashed'}`}>
                {selected
                    ? <img src={selected.photoUrl || '/logo.png'} alt={selected.name} className="w-full h-full object-cover" />
                    : <Users size={20} className="text-slate-600" />}
            </div>
            <label className="w-full">
                <span className="sr-only">{label}</span>
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    aria-label={label}
                    className="w-full bg-slate-950 text-white text-xs sm:text-sm font-bold p-2.5 rounded-xl border border-slate-800 focus:border-cyan-500 outline-none"
                >
                    <option value="">{label}…</option>
                    {options.filter(p => p.id !== excludeId).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </label>
        </div>
    );
};

const StatRow = ({ label, valueA, valueB, format, lowerIsBetter }) => {
    const numA = Number(valueA) || 0;
    const numB = Number(valueB) || 0;
    const isTie = numA === numB;
    const aWins = !isTie && (lowerIsBetter ? numA < numB : numA > numB);
    const bWins = !isTie && !aWins;

    // Bar share: for "lower is better" stats invert so the better side still fills more
    const total = numA + numB;
    let shareA = total > 0 ? (numA / total) * 100 : 50;
    if (lowerIsBetter && total > 0) shareA = 100 - shareA;

    const toneA = aWins ? 'text-green-400' : isTie ? 'text-white' : 'text-slate-400';
    const toneB = bWins ? 'text-green-400' : isTie ? 'text-white' : 'text-slate-400';

    return (
        <div className="py-2">
            <div className="flex items-center justify-between text-sm font-black font-mono mb-1">
                <span className={toneA}>{formatValue(valueA, format)}</span>
                <span className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider">{label}</span>
                <span className={toneB}>{formatValue(valueB, format)}</span>
            </div>
            <div className="flex gap-0.5 h-1.5" aria-hidden="true">
                <div className="flex-1 bg-slate-800 rounded-l-full overflow-hidden flex justify-end">
                    <div className={`h-full rounded-l-full ${aWins ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${shareA}%` }} />
                </div>
                <div className="flex-1 bg-slate-800 rounded-r-full overflow-hidden">
                    <div className={`h-full rounded-r-full ${bWins ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${100 - shareA}%` }} />
                </div>
            </div>
        </div>
    );
};

const SplitBar = ({ left, right, leftTone = 'bg-cyan-500', rightTone = 'bg-pink-500' }) => {
    const total = left + right;
    const leftPct = total > 0 ? (left / total) * 100 : 50;
    return (
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-800" aria-hidden="true">
            <div className={leftTone} style={{ width: `${leftPct}%` }} />
            <div className={rightTone} style={{ width: `${100 - leftPct}%` }} />
        </div>
    );
};

const CompareView = ({ players, matches, playerStreaks, filterYear, initialA = null, initialB = null, onSelectPlayer }) => {
    const [idA, setIdA] = useState(initialA);
    const [idB, setIdB] = useState(initialB);

    // Follow a new pre-selection (e.g. "Compare" tapped on a player card while already on this tab)
    useEffect(() => {
        if (initialA) setIdA(initialA);
        if (initialB) setIdB(initialB);
    }, [initialA, initialB]);

    const playerA = players.find(p => p.id === idA) || null;
    const playerB = players.find(p => p.id === idB) || null;

    const statsA = useMemo(() => buildComparableStats(playerA, matches, filterYear, playerStreaks), [playerA, matches, filterYear, playerStreaks]);
    const statsB = useMemo(() => buildComparableStats(playerB, matches, filterYear, playerStreaks), [playerB, matches, filterYear, playerStreaks]);

    const headToHead = useMemo(() => {
        if (!playerA || !playerB) return null;
        return getHeadToHead(playerA.id, playerB.id, matches, filterYear);
    }, [playerA, playerB, matches, filterYear]);

    const handleSwap = () => {
        setIdA(idB);
        setIdB(idA);
    };

    const bothSelected = !!(playerA && playerB);
    const seasonLabel = filterYear === '2026' ? '2026 Season' : 'All-Time';

    return (
        <div className="p-3 sm:p-4 space-y-4">
            {/* Pickers */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                        <GitCompareArrows size={16} className="text-cyan-400" /> Head to Head
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{seasonLabel}</span>
                </div>
                <div className="flex items-start gap-2 sm:gap-3">
                    <PlayerPicker label="Player A" value={idA} onChange={setIdA} players={players} excludeId={idB} />
                    <button
                        type="button"
                        onClick={handleSwap}
                        disabled={!idA && !idB}
                        aria-label="Swap players"
                        className="mt-4 sm:mt-5 p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 flex-shrink-0"
                    >
                        <ArrowLeftRight size={14} />
                    </button>
                    <PlayerPicker label="Player B" value={idB} onChange={setIdB} players={players} excludeId={idA} align="right" />
                </div>
            </div>

            {!bothSelected && (
                <div className="text-center text-slate-500 text-sm py-10 px-4">
                    {playerA || playerB ? 'Pick a second player to compare.' : 'Pick two players to compare their numbers and head-to-head record.'}
                </div>
            )}

            {bothSelected && (
                <>
                    {/* Names row */}
                    <div className="flex items-center justify-between px-1">
                        <button type="button" onClick={() => onSelectPlayer(playerA)} className="text-left font-black text-white text-sm sm:text-base truncate max-w-[45%] hover:text-cyan-300">
                            {playerA.name}
                        </button>
                        <span className="text-slate-600 font-black text-xs">VS</span>
                        <button type="button" onClick={() => onSelectPlayer(playerB)} className="text-right font-black text-white text-sm sm:text-base truncate max-w-[45%] hover:text-cyan-300">
                            {playerB.name}
                        </button>
                    </div>

                    {/* Record together / against */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users size={13} className="text-blue-400" /> Same Team
                                </h4>
                                <span className="text-[10px] text-slate-500 font-bold">{headToHead.together.played} games</span>
                            </div>
                            {headToHead.together.played === 0 ? (
                                <p className="text-slate-500 text-xs py-2">Never been on the same team.</p>
                            ) : (
                                <>
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className="text-2xl font-black text-white font-mono">{pctOf(headToHead.together.wins, headToHead.together.played)}%</span>
                                        <span className="text-[11px] text-slate-400 font-bold">win rate together</span>
                                    </div>
                                    <div className="flex gap-2 text-[11px] font-bold">
                                        <span className="text-green-400">{headToHead.together.wins}W</span>
                                        <span className="text-slate-400">{headToHead.together.draws}D</span>
                                        <span className="text-red-400">{headToHead.together.losses}L</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Swords size={13} className="text-pink-400" /> Against Each Other
                                </h4>
                                <span className="text-[10px] text-slate-500 font-bold">{headToHead.against.played} games</span>
                            </div>
                            {headToHead.against.played === 0 ? (
                                <p className="text-slate-500 text-xs py-2">Never faced each other.</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between text-sm font-black font-mono mb-1.5">
                                        <span className="text-cyan-400">{headToHead.against.aWins}</span>
                                        <span className="text-[10px] text-slate-500 font-sans font-bold uppercase">
                                            {headToHead.against.draws > 0 ? `${headToHead.against.draws} draw${headToHead.against.draws > 1 ? 's' : ''}` : 'wins'}
                                        </span>
                                        <span className="text-pink-400">{headToHead.against.bWins}</span>
                                    </div>
                                    <SplitBar left={headToHead.against.aWins} right={headToHead.against.bWins} />
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-1.5">
                                        <span className="truncate max-w-[45%]">{playerA.name}</span>
                                        <span className="truncate max-w-[45%] text-right">{playerB.name}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stat-by-stat */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl px-3.5 sm:px-4 py-2 divide-y divide-slate-800/60">
                        {STAT_ROWS.map(row => (
                            <StatRow
                                key={row.key}
                                label={row.label}
                                valueA={statsA[row.key]}
                                valueB={statsB[row.key]}
                                format={row.format}
                                lowerIsBetter={row.lowerIsBetter}
                            />
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-600 text-center px-4">
                        Green marks the better number. Head-to-head records only include tracked matches.
                    </p>
                </>
            )}
        </div>
    );
};

export default CompareView;
