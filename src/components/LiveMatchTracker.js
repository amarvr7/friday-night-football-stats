import React, { useState, useEffect } from 'react';
import { Activity, Star, Timer, CheckCircle, Plus } from 'lucide-react';

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

    // Initialize players from initialTeams
    useEffect(() => {
        if (initialTeams) {
            const blueIds = initialTeams.blue.map(p => p.id);
            const whiteIds = initialTeams.white.map(p => p.id);

            const initialData = {};
            const initialVotes = {};

            blueIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, team: 'blue' };
                initialVotes[id] = 0;
            });
            whiteIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, team: 'white' };
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
            if (p.team === 'blue') b += (p.goals || 0);
            if (p.team === 'white') w += (p.goals || 0);
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
                [field]: Math.max(0, prev[playerId][field] + increment)
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

        const blueWin = blueScore > whiteScore ? 1 : (blueScore === whiteScore ? 0.5 : 0);
        const whiteWin = whiteScore > blueScore ? 1 : (whiteScore === blueScore ? 0.5 : 0);
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

        onSave(finalData, { motm });
    };

    // Split players by team for the view
    const bluePlayers = Object.keys(matchData).filter(pid => matchData[pid].team === 'blue');
    const whitePlayers = Object.keys(matchData).filter(pid => matchData[pid].team === 'white');

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
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
                                <div key={pid} className="flex items-center justify-between p-3 rounded-lg border bg-blue-900/10 border-blue-500/20">
                                    <span className="font-bold text-white block truncate flex-1">{player?.name}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateStat(pid, 'goals', 1)}
                                            className="flex items-center gap-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            <Plus size={14} /> Goal <span className="text-white ml-1 bg-black/30 px-1.5 rounded">{stats.goals}</span>
                                        </button>
                                        <button
                                            onClick={() => updateStat(pid, 'assists', 1)}
                                            className="flex items-center gap-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            <Plus size={14} /> Ast <span className="text-white ml-1 bg-black/30 px-1.5 rounded">{stats.assists}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* White Team Column */}
                    <div className="space-y-3">
                        {whitePlayers.map(pid => {
                            const player = players.find(p => p.id === pid);
                            const stats = matchData[pid];
                            return (
                                <div key={pid} className="flex items-center justify-between p-3 rounded-lg border bg-slate-700/30 border-white/20">
                                    <span className="font-bold text-white block truncate flex-1">{player?.name}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateStat(pid, 'goals', 1)}
                                            className="flex items-center gap-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            <Plus size={14} /> Goal <span className="text-white ml-1 bg-black/30 px-1.5 rounded">{stats.goals}</span>
                                        </button>
                                        <button
                                            onClick={() => updateStat(pid, 'assists', 1)}
                                            className="flex items-center gap-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            <Plus size={14} /> Ast <span className="text-white ml-1 bg-black/30 px-1.5 rounded">{stats.assists}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
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
                    <button
                        onClick={handleFinalize}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={20} /> Finalize Match
                    </button>
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
