import React, { useState, useEffect } from 'react';
import { Activity, Star, Timer, CheckCircle, Plus, Minus, UserPlus, Share2 } from 'lucide-react';

const LiveMatchTracker = ({ players, onSave, onCancel, initialTeams }) => {
    const [matchData, setMatchData] = useState({});
    const [blueScore, setBlueScore] = useState(0);
    const [whiteScore, setWhiteScore] = useState(0);
    const [motmVotes, setMotmVotes] = useState({});

    // Timer state
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    // View state: 'playing' or 'voting'
    const [matchPhase, setMatchPhase] = useState('playing');
    const [pkAttempts, setPkAttempts] = useState({});
    
    // Fallback if they wanted to bypass the tracker
    const [pkWinner, setPkWinner] = useState(null);

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
    const [selectedSub, setSelectedSub] = useState('');

    // Initialize players from initialTeams
    useEffect(() => {
        if (initialTeams) {
            const blueIds = initialTeams.blue.map(p => p.id);
            const whiteIds = initialTeams.white.map(p => p.id);

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
    }, [initialTeams]);

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
            [playerId]: prev[playerId] + 1
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
        if (maxVotes === 0) motm = null;

        let blueWin = blueScore > whiteScore ? 1 : (blueScore === whiteScore ? 0.5 : 0);
        let whiteWin = whiteScore > blueScore ? 1 : (whiteScore === blueScore ? 0.5 : 0);

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
            } else if (whitePkGoals > bluePkGoals) {
                blueWin = 0; whiteWin = 1;
            } else if (pkWinner) {
                blueWin = pkWinner === 'blue' ? 1 : 0;
                whiteWin = pkWinner === 'white' ? 1 : 0;
            }
        }

        const blueClean = whiteScore === 0;
        const whiteClean = blueScore === 0;

        const finalData = {};
        Object.keys(matchData).forEach(pid => {
            const pData = matchData[pid];
            const isBlue = pData.team === 'blue';
            finalData[pid] = {
                ...pData,
                win: isBlue ? blueWin : whiteWin,
                goalsFor: isBlue ? blueScore : whiteScore,
                goalsAgainst: isBlue ? whiteScore : blueScore,
                cleanSheet: isBlue ? blueClean : whiteClean
            };
        });

        onSave(finalData, { motm, pkWinner });
    };

    const handleShare = () => {
        const scoreText = `🏆 Friday Night Match Result! 🏆\nBlue: ${blueScore}\nWhite: ${whiteScore}`;
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
                const winnerText = bluePkGoals > whitePkGoals ? 'Blue' : (whitePkGoals > bluePkGoals ? 'White' : 'Tied');
                pkText = `\n(${winnerText} wins ${bluePkGoals}-${whitePkGoals} on penalties!)`;
                if (blueTakers.length > 0 || whiteTakers.length > 0) {
                    pkText += `\n\n🔵 Blue Penalties:\n${blueTakers.length > 0 ? blueTakers.join(', ') : 'None'}`;
                    pkText += `\n⚪ White Penalties:\n${whiteTakers.length > 0 ? whiteTakers.join(', ') : 'None'}\n`;
                }
            } else if (pkWinner) {
                pkText = `\n(${pkWinner === 'blue' ? 'Blue' : 'White'} wins on PKs)\n`;
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

    // Split players by team for the view
    const bluePlayers = Object.keys(matchData).filter(pid => matchData[pid].team === 'blue');
    const whitePlayers = Object.keys(matchData).filter(pid => matchData[pid].team === 'white');

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
            {/* Sub Modal */}
            {subModalTeam && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSubModalTeam(null)}>
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">Add Substitute to {subModalTeam === 'blue' ? 'Blue' : 'White'} Team</h3>
                        <select
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mb-4"
                            value={selectedSub}
                            onChange={(e) => setSelectedSub(e.target.value)}
                        >
                            <option value="">Select a player...</option>
                            {players
                                .filter(p => !matchData[p.id])
                                .sort((a,b) => a.name.localeCompare(b.name))
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))
                            }
                        </select>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSubModalTeam(null)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!selectedSub}
                                onClick={() => {
                                    if (selectedSub) {
                                        setMatchData(prev => ({
                                            ...prev,
                                            [selectedSub]: { goals: 0, assists: 0, ownGoals: 0, team: subModalTeam }
                                        }));
                                        setMotmVotes(prev => ({
                                            ...prev,
                                            [selectedSub]: 0
                                        }));
                                        setSubModalTeam(null);
                                        setSelectedSub('');
                                    }
                                }}
                                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors"
                            >
                                Add Player
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Activity className={isRunning ? "text-green-500 animate-pulse" : "text-yellow-500"} />
                    {matchPhase === 'playing' ? 'Live Match Tracker' : 'MOTM Voting & Finalize'}
                </h2>

                {matchPhase === 'playing' && (
                    <div className="flex items-center gap-4 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                        <Timer className="text-slate-400" size={20} />
                        <span className="text-2xl font-mono font-bold text-white">{formatTime(timeElapsed)}</span>
                        <button
                            onClick={() => setIsRunning(!isRunning)}
                            className={`px-3 py-1 rounded-md font-bold text-sm ${isRunning ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'}`}
                        >
                            {isRunning ? 'Pause' : 'Start'}
                        </button>
                    </div>
                )}
            </div>

            {/* Scoreboard */}
            <div className="flex justify-between items-center bg-slate-900 p-6 rounded-xl border border-slate-700 mb-8 shadow-inner">
                <div className="text-center w-1/3">
                    <h3 className="text-blue-400 font-bold uppercase tracking-wider mb-2">Blue</h3>
                    <div className="text-6xl font-black text-white">{blueScore}</div>
                </div>
                <div className="text-slate-600 font-black text-2xl w-1/3 text-center">VS</div>
                <div className="text-center w-1/3">
                    <h3 className="text-white font-bold uppercase tracking-wider mb-2">White</h3>
                    <div className="text-6xl font-black text-white">{whiteScore}</div>
                </div>
            </div>

            {/* Phase 1: Playing - Live Stat Tracking */}
            {matchPhase === 'playing' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Blue Team Column */}
                    <div className="space-y-3">
                        {bluePlayers.map(pid => {
                            const player = players.find(p => p.id === pid);
                            const stats = matchData[pid];
                            return (
                                <div key={pid} className="flex flex-col p-3 rounded-lg border bg-blue-900/10 border-blue-500/20 gap-2.5 shadow-sm">
                                    <span className="font-bold text-white text-lg truncate w-full">{player?.name}</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center bg-green-500/20 rounded-lg text-sm font-bold border border-green-500/30">
                                            <button onClick={() => updateStat(pid, 'goals', -1)} className="p-1.5 hover:bg-green-500/40 text-green-400 rounded-l-lg transition-colors">
                                                <Minus size={14} />
                                            </button>
                                            <div className="px-1 text-green-400 flex items-center min-w-[3.5rem] justify-center">
                                                G <span className="text-white bg-black/30 px-1.5 ml-1 rounded">{stats.goals}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'goals', 1)} className="p-1.5 hover:bg-green-500/40 text-green-400 rounded-r-lg transition-colors">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-center bg-blue-500/20 rounded-lg text-sm font-bold border border-blue-500/30">
                                            <button onClick={() => updateStat(pid, 'assists', -1)} className="p-1.5 hover:bg-blue-500/40 text-blue-400 rounded-l-lg transition-colors">
                                                <Minus size={14} />
                                            </button>
                                            <div className="px-1 text-blue-400 flex items-center min-w-[3.5rem] justify-center">
                                                A <span className="text-white bg-black/30 px-1.5 ml-1 rounded">{stats.assists}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'assists', 1)} className="p-1.5 hover:bg-blue-500/40 text-blue-400 rounded-r-lg transition-colors">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-center bg-red-500/20 rounded-lg text-sm font-bold border border-red-500/30">
                                            <button onClick={() => updateStat(pid, 'ownGoals', -1)} className="p-1.5 hover:bg-red-500/40 text-red-400 rounded-l-lg transition-colors">
                                                <Minus size={14} />
                                            </button>
                                            <div className="px-1 text-red-400 flex items-center min-w-[3.5rem] justify-center">
                                                OG <span className="text-white bg-black/30 px-1.5 ml-1 rounded">{stats.ownGoals || 0}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'ownGoals', 1)} className="p-1.5 hover:bg-red-500/40 text-red-400 rounded-r-lg transition-colors">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <button
                            onClick={() => setSubModalTeam('blue')}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-900/40 transition-colors font-bold text-sm mt-2"
                        >
                            <UserPlus size={16} /> Sub / Add Player
                        </button>
                    </div>

                    {/* White Team Column */}
                    <div className="space-y-3">
                        {whitePlayers.map(pid => {
                            const player = players.find(p => p.id === pid);
                            const stats = matchData[pid];
                            return (
                                <div key={pid} className="flex flex-col p-3 rounded-lg border bg-slate-700/30 border-white/20 gap-2.5 shadow-sm">
                                    <span className="font-bold text-white text-lg truncate w-full">{player?.name}</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center bg-green-500/20 rounded-lg text-sm font-bold border border-green-500/30">
                                            <button onClick={() => updateStat(pid, 'goals', -1)} className="p-1.5 hover:bg-green-500/40 text-green-400 rounded-l-lg transition-colors">
                                                <Minus size={14} />
                                            </button>
                                            <div className="px-1 text-green-400 flex items-center min-w-[3.5rem] justify-center">
                                                G <span className="text-white bg-black/30 px-1.5 ml-1 rounded">{stats.goals}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'goals', 1)} className="p-1.5 hover:bg-green-500/40 text-green-400 rounded-r-lg transition-colors">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-center bg-blue-500/20 rounded-lg text-sm font-bold border border-blue-500/30">
                                            <button onClick={() => updateStat(pid, 'assists', -1)} className="p-1.5 hover:bg-blue-500/40 text-blue-400 rounded-l-lg transition-colors">
                                                <Minus size={14} />
                                            </button>
                                            <div className="px-1 text-blue-400 flex items-center min-w-[3.5rem] justify-center">
                                                A <span className="text-white bg-black/30 px-1.5 ml-1 rounded">{stats.assists}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'assists', 1)} className="p-1.5 hover:bg-blue-500/40 text-blue-400 rounded-r-lg transition-colors">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-center bg-red-500/20 rounded-lg text-sm font-bold border border-red-500/30">
                                            <button onClick={() => updateStat(pid, 'ownGoals', -1)} className="p-1.5 hover:bg-red-500/40 text-red-400 rounded-l-lg transition-colors">
                                                <Minus size={14} />
                                            </button>
                                            <div className="px-1 text-red-400 flex items-center min-w-[3.5rem] justify-center">
                                                OG <span className="text-white bg-black/30 px-1.5 ml-1 rounded">{stats.ownGoals || 0}</span>
                                            </div>
                                            <button onClick={() => updateStat(pid, 'ownGoals', 1)} className="p-1.5 hover:bg-red-500/40 text-red-400 rounded-r-lg transition-colors">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <button
                            onClick={() => setSubModalTeam('white')}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-slate-500/40 text-slate-400 hover:bg-slate-700/50 transition-colors font-bold text-sm mt-2"
                        >
                            <UserPlus size={16} /> Sub / Add Player
                        </button>
                    </div>
                </div>
            )}

            {/* Phase 2: Voting - MOTM */}
            {matchPhase === 'voting' && (
                <div className="mb-8 bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                    <p className="text-slate-400 text-center mb-6">Cast votes for the Man of the Match. Each tap counts as one vote.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {Object.keys(matchData).map(pid => {
                            const player = players.find(p => p.id === pid);
                            const votes = motmVotes[pid];
                            const isBlue = matchData[pid].team === 'blue';

                            return (
                                <button
                                    key={pid}
                                    onClick={() => handleVote(pid)}
                                    className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-transform hover:scale-105 ${votes > 0 ? 'bg-yellow-500/10 border-yellow-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'} ${isBlue ? 'shadow-[0_0_15px_rgba(59,130,246,0.1)]' : ''}`}
                                >
                                    {votes > 0 && (
                                        <div className="absolute -top-3 -right-3 bg-yellow-500 text-black w-8 h-8 rounded-full flex items-center justify-center font-black text-lg shadow-lg">
                                            {votes}
                                        </div>
                                    )}
                                    <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center ${isBlue ? 'bg-blue-900/50' : 'bg-slate-700'}`}>
                                        <Star className={votes > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-slate-500'} size={24} />
                                    </div>
                                    <span className="font-bold text-white text-sm text-center line-clamp-1">{player?.name}</span>
                                    <span className="text-xs text-slate-500 mt-1 uppercase">{isBlue ? 'Blue' : 'White'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {matchPhase === 'voting' && blueScore === whiteScore && (
                <div className="mb-8 bg-slate-900/50 rounded-xl p-6 border border-slate-700 shadow-inner">
                    <p className="text-yellow-400 font-bold mb-6 uppercase tracking-wider text-center text-xl">🚨 Match Tied! Penalty Shootout 🚨</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                        <div>
                            <h4 className="text-blue-400 font-bold mb-3 uppercase border-b border-blue-500/30 pb-2">Blue Team PKs</h4>
                            <div className="space-y-2">
                                {bluePlayers.map(pid => {
                                    const p = players.find(x => x.id === pid);
                                    return (
                                        <div key={pid} className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                            <span className="text-white font-bold text-sm truncate">{p?.name}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => togglePk(pid, 'scored')} className={`w-8 h-8 rounded flex items-center justify-center text-lg transition-transform ${pkAttempts[pid] === 'scored' ? 'bg-green-600 border-2 border-green-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>⚽️</button>
                                                <button onClick={() => togglePk(pid, 'missed')} className={`w-8 h-8 rounded flex items-center justify-center text-lg transition-transform ${pkAttempts[pid] === 'missed' ? 'bg-red-600 border-2 border-red-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>❌</button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-3 uppercase border-b border-white/30 pb-2">White Team PKs</h4>
                            <div className="space-y-2">
                                {whitePlayers.map(pid => {
                                    const p = players.find(x => x.id === pid);
                                    return (
                                        <div key={pid} className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                            <span className="text-white font-bold text-sm truncate">{p?.name}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => togglePk(pid, 'scored')} className={`w-8 h-8 rounded flex items-center justify-center text-lg transition-transform ${pkAttempts[pid] === 'scored' ? 'bg-green-600 border-2 border-green-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>⚽️</button>
                                                <button onClick={() => togglePk(pid, 'missed')} className={`w-8 h-8 rounded flex items-center justify-center text-lg transition-transform ${pkAttempts[pid] === 'missed' ? 'bg-red-600 border-2 border-red-400 scale-110 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 grayscale'}`}>❌</button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-center pt-4 border-t border-slate-700/50">
                        <p className="text-slate-400 text-xs uppercase mb-3">Or fast-track and just declare a winner:</p>
                        <div className="flex gap-4 max-w-sm mx-auto">
                            <button 
                                onClick={() => setPkWinner('blue')}
                                className={`flex-1 py-2 rounded-lg font-bold border-2 transition-all ${pkWinner === 'blue' ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-blue-500/50 border-blue-500/20 hover:border-blue-500/50'}`}
                            >
                                Blue
                            </button>
                            <button 
                                onClick={() => setPkWinner('white')}
                                className={`flex-1 py-2 rounded-lg font-bold border-2 transition-all ${pkWinner === 'white' ? 'bg-slate-200 text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-slate-800 text-slate-500 border-white/20 hover:border-white/50'}`}
                            >
                                White
                            </button>
                        </div>
                    </div>
                </div>
            )} 


            {/* Actions */}
            <div className="flex gap-4">
                {matchPhase === 'playing' ? (
                    <button
                        onClick={() => {
                            setIsRunning(false);
                            setMatchPhase('voting');
                        }}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={20} /> End Match & Vote MOTM
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleShare}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                            title="Share Score"
                        >
                            <Share2 size={20} /> <span className="hidden sm:inline">Share</span>
                        </button>
                        <button
                            onClick={handleFinalize}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={20} /> Finalize Match
                        </button>
                    </>
                )}

                <button
                    onClick={matchPhase === 'playing' ? onCancel : () => setMatchPhase('playing')}
                    className="px-6 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors"
                >
                    {matchPhase === 'playing' ? 'Cancel' : 'Back to Game'}
                </button>
            </div>
        </div>
    );
};

export default LiveMatchTracker;
