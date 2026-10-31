import React, { useState, useEffect } from 'react';
import { Activity, Star, Timer, CheckCircle, Plus, Minus, UserPlus, Share2 } from 'lucide-react';

const LIVE_STORAGE_KEY = 'friday_fut_live_match_v1';

const LiveMatchTracker = ({ players, onSave, onCancel, initialTeams }) => {
    const savedSession = React.useMemo(() => {
        try {
            const raw = localStorage.getItem(LIVE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, []);

    // Display labels — Game 2 on Big Nights passes { blue: 'Red', white: 'Green' }
    const teamLabels = React.useMemo(
        () => initialTeams?.labels || savedSession?.teamLabels || { blue: 'Blue', white: 'White' },
        [initialTeams, savedSession]
    );
    const [matchData, setMatchData] = useState(() => savedSession?.matchData || {});
    const [blueScore, setBlueScore] = useState(0);
    const [whiteScore, setWhiteScore] = useState(0);
    const [motmVotes, setMotmVotes] = useState(() => savedSession?.motmVotes || {});

    // Timer state
    const [timeElapsed, setTimeElapsed] = useState(() => savedSession?.timeElapsed || 0);
    const [isRunning, setIsRunning] = useState(false);

    // View state: 'playing' or 'voting'
    const [matchPhase, setMatchPhase] = useState(() => savedSession?.matchPhase || 'playing');
    const [pkAttempts, setPkAttempts] = useState(() => savedSession?.pkAttempts || {});
    const [goalAnimation, setGoalAnimation] = useState(null);
    
    // Fallback if they wanted to bypass the tracker
    const [pkWinner, setPkWinner] = useState(() => savedSession?.pkWinner || null);

    const togglePk = (pid, result) => {
        setPkAttempts(prev => ({
            ...prev,
            [pid]: prev[pid] === result ? null : result
        }));
        // Reset manual override if using the tracker
        setPkWinner(null);
    };

    // Sub Modal State
    const [subModalTeam, setSubModalTeam] = useState(null);
    const [selectedSubIn, setSelectedSubIn] = useState('');
    const [selectedSubOut, setSelectedSubOut] = useState('');
    const [removeSubOut, setRemoveSubOut] = useState(false);

    const playerHasRecordedStats = (pid) => {
        const stats = matchData[pid];
        return !!stats && ((stats.goals || 0) > 0 || (stats.assists || 0) > 0 || (stats.ownGoals || 0) > 0);
    };

    const handleCloseSubModal = () => {
        setSubModalTeam(null);
        setSelectedSubIn('');
        setSelectedSubOut('');
        setRemoveSubOut(false);
    };

    const handleSelectSubOut = (pid) => {
        setSelectedSubOut(pid);
        setRemoveSubOut(pid ? !playerHasRecordedStats(pid) : false);
    };

    const handleConfirmSub = () => {
        if (!selectedSubIn && !selectedSubOut) return;

        setMatchData(prev => {
            const next = { ...prev };
            if (selectedSubOut) {
                if (removeSubOut) {
                    delete next[selectedSubOut];
                } else {
                    next[selectedSubOut] = { ...next[selectedSubOut], subbedOut: true };
                }
            }
            if (selectedSubIn) {
                const existing = next[selectedSubIn];
                next[selectedSubIn] = existing
                    ? { ...existing, team: subModalTeam, subbedOut: false }
                    : { goals: 0, assists: 0, ownGoals: 0, team: subModalTeam };
            }
            return next;
        });

        setMotmVotes(prev => {
            const next = { ...prev };
            if (selectedSubOut && removeSubOut) delete next[selectedSubOut];
            if (selectedSubIn && next[selectedSubIn] === undefined) next[selectedSubIn] = 0;
            return next;
        });

        handleCloseSubModal();
    };

    // Initialize players from initialTeams only if no saved session matches or matchData is empty
    useEffect(() => {
        if (initialTeams && Object.keys(matchData).length === 0) {
            const blueIds = (initialTeams.blue || []).map(p => p.id);
            const whiteIds = (initialTeams.white || []).map(p => p.id);

            const initialData = {};
            const initialVotes = {};

            blueIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, ownGoals: 0, team: 'blue' };
                initialVotes[id] = 0;
            });
            whiteIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, ownGoals: 0, team: 'white' };
                initialVotes[id] = 0;
            });

            setMatchData(initialData);
            setMotmVotes(initialVotes);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTeams]);

    // Persist active match state to localStorage so accidental refreshes/tab switches don't lose data
    useEffect(() => {
        if (Object.keys(matchData).length > 0) {
            try {
                localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify({
                    matchData,
                    motmVotes,
                    timeElapsed,
                    matchPhase,
                    pkAttempts,
                    pkWinner,
                    teamLabels
                }));
            } catch (e) {
                // Ignore storage quota errors
            }
        }
    }, [matchData, motmVotes, timeElapsed, matchPhase, pkAttempts, pkWinner, teamLabels]);

    const clearSavedSession = () => {
        try {
            localStorage.removeItem(LIVE_STORAGE_KEY);
        } catch (e) {}
    };

    // Timer Logic
    useEffect(() => {
        let interval;
        if (isRunning) {
            interval = setInterval(() => {
                setTimeElapsed((prev) => prev + 1);
            }, 1000);
        } else if (!isRunning && timeElapsed !== 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRunning, timeElapsed]);

    // Format time (MM:SS)
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Auto-calculate scores
    useEffect(() => {
        let b = 0;
        let w = 0;
        Object.values(matchData).forEach(p => {
            if (p.team === 'blue') {
                b += (p.goals || 0);
                w += (p.ownGoals || 0);
            }
            if (p.team === 'white') {
                w += (p.goals || 0);
                b += (p.ownGoals || 0);
            }
        });
        setBlueScore(b);
        setWhiteScore(w);
    }, [matchData]);

    const updateStat = (playerId, field, increment) => {
        if (matchPhase !== 'playing') return;

        if (field === 'goals' && increment > 0) {
            setGoalAnimation(playerId);
            setTimeout(() => setGoalAnimation(null), 1500);
        }

        setMatchData(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [field]: Math.max(0, (prev[playerId][field] || 0) + increment)
            }
        }));
    };

    const handleVote = (playerId) => {
        setMotmVotes(prev => ({
            ...prev,
            [playerId]: (prev[playerId] || 0) + 1
        }));
    };

    const handleFinalize = (e) => {
        e.preventDefault();

        // Find player with most votes
        let maxVotes = -1;
        let motm = null;
        Object.entries(motmVotes).forEach(([pid, votes]) => {
            if (votes > maxVotes) {
                maxVotes = votes;
                motm = pid;
            }
        });

        // Ensure we only assign motm if there was at least 1 vote
        if (maxVotes <= 0) motm = null;

        let blueWin = blueScore > whiteScore ? 1 : (blueScore === whiteScore ? 0.5 : 0);
        let whiteWin = whiteScore > blueScore ? 1 : (whiteScore === blueScore ? 0.5 : 0);
        let effectivePkWinner = pkWinner;

        if (blueScore === whiteScore) {
            let bluePkGoals = 0;
            let whitePkGoals = 0;
            Object.keys(pkAttempts).forEach(pid => {
                if (pkAttempts[pid] === 'scored') {
                    if (matchData[pid]?.team === 'blue') bluePkGoals++;
                    if (matchData[pid]?.team === 'white') whitePkGoals++;
                }
            });
            
            if (bluePkGoals > whitePkGoals) {
                blueWin = 1; whiteWin = 0;
                effectivePkWinner = 'blue';
            } else if (whitePkGoals > bluePkGoals) {
                blueWin = 0; whiteWin = 1;
                effectivePkWinner = 'white';
            } else if (pkWinner) {
                blueWin = pkWinner === 'blue' ? 1 : 0;
                whiteWin = pkWinner === 'white' ? 1 : 0;
                effectivePkWinner = pkWinner;
            }
        }

        const blueClean = whiteScore === 0;
        const whiteClean = blueScore === 0;

        const finalData = {};
        Object.keys(matchData).forEach(pid => {
            const { subbedOut, ...pData } = matchData[pid];
            const isBlue = pData.team === 'blue';
            finalData[pid] = {
                ...pData,
                win: isBlue ? blueWin : whiteWin,
                goalsFor: isBlue ? blueScore : whiteScore,
                goalsAgainst: isBlue ? whiteScore : blueScore,
                cleanSheet: isBlue ? blueClean : whiteClean
            };
        });

        clearSavedSession();
        onSave(finalData, { motm, pkWinner: effectivePkWinner, pkAttempts, teamLabels });
    };

    const handleShare = () => {
        const scoreText = `🏆 Friday Night Match Result! 🏆\n${teamLabels.blue}: ${blueScore}\n${teamLabels.white}: ${whiteScore}`;
        let pkText = '';
        if (blueScore === whiteScore) {
            let bluePkGoals = 0;
            let whitePkGoals = 0;
            const blueTakers = [];
            const whiteTakers = [];
            
            Object.keys(pkAttempts).forEach(pid => {
                const player = players.find(p => p.id === pid);
                if (!player) return;
                const isScored = pkAttempts[pid] === 'scored';
                const mark = isScored ? '✅' : '❌';
                const team = matchData[pid]?.team;
                
                if (team === 'blue') {
                    if (isScored) bluePkGoals++;
                    blueTakers.push(`${mark} ${player.name}`);
                } else if (team === 'white') {
                    if (isScored) whitePkGoals++;
                    whiteTakers.push(`${mark} ${player.name}`);
                }
            });

            if (Object.keys(pkAttempts).length > 0) {
                const winnerText = bluePkGoals > whitePkGoals ? teamLabels.blue : (whitePkGoals > bluePkGoals ? teamLabels.white : 'Tied');
                pkText = `\n(${winnerText} wins ${bluePkGoals}-${whitePkGoals} on penalties!)`;
                if (blueTakers.length > 0 || whiteTakers.length > 0) {
                    pkText += `\n\n${teamLabels.blue} Penalties:\n${blueTakers.length > 0 ? blueTakers.join(', ') : 'None'}`;
                    pkText += `\n${teamLabels.white} Penalties:\n${whiteTakers.length > 0 ? whiteTakers.join(', ') : 'None'}\n`;
                }
            } else if (pkWinner) {
                pkText = `\n(${pkWinner === 'blue' ? teamLabels.blue : teamLabels.white} wins on PKs)\n`;
            }
        }
        
        let motmName = 'None';
        let maxVotes = -1;
        let currentMotm = null;
        Object.entries(motmVotes).forEach(([pid, votes]) => {
            if (votes > maxVotes) {
                maxVotes = votes;
                currentMotm = pid;
            }
        });
        if (maxVotes > 0 && currentMotm) {
            const player = players.find(p => p.id === currentMotm);
            if (player) motmName = player.name;
        }

        const textToShare = `${scoreText}${pkText}\nMOTM: ${motmName}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Match Result',
                text: textToShare
            }).catch(err => {
                console.error(err);
                if (err.name !== 'AbortError') {
                    navigator.clipboard.writeText(textToShare);
                    alert("Score copied to clipboard!");
                }
            });
        } else {
            navigator.clipboard.writeText(textToShare);
            alert("Score copied to clipboard!");
        }
    };

    // Split players by team for the view (active players only — subbed-off players are shown separately)
    const bluePlayers = Object.keys(matchData).filter(pid => matchData[pid].team === 'blue' && !matchData[pid].subbedOut);
    const whitePlayers = Object.keys(matchData).filter(pid => matchData[pid].team === 'white' && !matchData[pid].subbedOut);
    const blueSubbedOff = Object.keys(matchData).filter(pid => matchData[pid].team === 'blue' && matchData[pid].subbedOut);
    const whiteSubbedOff = Object.keys(matchData).filter(pid => matchData[pid].team === 'white' && matchData[pid].subbedOut);

    const renderSubbedOffRow = (pid) => {
        const player = players.find(p => p.id === pid);
        const stats = matchData[pid];
        return (
            <div key={pid} className="flex items-center justify-between p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 opacity-60">
                <span className="font-bold text-slate-400 truncate">{player?.name}</span>
                <span className="text-[10px] font-bold uppercase text-slate-500 flex-shrink-0 ml-2">
                    Subbed Off · G {stats.goals || 0} · A {stats.assists || 0}
                </span>
            </div>
        );
    };

    return (
        <div className="bg-slate-800/90 rounded-2xl p-3 sm:p-6 shadow-2xl border border-slate-700/80 relative">
            {/* Goal Animation Overlay */}
            {goalAnimation && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="animate-bounce flex flex-col items-center">
                        <div className="text-7xl sm:text-8xl mb-4 shadow-black drop-shadow-2xl">⚽️</div>
                        <h2 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 uppercase tracking-widest drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">
                            GOAL!
                        </h2>
                        {goalAnimation && players.find(p => p.id === goalAnimation) && (
                             <p className="mt-4 text-xl sm:text-2xl font-bold text-white drop-shadow-xl bg-black/60 px-6 py-2 rounded-full border border-white/20">
                                 {players.find(p => p.id === goalAnimation)?.name}
                             </p>
                        )}
                    </div>
                </div>
            )}

            {/* Sub Modal */}
            {subModalTeam && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={handleCloseSubModal}>
                    <div className="bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-700 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Substitution — {teamLabels[subModalTeam]} Team</h3>

                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Player Coming On</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mb-4"
                            value={selectedSubIn}
                            onChange={(e) => setSelectedSubIn(e.target.value)}
                        >
                            <option value="">No one — just taking a player off</option>
                            {players
                                .filter(p => !matchData[p.id] || matchData[p.id].subbedOut)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}{matchData[p.id]?.subbedOut ? ' (subbed off)' : ''}
                                    </option>
                                ))
                            }
                        </select>

                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Player Coming Off</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mb-4"
                            value={selectedSubOut}
                            onChange={(e) => handleSelectSubOut(e.target.value)}
                        >
                            <option value="">No one — just adding a player</option>
                            {Object.keys(matchData)
                                .filter(pid => matchData[pid].team === subModalTeam && !matchData[pid].subbedOut)
                                .map(pid => players.find(p => p.id === pid))
                                .filter(Boolean)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))
                            }
                        </select>

                        {selectedSubOut && (
                            <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-3 mb-4">
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={removeSubOut}
                                        onChange={(e) => setRemoveSubOut(e.target.checked)}
                                        className="mt-0.5 accent-red-500"
                                    />
                                    <span className="text-xs text-slate-300">
                                        <span className="font-bold text-white">Never played</span> — remove them from this match entirely (no game played, win or clean sheet credit).
                                        {playerHasRecordedStats(selectedSubOut) && (
                                            <span className="block text-red-400 font-bold mt-1">
                                                Warning: their recorded goals/assists in this match will be deleted.
                                            </span>
                                        )}
                                    </span>
                                </label>
                                {!removeSubOut && (
                                    <p className="text-[10px] text-slate-500 mt-2">
                                        Left unchecked, they still count as having played and keep their stats, but can no longer receive new ones.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleCloseSubModal}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!selectedSubIn && !selectedSubOut}
                                onClick={handleConfirmSub}
                                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Live Header & Scoreboard */}
            <div className="sticky top-14 z-20 bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-slate-700/80 mb-5 shadow-xl">
                <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Activity size={18} className={isRunning ? "text-green-500 animate-pulse" : "text-yellow-500"} />
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                            {matchPhase === 'playing' ? 'Live Match' : 'MOTM & Finalize'}
                        </span>
                    </div>

                    {matchPhase === 'playing' && (
                        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                            <Timer className="text-slate-400" size={15} />
                            <span className="text-base sm:text-lg font-mono font-bold text-white">{formatTime(timeElapsed)}</span>
                            <button
                                onClick={() => setIsRunning(!isRunning)}
                                className={`px-2.5 py-0.5 rounded font-bold text-xs ${isRunning ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
                            >
                                {isRunning ? 'Pause' : 'Start'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Compact Scoreboard */}
                <div className="flex justify-between items-center px-2">
                    <div className="flex items-center gap-3 w-2/5 justify-start">
                        <span className={`font-black uppercase text-xs sm:text-sm tracking-wider ${teamLabels.blue === 'Red' ? 'text-red-400' : 'text-blue-400'}`}>
                            {teamLabels.blue}
                        </span>
                        <span className="text-3xl sm:text-5xl font-black text-white font-mono ml-auto">{blueScore}</span>
                    </div>
                    <div className="text-slate-600 font-black text-xs sm:text-base w-1/5 text-center">VS</div>
                    <div className="flex items-center gap-3 w-2/5 justify-end">
                        <span className="text-3xl sm:text-5xl font-black text-white font-mono mr-auto">{whiteScore}</span>
                        <span className={`font-black uppercase text-xs sm:text-sm tracking-wider ${teamLabels.white === 'Green' ? 'text-green-400' : 'text-white'}`}>
                            {teamLabels.white}
                        </span>
                    </div>
                </div>
            </div>

            {/* Phase 1: Playing - Live Stat Tracking */}
            {matchPhase === 'playing' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    {/* Blue Team Column */}
                    <div className="space-y-2.5">
                        <div className={`text-xs font-black uppercase tracking-wider px-1 ${teamLabels.blue === 'Red' ? 'text-red-400' : 'text-blue-400'}`}>
                            {teamLabels.blue} Squad ({bluePlayers.length})
                        </div>
                        {bluePlayers.map(pid => {
                            const player = players.find(p => p.id === pid);
                            const stats = matchData[pid];
                            return (
                                <div key={pid} className="flex flex-col p-3 rounded-xl border bg-blue-950/20 border-blue-500/25 gap-2 shadow-sm">
                                    <span className="font-bold text-white text-sm sm:text-base truncate w-full">{player?.name}</span>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="flex items-center justify-between bg-green-500/15 rounded-lg text-xs font-bold border border-green-500/30">
                                            <button onClick={() => updateStat(pid, 'goals', -1)} className="p-2 hover:bg-green-500/30 text-green-400 rounded-l-lg transition-colors">
                                                <Minus size={13} />
                                            </button>
                                            <div className="text-green-400 flex items-center justify-center">
                                                G <span className="text-white bg-black/40 px-1.5 py-0.5 ml-1 rounded font-mono">{stats.goals}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'goals', 1)} className="p-2 hover:bg-green-500/30 text-green-400 rounded-r-lg transition-colors">
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between bg-blue-500/15 rounded-lg text-xs font-bold border border-blue-500/30">
                                            <button onClick={() => updateStat(pid, 'assists', -1)} className="p-2 hover:bg-blue-500/30 text-blue-400 rounded-l-lg transition-colors">
                                                <Minus size={13} />
                                            </button>
                                            <div className="text-blue-400 flex items-center justify-center">
                                                A <span className="text-white bg-black/40 px-1.5 py-0.5 ml-1 rounded font-mono">{stats.assists}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'assists', 1)} className="p-2 hover:bg-blue-500/30 text-blue-400 rounded-r-lg transition-colors">
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between bg-red-500/15 rounded-lg text-xs font-bold border border-red-500/30">
                                            <button onClick={() => updateStat(pid, 'ownGoals', -1)} className="p-2 hover:bg-red-500/30 text-red-400 rounded-l-lg transition-colors">
                                                <Minus size={13} />
                                            </button>
                                            <div className="text-red-400 flex items-center justify-center">
                                                OG <span className="text-white bg-black/40 px-1.5 py-0.5 ml-1 rounded font-mono">{stats.ownGoals || 0}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'ownGoals', 1)} className="p-2 hover:bg-red-500/30 text-red-400 rounded-r-lg transition-colors">
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {blueSubbedOff.map(renderSubbedOffRow)}
                        <button
                            onClick={() => setSubModalTeam('blue')}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-900/30 transition-colors font-bold text-xs sm:text-sm"
                        >
                            <UserPlus size={15} /> Sub / Add {teamLabels.blue} Player
                        </button>
                    </div>

                    {/* White Team Column */}
                    <div className="space-y-2.5">
                        <div className={`text-xs font-black uppercase tracking-wider px-1 ${teamLabels.white === 'Green' ? 'text-green-400' : 'text-slate-200'}`}>
                            {teamLabels.white} Squad ({whitePlayers.length})
                        </div>
                        {whitePlayers.map(pid => {
                            const player = players.find(p => p.id === pid);
                            const stats = matchData[pid];
                            return (
                                <div key={pid} className="flex flex-col p-3 rounded-xl border bg-slate-700/25 border-white/15 gap-2 shadow-sm">
                                    <span className="font-bold text-white text-sm sm:text-base truncate w-full">{player?.name}</span>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="flex items-center justify-between bg-green-500/15 rounded-lg text-xs font-bold border border-green-500/30">
                                            <button onClick={() => updateStat(pid, 'goals', -1)} className="p-2 hover:bg-green-500/30 text-green-400 rounded-l-lg transition-colors">
                                                <Minus size={13} />
                                            </button>
                                            <div className="text-green-400 flex items-center justify-center">
                                                G <span className="text-white bg-black/40 px-1.5 py-0.5 ml-1 rounded font-mono">{stats.goals}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'goals', 1)} className="p-2 hover:bg-green-500/30 text-green-400 rounded-r-lg transition-colors">
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between bg-blue-500/15 rounded-lg text-xs font-bold border border-blue-500/30">
                                            <button onClick={() => updateStat(pid, 'assists', -1)} className="p-2 hover:bg-blue-500/30 text-blue-400 rounded-l-lg transition-colors">
                                                <Minus size={13} />
                                            </button>
                                            <div className="text-blue-400 flex items-center justify-center">
                                                A <span className="text-white bg-black/40 px-1.5 py-0.5 ml-1 rounded font-mono">{stats.assists}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'assists', 1)} className="p-2 hover:bg-blue-500/30 text-blue-400 rounded-r-lg transition-colors">
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between bg-red-500/15 rounded-lg text-xs font-bold border border-red-500/30">
                                            <button onClick={() => updateStat(pid, 'ownGoals', -1)} className="p-2 hover:bg-red-500/30 text-red-400 rounded-l-lg transition-colors">
                                                <Minus size={13} />
                                            </button>
                                            <div className="text-red-400 flex items-center justify-center">
                                                OG <span className="text-white bg-black/40 px-1.5 py-0.5 ml-1 rounded font-mono">{stats.ownGoals || 0}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'ownGoals', 1)} className="p-2 hover:bg-red-500/30 text-red-400 rounded-r-lg transition-colors">
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {whiteSubbedOff.map(renderSubbedOffRow)}
                        <button
                            onClick={() => setSubModalTeam('white')}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-500/40 text-slate-300 hover:bg-slate-700/40 transition-colors font-bold text-xs sm:text-sm"
                        >
                            <UserPlus size={15} /> Sub / Add {teamLabels.white} Player
                        </button>
                    </div>
                </div>
            )}

            {/* Phase 2: Voting - MOTM */}
            {matchPhase === 'voting' && (
                <div className="mb-6 bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-700">
                    <p className="text-slate-400 text-xs sm:text-sm text-center mb-4">Cast votes for Man of the Match. Each tap adds 1 vote.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {Object.keys(matchData).map(pid => {
                            const player = players.find(p => p.id === pid);
                            const votes = motmVotes[pid] || 0;
                            const isBlue = matchData[pid].team === 'blue';

                            return (
                                <button
                                    key={pid}
                                    onClick={() => handleVote(pid)}
                                    className={`relative flex flex-col items-center p-3 sm:p-4 rounded-xl border-2 transition-transform active:scale-95 ${votes > 0 ? 'bg-yellow-500/10 border-yellow-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    {votes > 0 && (
                                        <div className="absolute -top-2.5 -right-2.5 bg-yellow-500 text-black w-7 h-7 rounded-full flex items-center justify-center font-black text-sm shadow-lg">
                                            {votes}
                                        </div>
                                    )}
                                    <div className={`w-10 h-10 rounded-full mb-2 flex items-center justify-center ${isBlue ? 'bg-blue-900/50' : 'bg-slate-700'}`}>
                                        <Star className={votes > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-slate-500'} size={20} />
                                    </div>
                                    <span className="font-bold text-white text-xs sm:text-sm text-center truncate w-full">{player?.name}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5 uppercase">{isBlue ? teamLabels.blue : teamLabels.white}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {matchPhase === 'voting' && blueScore === whiteScore && (
                <div className="mb-6 bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-700 shadow-inner">
                    <p className="text-yellow-400 font-bold mb-4 uppercase tracking-wider text-center text-base sm:text-xl">🚨 Match Tied! Penalty Shootout 🚨</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                        <div>
                            <h4 className="text-blue-400 font-bold mb-2.5 uppercase border-b border-blue-500/30 pb-1.5 text-xs sm:text-sm">{teamLabels.blue} Team PKs</h4>
                            <div className="space-y-2">
                                {bluePlayers.map(pid => {
                                    const p = players.find(x => x.id === pid);
                                    return (
                                        <div key={pid} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                                            <span className="text-white font-bold text-xs sm:text-sm truncate">{p?.name}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => togglePk(pid, 'scored')} className={`w-8 h-8 rounded flex items-center justify-center text-base transition-transform ${pkAttempts[pid] === 'scored' ? 'bg-green-600 border-2 border-green-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>⚽️</button>
                                                <button onClick={() => togglePk(pid, 'missed')} className={`w-8 h-8 rounded flex items-center justify-center text-base transition-transform ${pkAttempts[pid] === 'missed' ? 'bg-red-600 border-2 border-red-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>❌</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-2.5 uppercase border-b border-white/30 pb-1.5 text-xs sm:text-sm">{teamLabels.white} Team PKs</h4>
                            <div className="space-y-2">
                                {whitePlayers.map(pid => {
                                    const p = players.find(x => x.id === pid);
                                    return (
                                        <div key={pid} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                                            <span className="text-white font-bold text-xs sm:text-sm truncate">{p?.name}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => togglePk(pid, 'scored')} className={`w-8 h-8 rounded flex items-center justify-center text-base transition-transform ${pkAttempts[pid] === 'scored' ? 'bg-green-600 border-2 border-green-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>⚽️</button>
                                                <button onClick={() => togglePk(pid, 'missed')} className={`w-8 h-8 rounded flex items-center justify-center text-base transition-transform ${pkAttempts[pid] === 'missed' ? 'bg-red-600 border-2 border-red-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>❌</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-center pt-4 border-t border-slate-700/50">
                        <p className="text-slate-400 text-xs uppercase mb-3">Or fast-track and declare a PK winner:</p>
                        <div className="flex gap-3 max-w-sm mx-auto">
                            <button 
                                onClick={() => setPkWinner('blue')}
                                className={`flex-1 py-2.5 rounded-xl font-bold border-2 transition-all ${pkWinner === 'blue' ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-blue-400 border-blue-500/20'}`}
                            >
                                {teamLabels.blue}
                            </button>
                            <button 
                                onClick={() => setPkWinner('white')}
                                className={`flex-1 py-2.5 rounded-xl font-bold border-2 transition-all ${pkWinner === 'white' ? 'bg-slate-200 text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-slate-800 text-slate-300 border-white/20'}`}
                            >
                                {teamLabels.white}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2.5 sm:gap-4">
                {matchPhase === 'playing' ? (
                    <button
                        onClick={() => {
                            setIsRunning(false);
                            setMatchPhase('voting');
                        }}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                        <CheckCircle size={18} /> End Match & Vote MOTM
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleShare}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 sm:px-6 py-3.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm"
                            title="Share Score"
                        >
                            <Share2 size={18} /> <span>Share</span>
                        </button>
                        <button
                            onClick={handleFinalize}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                            <CheckCircle size={18} /> Save Final Match
                        </button>
                    </>
                )}

                <button
                    onClick={() => {
                        if (matchPhase === 'playing') {
                            if (window.confirm('Cancel this live match? Unsaved progress will be discarded.')) {
                                clearSavedSession();
                                onCancel();
                            }
                        } else {
                            setMatchPhase('playing');
                        }
                    }}
                    className="px-4 sm:px-6 py-3.5 bg-slate-700 text-slate-200 font-bold rounded-xl hover:bg-slate-600 transition-colors text-sm"
                >
                    {matchPhase === 'playing' ? 'Cancel' : 'Back'}
                </button>
            </div>
        </div>
    );
};

export default LiveMatchTracker;
