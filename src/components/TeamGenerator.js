import React, { useState, useEffect, useMemo } from 'react';
import { Shirt, Shuffle, Send, Activity, Trash2, Share2, Users, Sparkles, Clock, Copy, X, RefreshCw, Link2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, setDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import { calculateOverall, getPlayerStats } from '../utils/helpers';
import { calculateTeamChemistry, getChemistryLabel } from '../utils/teamChemistry';
import {
    buildTeamPreviewPayload,
    buildDeterministicTeamPreview,
    generateTeamPreviewFromServer,
    DEFAULT_KICKOFF_TIME
} from '../services/teamPreviewService';

// FIFA-style chemistry colour ramp (red -> amber -> green).
const getChemistryColor = (score) => {
    if (score >= 70) return { bar: 'bg-green-500', text: 'text-green-400' };
    if (score >= 60) return { bar: 'bg-lime-500', text: 'text-lime-400' };
    if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-400' };
    return { bar: 'bg-red-500', text: 'text-red-400' };
};

const BIG_NIGHT_THRESHOLD = 24;

// 4 team slots. Blue & White play Game 1; Red & Green play Game 2.
const TEAM_DEFS = [
    { key: 'blue', label: 'Blue', game: 1, border: 'border-blue-500', text: 'text-blue-400', dot: 'bg-blue-500' },
    { key: 'white', label: 'White', game: 1, border: 'border-slate-200', text: 'text-slate-200', dot: 'bg-slate-200' },
    { key: 'red', label: 'Red', game: 2, border: 'border-red-500', text: 'text-red-400', dot: 'bg-red-500' },
    { key: 'green', label: 'Green', game: 2, border: 'border-green-500', text: 'text-green-400', dot: 'bg-green-500' }
];

const EMPTY_TEAMS = { blue: [], white: [], red: [], green: [] };

const TeamGenerator = ({ players, matches, playerStreaks, onLogMatch, upcomingTeams }) => {
    const [confirmedPlayers, setConfirmedPlayers] = useState([]);
    const [teams, setTeams] = useState(EMPTY_TEAMS);
    const [checkinCount, setCheckinCount] = useState(0);

    // Hype write-up state
    const [kickoffTime, setKickoffTime] = useState(DEFAULT_KICKOFF_TIME);
    const [previewText, setPreviewText] = useState('');
    const [previewSource, setPreviewSource] = useState(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

    // BIG NIGHT: 24+ players checked in unlocks 4 teams / 2 games
    const isQuadMode = checkinCount >= BIG_NIGHT_THRESHOLD;
    const activeTeamDefs = isQuadMode ? TEAM_DEFS : TEAM_DEFS.filter(t => t.game === 1);

    useEffect(() => {
        const q = query(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS), orderBy("timestamp", "asc"));
        const unsub = onSnapshot(q, (snapshot) => {
            setCheckinCount(snapshot.docs.length);
            // 24+ check-ins => take the top 24, otherwise the classic top 12
            const size = snapshot.docs.length >= BIG_NIGHT_THRESHOLD ? BIG_NIGHT_THRESHOLD : 12;
            const topCheckins = snapshot.docs.slice(0, size).map(d => d.data());
            const loaded = topCheckins.map(c => {
                const fullPlayer = players.find(p => p.id === c.playerId);
                return fullPlayer ? { ...fullPlayer, _checkinName: c.name } : null;
            }).filter(Boolean);
            setConfirmedPlayers(loaded);
        });
        return () => unsub();
    }, [players]);

    // Hydrate teams from published upcomingTeams if local teams are empty
    useEffect(() => {
        if (upcomingTeams && players.length > 0) {
            const isEmpty = TEAM_DEFS.every(t => teams[t.key].length === 0);
            if (isEmpty) {
                const hydrated = {};
                let hasAny = false;
                TEAM_DEFS.forEach(t => {
                    hydrated[t.key] = (upcomingTeams[t.key] || []).map(id => players.find(p => p.id === id)).filter(Boolean);
                    if (hydrated[t.key].length > 0) hasAny = true;
                });
                if (hasAny) setTeams(hydrated);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [upcomingTeams, players]);


    // Helper to calculate a player's dynamic 2026 rating
    const getDynamicRating = (player) => {
        const dynamicStats = getPlayerStats(player, matches, '2026');
        const streaks = playerStreaks?.[player.id];
        return calculateOverall(player, dynamicStats, streaks, true); // forceDynamic = true
    };

    const teamAvg = (list) => list.length > 0
        ? Math.round(list.reduce((acc, p) => acc + getDynamicRating(p), 0) / list.length)
        : 0;

    // FIFA-style chemistry per team, recomputed when rosters or history change.
    const chemistryByTeam = useMemo(() => {
        const result = {};
        TEAM_DEFS.forEach(def => {
            result[def.key] = calculateTeamChemistry(teams[def.key], matches);
        });
        return result;
    }, [teams, matches]);

    const hasTeams = activeTeamDefs.some(t => teams[t.key].length > 0);

    const generateTeams = () => {
        if (confirmedPlayers.length < 2) {
            alert("Not enough players to generate teams!");
            return;
        }

        // 1. Sort by Rating (Best to Worst) using Dynamic 2026 Stats
        const sorted = [...confirmedPlayers].sort((a, b) => getDynamicRating(b) - getDynamicRating(a));

        const next = { blue: [], white: [], red: [], green: [] };

        if (isQuadMode) {
            // 2. Snake Draft across 4 teams: 1,2,3,4,4,3,2,1,...
            const snakePattern = ['blue', 'white', 'red', 'green', 'green', 'red', 'white', 'blue'];
            sorted.forEach((p, index) => {
                next[snakePattern[index % 8]].push(p);
            });
        } else {
            // 2. Classic 2-team Snake Draft: A, B, B, A, A, B, B, A...
            sorted.forEach((p, index) => {
                const snakeOrder = index % 4;
                if (snakeOrder === 0 || snakeOrder === 3) next.blue.push(p);
                else next.white.push(p);
            });
        }

        setTeams(next);
    };

    const movePlayer = (player, fromKey, toKey) => {
        setTeams(prev => ({
            ...prev,
            [fromKey]: prev[fromKey].filter(p => p.id !== player.id),
            [toKey]: [...prev[toKey], player]
        }));
    };

    const handlePublish = async () => {
        if (!hasTeams) return;

        try {
            const payload = {
                blue: teams.blue.map(p => p.id),
                white: teams.white.map(p => p.id),
                timestamp: serverTimestamp()
            };

            if (isQuadMode) {
                // Publish BOTH games so stats carry from Game 1 into Game 2
                payload.mode = 'quad';
                payload.red = teams.red.map(p => p.id);
                payload.green = teams.green.map(p => p.id);
            }

            await setDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'currentTeams'), payload);
            alert(isQuadMode ? "Both games published to Dashboard! Game 1: Blue vs White. Game 2: Red vs Green." : "Teams Published to Dashboard!");
        } catch (err) {
            console.error(err);
            alert("Failed to publish teams.");
        }
    };

    const handleClearTeams = async () => {
        if (!window.confirm("Are you sure you want to clear the published teams from the dashboard?")) return;
        try {
            await deleteDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'currentTeams'));
            alert("Published teams cleared!");
            setTeams(EMPTY_TEAMS);
        } catch (err) {
            console.error("Failed to clear teams", err);
            alert("Failed to clear teams: " + err.message);
        }
    };

    const handleStartLive = (gameNumber) => {
        if (gameNumber === 2) {
            onLogMatch({ blue: teams.red, white: teams.green, labels: { blue: 'Red', white: 'Green' } }, 'live-match');
        } else {
            onLogMatch({ blue: teams.blue, white: teams.white }, 'live-match');
        }
    };

    const handleShare = async () => {
        if (!hasTeams) return;

        const emojis = { blue: '🔵', white: '⚪️', red: '🔴', green: '🟢' };
        const teamText = (def) => `${emojis[def.key]} ${def.label.toUpperCase()} TEAM (Avg: ${teamAvg(teams[def.key])} · Chem: ${chemistryByTeam[def.key]?.score ?? 0})\n` +
            teams[def.key].map(p => `- ${p.name} (${getDynamicRating(p)})`).join('\n');

        let shareText;
        if (isQuadMode) {
            shareText = `🏟️ Friday Night Football — BIG NIGHT (2 Games!)\n\n` +
                `⚽ GAME 1\n\n${teamText(TEAM_DEFS[0])}\n\n${teamText(TEAM_DEFS[1])}\n\n` +
                `⚽ GAME 2\n\n${teamText(TEAM_DEFS[2])}\n\n${teamText(TEAM_DEFS[3])}`;
        } else {
            shareText = `🏟️ Friday Night Football Teams\n\n${teamText(TEAM_DEFS[0])}\n\n${teamText(TEAM_DEFS[1])}`;
        }

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Match Teams',
                    text: shareText
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                alert("Teams copied to clipboard!");
            }
        } catch (err) {
            console.error("Error sharing:", err);
            if (err.name !== 'AbortError') {
                try {
                    await navigator.clipboard.writeText(shareText);
                    alert("Teams copied to clipboard!");
                } catch (clipboardErr) {
                    console.error("Clipboard failed too", clipboardErr);
                }
            }
        }
    };

    const handleGenerateHype = async () => {
        const blueTeam = teams.blue;
        const whiteTeam = teams.white;
        if (blueTeam.length === 0 || whiteTeam.length === 0) {
            alert('Need both Blue and White teams to generate a hype message.');
            return;
        }

        setIsGeneratingPreview(true);
        setPreviewError(null);
        setShowPreview(true);

        const payload = buildTeamPreviewPayload({
            blueTeam,
            whiteTeam,
            matches,
            getDynamicRating,
            kickoffTime
        });

        try {
            const result = await generateTeamPreviewFromServer(payload);
            setPreviewText(result.message);
            setPreviewSource(result.source);
        } catch (err) {
            console.error('Hype generation failed, using local fallback', err);
            setPreviewError(err.message || 'AI service unavailable.');
            setPreviewText(buildDeterministicTeamPreview(payload));
            setPreviewSource('verified-local');
        } finally {
            setIsGeneratingPreview(false);
        }
    };

    const handleCopyPreview = async () => {
        if (!previewText) return;
        try {
            await navigator.clipboard.writeText(previewText);
            alert('Hype message copied to clipboard!');
        } catch (err) {
            console.error('Clipboard failed', err);
        }
    };

    const handleSharePreview = async () => {
        if (!previewText) return;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Friday Night Football', text: previewText });
            } else {
                await navigator.clipboard.writeText(previewText);
                alert('Hype message copied to clipboard!');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error sharing hype message:', err);
            }
        }
    };

    const TeamColumn = ({ def }) => {
        const teamList = teams[def.key];
        const otherDefs = activeTeamDefs.filter(t => t.key !== def.key);
        const chemistry = chemistryByTeam[def.key] || { score: 0, label: 'Cold' };
        const chemColor = getChemistryColor(chemistry.score);

        return (
            <div className={`flex-1 min-w-0 rounded-xl border ${def.border} bg-slate-900/60 p-3.5 sm:p-4`}>
                <h3 className={`text-base sm:text-lg font-bold mb-3 uppercase text-center border-b pb-2 ${def.text} ${def.border}`}>
                    {def.label} Team
                    {isQuadMode && <span className="block text-[10px] font-mono text-slate-500 normal-case tracking-wider mt-0.5">Game {def.game}</span>}
                </h3>
                <div className="space-y-2 min-h-[160px]">
                    {teamList.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-xs sm:text-sm text-yellow-500 w-6 text-center flex-shrink-0">{getDynamicRating(p)}</span>
                                <span className="text-white text-xs sm:text-sm font-semibold truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {otherDefs.map(target => (
                                    <button
                                        key={target.key}
                                        onClick={() => movePlayer(p, def.key, target.key)}
                                        title={`Move to ${target.label}`}
                                        aria-label={`Move ${p.name} to ${target.label} team`}
                                        className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                                    >
                                        <span className={`block w-3.5 h-3.5 rounded-full ${target.dot}`}></span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-700 grid grid-cols-2 gap-2">
                    <div className="text-center">
                        <span className="text-slate-500 text-[10px] uppercase font-bold">Avg Rating</span>
                        <div className="text-lg sm:text-xl font-mono font-bold text-white">{teamAvg(teamList)}</div>
                    </div>
                    <div className="text-center">
                        <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                            <Link2 size={10} /> Chemistry
                        </span>
                        <div className={`text-lg sm:text-xl font-mono font-bold ${chemColor.text}`}>
                            {teamList.length > 0 ? chemistry.score : 0}
                            <span className="text-[10px] text-slate-500 font-sans"> / 100</span>
                        </div>
                    </div>
                </div>
                {teamList.length > 1 && (
                    <div className="mt-2">
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${chemColor.bar}`}
                                style={{ width: `${chemistry.score}%` }}
                            />
                        </div>
                        <div className={`text-center text-[10px] font-bold uppercase tracking-wider mt-1 ${chemColor.text}`}>
                            {getChemistryLabel(chemistry.score)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-700/80 flex flex-col">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row mb-5 gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <Shirt className="text-purple-400" /> Team Sheet
                    {isQuadMode && (
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <Users size={12} /> BIG NIGHT · 4 TEAMS
                        </span>
                    )}
                </h2>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button onClick={generateTeams} className="bg-purple-600 hover:bg-purple-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg flex-1 sm:flex-none">
                        <Shuffle size={15} /> AI Generate {isQuadMode ? '(4 Teams)' : ''}
                    </button>

                    <button onClick={handleClearTeams} title="Unpublish from Dashboard" className="bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600 hover:text-white px-3 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all">
                        <Trash2 size={15} /> Clear
                    </button>

                    {hasTeams && (
                        <>
                            <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300">
                                <Clock size={14} className="text-slate-400 flex-shrink-0" />
                                <span className="font-bold whitespace-nowrap hidden sm:inline">Kickoff</span>
                                <input
                                    type="text"
                                    value={kickoffTime}
                                    onChange={(e) => setKickoffTime(e.target.value)}
                                    aria-label="Kickoff time for the hype message"
                                    className="bg-transparent w-16 text-white font-bold outline-none focus:text-purple-300"
                                />
                            </label>
                            <button onClick={handleShare} className="bg-blue-600 hover:bg-blue-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg">
                                <Share2 size={15} /> Share
                            </button>
                            <button onClick={handleGenerateHype} disabled={isGeneratingPreview} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-60">
                                <Sparkles size={15} className={isGeneratingPreview ? 'animate-spin' : ''} /> Generate Hype
                            </button>
                            {isQuadMode ? (
                                <>
                                    <button onClick={() => handleStartLive(1)} className="bg-green-600 hover:bg-green-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg">
                                        <Activity size={15} /> Live Game 1
                                    </button>
                                    <button onClick={() => handleStartLive(2)} className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg">
                                        <Activity size={15} /> Live Game 2
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => handleStartLive(1)} className="bg-green-600 hover:bg-green-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg animate-pulse">
                                    <Activity size={15} /> Start Live
                                </button>
                            )}
                            <button onClick={handlePublish} className="bg-slate-600 hover:bg-slate-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg">
                                <Send size={15} /> {isQuadMode ? 'Publish Both' : 'Publish'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isQuadMode ? (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-3">⚽ Game 1 — Kickoff First</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {TEAM_DEFS.filter(t => t.game === 1).map(def => <TeamColumn key={def.key} def={def} />)}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-3">⚽ Game 2 — Straight After</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {TEAM_DEFS.filter(t => t.game === 2).map(def => <TeamColumn key={def.key} def={def} />)}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeTeamDefs.map(def => <TeamColumn key={def.key} def={def} />)}
                </div>
            )}

            {!hasTeams && (
                <div className="text-center text-slate-500 italic mt-8">
                    Click "AI Generate" to split the {confirmedPlayers.length} confirmed players{isQuadMode ? ' into 4 balanced teams' : ''}.
                </div>
            )}

            {hasTeams && (
                <div className="text-center text-slate-400 mt-8 text-sm max-w-3xl mx-auto bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                    <span className="font-bold text-slate-300 block mb-1">Why are these teams fair?</span>
                    The AI Generate algorithm uses a snake draft pattern based on each player's dynamic rating. The rating is calculated from a blend of overall historical stats, recent performances, and current streaks, ensuring perfectly balanced teams.
                    {isQuadMode && <span className="block mt-2 text-purple-300">Big Night mode: 24+ players split into 4 equal squads. Game 1 (Blue vs White) kicks off first, followed by Game 2 (Red vs Green). Both matches count towards season stats.</span>}
                </div>
            )}

            {showPreview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Matchday hype message"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-700">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-400" /> Matchday Hype
                                {previewSource === 'verified-local' && (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                        Offline Draft
                                    </span>
                                )}
                            </h3>
                            <button onClick={() => setShowPreview(false)} aria-label="Close hype message" className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1">
                            {isGeneratingPreview ? (
                                <div className="flex items-center gap-2 text-sm text-purple-300 py-10 justify-center">
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Writing the hype via Claude Haiku 5.5…</span>
                                </div>
                            ) : (
                                <>
                                    {previewError && (
                                        <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
                                            AI service unavailable — showing a verified local draft you can still edit and share.
                                        </div>
                                    )}
                                    <textarea
                                        value={previewText}
                                        onChange={(e) => setPreviewText(e.target.value)}
                                        aria-label="Editable hype message"
                                        className="w-full h-72 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 font-mono leading-relaxed resize-none outline-none focus:border-purple-500"
                                    />
                                </>
                            )}
                        </div>

                        {!isGeneratingPreview && (
                            <div className="flex flex-wrap gap-2 p-4 border-t border-slate-700">
                                <button onClick={handleGenerateHype} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5">
                                    <RefreshCw size={14} /> Regenerate
                                </button>
                                <button onClick={handleCopyPreview} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5">
                                    <Copy size={14} /> Copy
                                </button>
                                <button onClick={handleSharePreview} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ml-auto shadow-lg">
                                    <Share2 size={14} /> Share
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamGenerator;
