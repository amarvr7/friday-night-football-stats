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

    // Initialize from editing match or pre-filled teams
    React.useEffect(() => {
        if (editingMatch) {
            const playerIds = Object.keys(editingMatch.stats || {});
            setSelectedPlayers(playerIds);
            setMatchData(editingMatch.stats || {});
            setMotm(editingMatch.motm || null);
            setBlueOwnGoals(editingMatch.blueOwnGoals || 0);
            setWhiteOwnGoals(editingMatch.whiteOwnGoals || 0);
        } else if (initialTeams) {
            const blueIds = initialTeams.blue.map(p => p.id);
            const whiteIds = initialTeams.white.map(p => p.id);
            const allIds = [...blueIds, ...whiteIds];

            setSelectedPlayers(allIds);

            const initialData = {};
            blueIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, team: 'blue' };
            });
            whiteIds.forEach(id => {
                initialData[id] = { goals: 0, assists: 0, team: 'white' };
            });

            setMatchData(initialData);
        }
    }, [initialTeams, editingMatch]);

    // Auto-calculate scores when matchData or own goals change
    React.useEffect(() => {
        let b = blueOwnGoals;
        let w = whiteOwnGoals;
        Object.values(matchData).forEach(p => {
            if (p.team === 'blue') b += (p.goals || 0);
            if (p.team === 'white') w += (p.goals || 0);
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
            setMatchData(prev => ({ ...prev, [playerId]: { goals: 0, assists: 0, team: 'blue' } }));
        }
    };

    const switchTeam = (playerId, newTeam) => {
        setMatchData(prev => ({ ...prev, [playerId]: { ...prev[playerId], team: newTeam } }));
    };

    const updateStat = (playerId, field, value) => {
        setMatchData(prev => ({ ...prev, [playerId]: { ...prev[playerId], [field]: value } }));
    };

    const handleFinalize = (e) => {
        e.preventDefault();
        const blueWin = blueScore > whiteScore ? 1 : (blueScore === whiteScore ? 0.5 : 0);
        const whiteWin = whiteScore > blueScore ? 1 : (whiteScore === blueScore ? 0.5 : 0);
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
        onSave(finalData, { motm, blueOwnGoals, whiteOwnGoals });
    };

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Activity className="text-green-400" /> {editingMatch ? 'Edit Match' : 'Log 2026 Match'}</h2>

            <div className="mb-6"><label className="block text-slate-400 text-sm font-bold mb-2 uppercase">Who Played?</label><div className="flex flex-wrap gap-2">{players.map(p => (<button key={p.id} type="button" onClick={() => togglePlayer(p.id)} className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${selectedPlayers.includes(p.id) ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-700 text-slate-400'}`}>{p.name}</button>))}</div></div>

            {selectedPlayers.length > 0 && (
                <>
                    <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700 mb-6">
                        <div className="text-center">
                            <h3 className="text-blue-400 font-bold uppercase mb-2">Blue Team</h3>
                            <div className="w-16 h-16 text-center text-3xl font-black bg-slate-800 text-white rounded-lg border border-blue-500 flex items-center justify-center">
                                {blueScore}
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-2">
                                <span className="text-[10px] text-slate-400 uppercase">OGs</span>
                                <button type="button" onClick={() => setBlueOwnGoals(Math.max(0, blueOwnGoals - 1))} className="w-5 h-5 rounded bg-slate-700 text-white flex items-center justify-center text-xs">-</button>
                                <span className="text-xs text-white font-mono">{blueOwnGoals}</span>
                                <button type="button" onClick={() => setBlueOwnGoals(blueOwnGoals + 1)} className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs">+</button>
                            </div>
                        </div>
                        <div className="text-slate-500 font-black text-xl">VS</div>
                        <div className="text-center">
                            <h3 className="text-white font-bold uppercase mb-2">White Team</h3>
                            <div className="w-16 h-16 text-center text-3xl font-black bg-slate-800 text-white rounded-lg border border-white flex items-center justify-center">
                                {whiteScore}
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-2">
                                <span className="text-[10px] text-slate-400 uppercase">OGs</span>
                                <button type="button" onClick={() => setWhiteOwnGoals(Math.max(0, whiteOwnGoals - 1))} className="w-5 h-5 rounded bg-slate-700 text-white flex items-center justify-center text-xs">-</button>
                                <span className="text-xs text-white font-mono">{whiteOwnGoals}</span>
                                <button type="button" onClick={() => setWhiteOwnGoals(whiteOwnGoals + 1)} className="w-5 h-5 rounded bg-slate-300 text-slate-900 flex items-center justify-center text-xs">+</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        {selectedPlayers.map(pid => {
                            const player = players.find(p => p.id === pid);
                            const stats = matchData[pid];
                            const isBlue = stats.team === 'blue';

                            return (
                                <div key={pid} className={`grid grid-cols-4 gap-2 items-center p-3 rounded-lg border ${isBlue ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-700/50 border-white/30'}`}>
                                    <div className="col-span-1">
                                        <span className="font-bold text-white block truncate">{player.name}</span>
                                        <button onClick={() => switchTeam(pid, isBlue ? 'white' : 'blue')} className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded mt-1 ${isBlue ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-900'}`}>{isBlue ? 'Blue' : 'White'}</button>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-slate-400 uppercase">Goals</span>
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => updateStat(pid, 'goals', Math.max(0, stats.goals - 1))} className="w-6 h-6 rounded bg-slate-600 text-white">-</button>
                                            <span className="w-4 text-center text-white font-mono">{stats.goals}</span>
                                            <button type="button" onClick={() => updateStat(pid, 'goals', stats.goals + 1)} className="w-6 h-6 rounded bg-green-600 text-white">+</button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-slate-400 uppercase">Assists</span>
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => updateStat(pid, 'assists', Math.max(0, stats.assists - 1))} className="w-6 h-6 rounded bg-slate-600 text-white">-</button>
                                            <span className="w-4 text-center text-white font-mono">{stats.assists}</span>
                                            <button type="button" onClick={() => updateStat(pid, 'assists', stats.assists + 1)} className="w-6 h-6 rounded bg-blue-600 text-white">+</button>
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
            )
            }

            <div className="flex gap-4"><button type="submit" onClick={handleFinalize} disabled={selectedPlayers.length === 0} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">Save Match Result</button><button type="button" onClick={onCancel} className="px-6 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600">Cancel</button></div>
        </div >
    );
};

export default MatchLogger;
