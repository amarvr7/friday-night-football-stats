import React, { useState } from 'react';
import { TrendingUp, Save, AlertCircle } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';

export default function StatsLogger({ players, onBack }) {
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [statsForm, setStatsForm] = useState({
        goals: '',
        assists: '',
        wins: '',
        gamesPlayed: '',
        cleanSheets: '',
        motms: '',
        goalsFor: '',
        goalsAgainst: ''
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

        const updates = {};
        let hasChanges = false;

        Object.keys(statsForm).forEach(key => {
            const value = parseInt(statsForm[key]) || 0;
            if (value !== 0) {
                updates[key] = increment(value);
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            alert('Please enter at least one stat value');
            return;
        }

        try {
            const playerRef = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, selectedPlayer);
            await updateDoc(playerRef, updates);

            const player = players.find(p => p.id === selectedPlayer);
            const summary = [];
            
            if (parseInt(statsForm.goals) || 0) summary.push(`${statsForm.goals} goal${Math.abs(parseInt(statsForm.goals)) !== 1 ? 's' : ''}`);
            if (parseInt(statsForm.assists) || 0) summary.push(`${statsForm.assists} assist${Math.abs(parseInt(statsForm.assists)) !== 1 ? 's' : ''}`);
            if (parseInt(statsForm.wins) || 0) summary.push(`${statsForm.wins} win${Math.abs(parseInt(statsForm.wins)) !== 1 ? 's' : ''}`);
            if (parseInt(statsForm.gamesPlayed) || 0) summary.push(`${statsForm.gamesPlayed} game${Math.abs(parseInt(statsForm.gamesPlayed)) !== 1 ? 's' : ''}`);
            if (parseInt(statsForm.cleanSheets) || 0) summary.push(`${statsForm.cleanSheets} clean sheet${Math.abs(parseInt(statsForm.cleanSheets)) !== 1 ? 's' : ''}`);
            if (parseInt(statsForm.motms) || 0) summary.push(`${statsForm.motms} MOTM`);
            if (parseInt(statsForm.goalsFor) || 0) summary.push(`${statsForm.goalsFor} GF`);
            if (parseInt(statsForm.goalsAgainst) || 0) summary.push(`${statsForm.goalsAgainst} GA`);

            alert(`Successfully updated ${player.name}:\n${summary.join(', ')}`);

            setStatsForm({
                goals: '',
                assists: '',
                wins: '',
                gamesPlayed: '',
                cleanSheets: '',
                motms: '',
                goalsFor: '',
                goalsAgainst: ''
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
                        <label className="block text-slate-300 font-bold mb-2 text-sm">Select Player</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-600 text-white p-3 rounded-lg text-base"
                            value={selectedPlayer}
                            onChange={(e) => setSelectedPlayer(e.target.value)}
                            required
                        >
                            <option value="">Choose a player...</option>
                            {players.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedPlayerData && (
                        <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700">
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Current Stats for {selectedPlayerData.name}</h3>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 text-center text-xs">
                                <div>
                                    <span className="text-slate-500 block mb-1">Goals</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.goals || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block mb-1">Assists</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.assists || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block mb-1">Wins</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.wins || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block mb-1">Games</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.gamesPlayed || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block mb-1">CS</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.cleanSheets || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block mb-1">MOTM</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.motms || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block mb-1">GF</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.goalsFor || 0}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block mb-1">GA</span>
                                    <span className="text-white font-bold text-base">{selectedPlayerData.goalsAgainst || 0}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 sm:p-6 mb-6">
                        <h3 className="text-sm font-bold text-blue-400 uppercase mb-4">Enter Stats to Add/Subtract</h3>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Goals</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.goals}
                                    onChange={(e) => handleInputChange('goals', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Assists</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.assists}
                                    onChange={(e) => handleInputChange('assists', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Wins</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.wins}
                                    onChange={(e) => handleInputChange('wins', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Games</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.gamesPlayed}
                                    onChange={(e) => handleInputChange('gamesPlayed', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Clean Sheets</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.cleanSheets}
                                    onChange={(e) => handleInputChange('cleanSheets', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">MOTM</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.motms}
                                    onChange={(e) => handleInputChange('motms', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Goals For</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.goalsFor}
                                    onChange={(e) => handleInputChange('goalsFor', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-xs font-bold mb-2">Goals Against</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full bg-slate-900 border border-slate-600 text-white px-3 py-2 rounded text-base"
                                    value={statsForm.goalsAgainst}
                                    onChange={(e) => handleInputChange('goalsAgainst', e.target.value)}
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
                        className="w-full bg-blue-600 disabled:opacity-50 hover:bg-blue-500 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-lg shadow-lg transition-all mb-4"
                    >
                        <Save size={20} /> Save Stats Changes
                    </button>
                </form>

                <button
                    onClick={onBack}
                    className="w-full text-slate-400 hover:text-white text-sm font-bold"
                >
                    ← Back to Dashboard
                </button>
            </div>
        </div>
    );
}
