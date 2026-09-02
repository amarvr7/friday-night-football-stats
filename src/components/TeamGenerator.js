import React, { useState, useEffect } from 'react';
import { Shirt, Shuffle, Send, Activity, Trash2, Share2, Users } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, setDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import { calculateOverall, getPlayerStats } from '../utils/helpers';

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
        const teamText = (def) => `${emojis[def.key]} ${def.label.toUpperCase()} TEAM (Avg: ${teamAvg(teams[def.key])})\n` +
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

    const TeamColumn = ({ def }) => {
        const teamList = teams[def.key];
        const otherDefs = activeTeamDefs.filter(t => t.key !== def.key);

        return (
            <div className={`flex-1 min-w-[240px] rounded-xl border ${def.border} bg-slate-900/50 p-4`}>
                <h3 className={`text-lg font-bold mb-4 uppercase text-center border-b pb-2 ${def.text} ${def.border}`}>
                    {def.label} Team
                    {isQuadMode && <span className="block text-[10px] font-mono text-slate-500 normal-case tracking-wider mt-1">Game {def.game}</span>}
                </h3>
                <div className="space-y-2 min-h-[200px]">
                    {teamList.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-sm text-yellow-500 w-6 text-center flex-shrink-0">{getDynamicRating(p)}</span>
                                <span className="text-white text-sm truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {otherDefs.map(target => (
                                    <button
                                        key={target.key}
                                        onClick={() => movePlayer(p, def.key, target.key)}
                                        title={`Move to ${target.label}`}
                                        aria-label={`Move ${p.name} to ${target.label} team`}
                                        className="p-1.5 rounded hover:bg-slate-700 transition-colors"
                                    >
                                        <span className={`block w-3 h-3 rounded-full ${target.dot}`}></span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-2 border-t border-slate-700 text-center">
                    <span className="text-slate-500 text-xs uppercase">Avg Rating</span>
                    <div className="text-xl font-mono font-bold text-white">{teamAvg(teamList)}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700 h-full flex flex-col">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row mb-6 gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Shirt className="text-purple-400" /> Team Sheet
                    {isQuadMode && (
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <Users size={12} /> BIG NIGHT · 4 TEAMS
                        </span>
                    )}
                </h2>
                <div className="flex flex-wrap gap-2">
                    <button onClick={generateTeams} className="bg-purple-600 hover:bg-purple-500 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                        <Shuffle size={16} /> AI Generate {isQuadMode ? '(4 Teams)' : ''}
                    </button>

                    <button onClick={handleClearTeams} title="Unpublish from Dashboard" className="bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all">
                        <Trash2 size={16} /> Clear Teams
                    </button>

                    {hasTeams && (
                        <>
                            <button onClick={handleShare} className="bg-blue-600 hover:bg-blue-500 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                <Share2 size={16} /> Share
                            </button>
                            {isQuadMode ? (
                                <>
                                    <button onClick={() => handleStartLive(1)} className="bg-green-600 hover:bg-green-500 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                        <Activity size={16} /> Live Game 1
                                    </button>
                                    <button onClick={() => handleStartLive(2)} className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                        <Activity size={16} /> Live Game 2
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => handleStartLive(1)} className="bg-green-600 hover:bg-green-500 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg animate-pulse">
                                    <Activity size={16} /> Start Live Match
                                </button>
                            )}
                            <button onClick={handlePublish} className="bg-slate-600 hover:bg-slate-500 text-white px-3 md:px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                <Send size={16} /> {isQuadMode ? 'Publish Both Games' : 'Publish'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isQuadMode ? (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-3">⚽ Game 1 — Kickoff First</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            {TEAM_DEFS.filter(t => t.game === 1).map(def => <TeamColumn key={def.key} def={def} />)}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-3">⚽ Game 2 — Straight After</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            {TEAM_DEFS.filter(t => t.game === 2).map(def => <TeamColumn key={def.key} def={def} />)}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
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
        </div>
    );
};

export default TeamGenerator;
