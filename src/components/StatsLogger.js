import React, { useState } from 'react';
import { TrendingUp, Save, AlertCircle } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import { getPlayerHistoricalBaseline, calculateStatsFromMatches, getPlayerStats } from '../utils/helpers';

// The 2026 leaderboards read from the nested season2026 map (plus match docs),
// while all-time views read historical + matches + season2026. gamesPlayed is stored as
// season2026.games, hence the mapping.
const SEASON_2026_FIELD_MAP = {
    goals: 'goals',
    assists: 'assists',
    wins: 'wins',
    gamesPlayed: 'games',
    cleanSheets: 'cleanSheets',
    motms: 'motms',
    goalsFor: 'goalsFor',
    goalsAgainst: 'goalsAgainst',
    ownGoals: 'ownGoals'
};

export default function StatsLogger({ players, matches = [], onBack }) {
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [targetSeason, setTargetSeason] = useState('2026'); // '2026' or 'alltime'
    const [statsForm, setStatsForm] = useState({
        goals: '',
        assists: '',
        wins: '',
        gamesPlayed: '',
        cleanSheets: '',
        motms: '',
        goalsFor: '',
        goalsAgainst: '',
        ownGoals: ''
    });

    const handleInputChange = (field, value) => {
        setStatsForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSaveStats = async (e) => {
        e.preventDefault();
        
        if (!selectedPlayer) {
            alert('Please select a player');
            return;
        }

        const player = players.find(p => p.id === selectedPlayer);
        if (!player) return;

        const updates = {};
        let hasChanges = false;

        // If updating all-time stats, ensure player.historical is initialized from baseline
        const allMatchStats = calculateStatsFromMatches(player, matches);
        const currentHistorical = getPlayerHistoricalBaseline(player, allMatchStats);

        Object.keys(statsForm).forEach(key => {
            const value = key === 'wins' ? (parseFloat(statsForm[key]) || 0) : (parseInt(statsForm[key], 10) || 0);
            if (value !== 0) {
                if (targetSeason === '2026') {
                    const fieldPath = `season2026.${SEASON_2026_FIELD_MAP[key]}`;
                    updates[fieldPath] = increment(value);
                    // Also increment top-level for legacy compatibility
                    updates[key] = increment(value);
                } else {
                    const newHistVal = Math.max(0, (currentHistorical[key] || 0) + value);
                    updates[`historical.${key}`] = newHistVal;
                    updates[key] = increment(value);
                }
                hasChanges = true;
            }
        });

        // If player didn't have a historical object yet and we're editing alltime, persist all baseline fields
        if (targetSeason === 'alltime' && hasChanges && !player.historical) {
            Object.keys(currentHistorical).forEach(k => {
                if (updates[`historical.${k}`] === undefined) {
                    updates[`historical.${k}`] = currentHistorical[k] || 0;
                }
            });
        }

        if (!hasChanges) {
            alert('Please enter at least one stat value');
            return;
        }

        try {
            const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, selectedPlayer);
            await updateDoc(playerRef, updates);

            const summary = [];
            const parseVal = (k) => k === 'wins' ? (parseFloat(statsForm[k]) || 0) : (parseInt(statsForm[k], 10) || 0);
            
            if (parseVal('goals')) summary.push(`${statsForm.goals} goal${Math.abs(parseVal('goals')) !== 1 ? 's' : ''}`);
            if (parseVal('assists')) summary.push(`${statsForm.assists} assist${Math.abs(parseVal('assists')) !== 1 ? 's' : ''}`);
            if (parseVal('wins')) summary.push(`${statsForm.wins} win${Math.abs(parseVal('wins')) !== 1 ? 's' : ''}`);
            if (parseVal('gamesPlayed')) summary.push(`${statsForm.gamesPlayed} game${Math.abs(parseVal('gamesPlayed')) !== 1 ? 's' : ''}`);
            if (parseVal('cleanSheets')) summary.push(`${statsForm.cleanSheets} clean sheet${Math.abs(parseVal('cleanSheets')) !== 1 ? 's' : ''}`);
            if (parseVal('motms')) summary.push(`${statsForm.motms} MOTM`);
            if (parseVal('goalsFor')) summary.push(`${statsForm.goalsFor} GF`);
            if (parseVal('goalsAgainst')) summary.push(`${statsForm.goalsAgainst} GA`);
            if (parseVal('ownGoals')) summary.push(`${statsForm.ownGoals} OG`);

            alert(`Successfully updated ${player.name} (${targetSeason === '2026' ? '2026 season' : 'all-time'}):\n${summary.join(', ')}`);

            setStatsForm({
                goals: '',
                assists: '',
                wins: '',
                gamesPlayed: '',
                cleanSheets: '',
                motms: '',
                goalsFor: '',
                goalsAgainst: '',
                ownGoals: ''
            });
            setSelectedPlayer('');
        } catch (err) {
            console.error('Failed to update stats:', err);
            alert('Failed to update stats: ' + err.message);
        }
    };

    const selectedPlayerData = players.find(p => p.id === selectedPlayer);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
                <div className="mb-6">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 mb-2">
                        <TrendingUp size={28} className="text-blue-400" /> Quick Stats Entry
                    </h2>
                    <p className="text-slate-400 text-sm">
                        Adjust individual player stats without creating a match. Use negative numbers to subtract.
                    </p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 flex gap-3">
                    <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-yellow-400 font-bold text-sm mb-1">Important: This Does NOT Create a Match</p>
                        <p className="text-yellow-300/80 text-xs">
                            This tool only updates player statistics. To log a full match with teams and scores, use the Match Logger instead.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSaveStats}>
                    <div className="mb-6">
                        <label className="block text-slate-300 font-bold mb-2 text-sm">Apply Stats To</label>
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700/50 mb-2">
                            <button
                                type="button"
                                onClick={() => setTargetSeason('2026')}
                                className={`flex-1 px-3 py-2.5 rounded-md text-xs font-bold transition-all ${targetSeason === '2026' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                2026 Season
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetSeason('alltime')}
                                className={`flex-1 px-3 py-2.5 rounded-md text-xs font-bold transition-all ${targetSeason === 'alltime' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                All-Time (Legacy)
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            {targetSeason === '2026'
                                ? 'Counts towards the 2026 season leaderboards AND all-time totals.'
                                : 'Counts towards all-time baseline totals only (pre-2026 / legacy corrections).'}
                        </p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-slate-300 font-bold mb-2 text-sm">Select Player</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-600 text-white p-3 rounded-lg text-base"
                            value={selectedPlayer}
                            onChange={(e) => setSelectedPlayer(e.target.value)}
                            required
                        >
                            <option value="">Choose a player...</option>
                            {[...players].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedPlayerData && (() => {
                        const isSeason2026 = targetSeason === '2026';
                        const computedStats = getPlayerStats(selectedPlayerData, matches, isSeason2026 ? '2026' : 'all');
                        return (
                            <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700">
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-1">
                                    Current {isSeason2026 ? '2026 Season' : 'All-Time'} Totals for {selectedPlayerData.name}
                                </h3>
                                <p className="text-[11px] text-slate-500 mb-3">
                                    Includes logged matches + manual adjustments.
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-9 gap-2.5 text-center text-xs">
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">Goals</span>
                                        <span className="text-white font-bold text-sm">{computedStats.goals}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">Assists</span>
                                        <span className="text-white font-bold text-sm">{computedStats.assists}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">Wins</span>
                                        <span className="text-white font-bold text-sm">{computedStats.wins}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">Games</span>
                                        <span className="text-white font-bold text-sm">{computedStats.gamesPlayed}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">CS</span>
                                        <span className="text-white font-bold text-sm">{computedStats.cleanSheets}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">MOTM</span>
                                        <span className="text-white font-bold text-sm">{computedStats.motms}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">GF</span>
                                        <span className="text-white font-bold text-sm">{computedStats.goalsFor}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">GA</span>
                                        <span className="text-white font-bold text-sm">{computedStats.goalsAgainst}</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-2 rounded">
                                        <span className="text-slate-500 block mb-0.5">OG</span>
                                        <span className="text-white font-bold text-sm">{computedStats.ownGoals || 0}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 sm:p-6 mb-6">
                        <h3 className="text-sm font-bold text-blue-400 uppercase mb-4">Enter Stats to Add/Subtract</h3>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Goals</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.goals}
                                    onChange={(e) => handleInputChange('goals', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Assists</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.assists}
                                    onChange={(e) => handleInputChange('assists', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Wins (0.5 for draw)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.wins}
                                    onChange={(e) => handleInputChange('wins', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Games</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.gamesPlayed}
                                    onChange={(e) => handleInputChange('gamesPlayed', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Clean Sheets</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.cleanSheets}
                                    onChange={(e) => handleInputChange('cleanSheets', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">MOTM</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.motms}
                                    onChange={(e) => handleInputChange('motms', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Goals For</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.goalsFor}
                                    onChange={(e) => handleInputChange('goalsFor', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Goals Against</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.goalsAgainst}
                                    onChange={(e) => handleInputChange('goalsAgainst', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Own Goals</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2.5 rounded-lg text-base"
                                    value={statsForm.ownGoals}
                                    onChange={(e) => handleInputChange('ownGoals', e.target.value)}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-4 italic">
                            Tip: Use negative numbers to subtract stats (e.g., -1 to remove a goal)
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={!selectedPlayer}
                        className="w-full bg-blue-600 disabled:opacity-50 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-lg shadow-lg transition-all mb-4"
                    >
                        <Save size={20} /> Save Stats Changes
                    </button>
                </form>

                <button
                    onClick={onBack}
                    className="w-full text-slate-400 hover:text-white text-sm font-bold py-2"
                >
                    ← Back to Dashboard
                </button>
            </div>
        </div>
    );
}
