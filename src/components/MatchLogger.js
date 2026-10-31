import React, { useState } from 'react';
import { Activity } from 'lucide-react';

const MatchLogger = ({ players, onSave, onCancel, initialTeams, editingMatch }) => {
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [matchData, setMatchData] = useState({});
    const [blueScore, setBlueScore] = useState(0);
    const [whiteScore, setWhiteScore] = useState(0);
    const [blueOwnGoals, setBlueOwnGoals] = useState(0);
    const [whiteOwnGoals, setWhiteOwnGoals] = useState(0);
    const [motm, setMotm] = useState(null);
    const [pkWinner, setPkWinner] = useState(null);

    // Initialize from editing match or pre-filled teams
    React.useEffect(() => {
        if (editingMatch) {
            const playerIds = Object.keys(editingMatch.stats || {});
            setSelectedPlayers(playerIds);
            setMatchData(editingMatch.stats || {});
            setMotm(editingMatch.motm || null);
            setPkWinner(editingMatch.pkWinner || null);
            setBlueOwnGoals(editingMatch.blueOwnGoals || 0);
            setWhiteOwnGoals(editingMatch.whiteOwnGoals || 0);
        } else if (initialTeams) {
            const blueIds = initialTeams.blue.map(p => p.id);
            const whiteIds = initialTeams.white.map(p => p.id);
            const allIds = [...blueIds, ...whiteIds];

            setSelectedPlayers(allIds);

            const initialData = {};
            blueIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, ownGoals: 0, team: 'blue' };
            });
            whiteIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, ownGoals: 0, team: 'white' };
            });

            setMatchData(initialData);
        }
    }, [initialTeams, editingMatch]);

    // Auto-calculate scores when matchData or own goals change
    React.useEffect(() => {
        let b = blueOwnGoals;
        let w = whiteOwnGoals;
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
    }, [matchData, blueOwnGoals, whiteOwnGoals]);

    const togglePlayer = (playerId) => {
        if (selectedPlayers.includes(playerId)) {
            setSelectedPlayers(prev => prev.filter(id => id !== playerId));
            const newData = { ...matchData }; delete newData[playerId]; setMatchData(newData);
        } else {
            setSelectedPlayers(prev => [...prev, playerId]);
            // Default to blue team
            setMatchData(prev => ({ ...prev, [playerId]: { goals: 0, assists: 0, ownGoals: 0, team: 'blue' } }));
        }
    };

    const switchTeam = (playerId, newTeam) => {
        setMatchData(prev => ({ ...prev, [playerId]: { ...prev[playerId], team: newTeam } }));
    };

    const updateStat = (playerId, field, value) => {
        setMatchData(prev => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
    };

    const teamLabels = editingMatch?.teamLabels || initialTeams?.labels || { blue: 'Blue', white: 'White' };

    const handleFinalize = (e) => {
        e.preventDefault();
        let blueWin = blueScore > whiteScore ? 1 : (blueScore === whiteScore ? 0.5 : 0);
        let whiteWin = whiteScore > blueScore ? 1 : (whiteScore === blueScore ? 0.5 : 0);

        if (blueScore === whiteScore && pkWinner) {
            blueWin = pkWinner === 'blue' ? 1 : 0;
            whiteWin = pkWinner === 'white' ? 1 : 0;
        }

        const blueClean = whiteScore === 0;
        const whiteClean = blueScore === 0;

        const finalData = {};
        selectedPlayers.forEach(pid => {
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
        onSave(finalData, { motm, blueOwnGoals, whiteOwnGoals, pkWinner, teamLabels });
    };

    return (
        <div className="bg-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-700/80">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="text-green-400" size={22} /> {editingMatch ? 'Edit Match' : 'Log Match Result'}
            </h2>

            <div className="mb-5">
                <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">
                    Who Played? ({selectedPlayers.length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {[...players].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePlayer(p.id)}
                            className={`px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-all ${
                                selectedPlayers.includes(p.id)
                                    ? 'bg-green-500 text-slate-950 shadow-md'
                                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>

            {selectedPlayers.length > 0 && (
                <>
                    {/* Sticky Scoreboard */}
                    <div className="sticky top-14 z-20 flex justify-between items-center bg-slate-900/95 backdrop-blur-md p-3.5 sm:p-4 rounded-xl border border-slate-700/80 mb-5 shadow-xl">
                        <div className="text-center flex-1">
                            <h3 className={`font-black text-xs sm:text-sm uppercase mb-1.5 ${teamLabels.blue === 'Red' ? 'text-red-400' : 'text-blue-400'}`}>
                                {teamLabels.blue} Team
                            </h3>
                            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-center text-2xl sm:text-3xl font-black bg-slate-800 text-white rounded-xl border border-blue-500/60 flex items-center justify-center font-mono">
                                {blueScore}
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-1.5">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Team OG</span>
                                <button type="button" onClick={() => setBlueOwnGoals(Math.max(0, blueOwnGoals - 1))} className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center text-xs font-bold">-</button>
                                <span className="text-xs text-white font-mono w-4 text-center">{blueOwnGoals}</span>
                                <button type="button" onClick={() => setBlueOwnGoals(blueOwnGoals + 1)} className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">+</button>
                            </div>
                        </div>
                        <div className="text-slate-500 font-black text-base sm:text-xl px-2">VS</div>
                        <div className="text-center flex-1">
                            <h3 className={`font-black text-xs sm:text-sm uppercase mb-1.5 ${teamLabels.white === 'Green' ? 'text-green-400' : 'text-white'}`}>
                                {teamLabels.white} Team
                            </h3>
                            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-center text-2xl sm:text-3xl font-black bg-slate-800 text-white rounded-xl border border-white/60 flex items-center justify-center font-mono">
                                {whiteScore}
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-1.5">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Team OG</span>
                                <button type="button" onClick={() => setWhiteOwnGoals(Math.max(0, whiteOwnGoals - 1))} className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center text-xs font-bold">-</button>
                                <span className="text-xs text-white font-mono w-4 text-center">{whiteOwnGoals}</span>
                                <button type="button" onClick={() => setWhiteOwnGoals(whiteOwnGoals + 1)} className="w-6 h-6 rounded bg-slate-200 text-slate-900 flex items-center justify-center text-xs font-bold">+</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        {selectedPlayers.map(pid => {
                            const player = players.find(p => p.id === pid);
                            const stats = matchData[pid];
                            if (!player || !stats) return null;
                            const isBlue = stats.team === 'blue';

                            return (
                                <div key={pid} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border ${isBlue ? 'bg-blue-950/25 border-blue-500/30' : 'bg-slate-700/35 border-white/20'}`}>
                                    <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
                                        <span className="font-bold text-white text-sm sm:text-base truncate">{player.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => switchTeam(pid, isBlue ? 'white' : 'blue')}
                                            className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors ${isBlue ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-900'}`}
                                        >
                                            {isBlue ? teamLabels.blue : teamLabels.white} ⇄
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700 rounded-lg px-1.5 py-1">
                                            <button type="button" onClick={() => updateStat(pid, 'goals', Math.max(0, stats.goals - 1))} className="w-7 h-7 rounded bg-slate-700 text-white font-bold">-</button>
                                            <div className="text-center px-1">
                                                <span className="text-[9px] text-slate-400 uppercase block leading-none">G</span>
                                                <span className="text-xs text-white font-mono font-bold">{stats.goals}</span>
                                            </div>
                                            <button type="button" onClick={() => updateStat(pid, 'goals', stats.goals + 1)} className="w-7 h-7 rounded bg-green-600 text-white font-bold">+</button>
                                        </div>

                                        <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700 rounded-lg px-1.5 py-1">
                                            <button type="button" onClick={() => updateStat(pid, 'assists', Math.max(0, stats.assists - 1))} className="w-7 h-7 rounded bg-slate-700 text-white font-bold">-</button>
                                            <div className="text-center px-1">
                                                <span className="text-[9px] text-slate-400 uppercase block leading-none">A</span>
                                                <span className="text-xs text-white font-mono font-bold">{stats.assists}</span>
                                            </div>
                                            <button type="button" onClick={() => updateStat(pid, 'assists', stats.assists + 1)} className="w-7 h-7 rounded bg-blue-600 text-white font-bold">+</button>
                                        </div>

                                        <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700 rounded-lg px-1.5 py-1">
                                            <button type="button" onClick={() => updateStat(pid, 'ownGoals', Math.max(0, (stats.ownGoals || 0) - 1))} className="w-7 h-7 rounded bg-slate-700 text-white font-bold">-</button>
                                            <div className="text-center px-1">
                                                <span className="text-[9px] text-slate-400 uppercase block leading-none">OG</span>
                                                <span className="text-xs text-white font-mono font-bold">{stats.ownGoals || 0}</span>
                                            </div>
                                            <button type="button" onClick={() => updateStat(pid, 'ownGoals', (stats.ownGoals || 0) + 1)} className="w-7 h-7 rounded bg-red-600 text-white font-bold">+</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
            {selectedPlayers.length > 0 && (
                <div className="mb-6">
                    <label className="block text-yellow-500 text-sm font-bold mb-2 uppercase flex items-center gap-2">
                        Select Man of the Match
                    </label>
                    <select
                        className="w-full bg-slate-900 text-white p-3 rounded-xl border border-yellow-500/30 focus:border-yellow-500 outline-none"
                        value={motm || ''}
                        onChange={(e) => setMotm(e.target.value)}
                    >
                        <option value="">-- No Selection --</option>
                        {selectedPlayers.map(pid => {
                            const p = players.find(x => x.id === pid);
                            return <option key={pid} value={pid}>{p.name}</option>;
                        })}
                    </select>
                </div>
            )}
            {blueScore === whiteScore && selectedPlayers.length > 0 && (
                <div className="mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <label className="block text-white text-sm font-bold mb-3 uppercase tracking-wider text-center">
                        Match Tied! Select PK Winner
                    </label>
                    <div className="flex gap-4 max-w-sm mx-auto">
                        <button 
                            type="button"
                            onClick={() => setPkWinner('blue')}
                            className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${pkWinner === 'blue' ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-blue-400 border-blue-500/30 hover:border-blue-500/50'}`}
                        >
                            Blue
                        </button>
                        <button 
                            type="button"
                            onClick={() => setPkWinner('white')}
                            className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${pkWinner === 'white' ? 'bg-slate-200 text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-slate-800 text-slate-300 border-white/30 hover:border-white/50'}`}
                        >
                            White
                        </button>
                    </div>
                </div>
            )}


            <div className="flex gap-4"><button type="submit" onClick={handleFinalize} disabled={selectedPlayers.length === 0} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">Save Match Result</button><button type="button" onClick={onCancel} className="px-6 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600">Cancel</button></div>
        </div >
    );
};

export default MatchLogger;
