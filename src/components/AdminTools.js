import React, { useState, useEffect } from 'react';
import { UserPlus, Zap, FileUp, Trash2, AlertTriangle, Sliders, RotateCcw, Check } from 'lucide-react';
import { addDoc, collection, serverTimestamp, doc, updateDoc, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import SEED_DATA from '../utils/seedData';
import { DEFAULT_RATING_WEIGHTS } from '../utils/statsEngine';

export default function AdminTools({ user, players, availableLegends, setShowImporter, handleSeedData, ratingWeights = DEFAULT_RATING_WEIGHTS }) {
    const [newPlayerName, setNewPlayerName] = useState('');
    const [quickAddPlayer, setQuickAddPlayer] = useState('');
    const [showRatingConfig, setShowRatingConfig] = useState(false);
    const [weightsForm, setWeightsForm] = useState({ ...DEFAULT_RATING_WEIGHTS, ...ratingWeights });
    const [savingWeights, setSavingWeights] = useState(false);

    useEffect(() => {
        setWeightsForm({ ...DEFAULT_RATING_WEIGHTS, ...ratingWeights });
    }, [ratingWeights]);

    const handleSaveRatingConfig = async (e) => {
        e.preventDefault();
        setSavingWeights(true);
        try {
            await setDoc(doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.SETTINGS, 'ratingConfig'), {
                weights: weightsForm,
                updatedAt: serverTimestamp()
            });
            alert('Match Contribution Rating weights saved!');
            setShowRatingConfig(false);
        } catch (err) {
            console.error('Failed to save rating config', err);
            alert('Failed to save rating weights: ' + err.message);
        } finally {
            setSavingWeights(false);
        }
    };

    const handleResetRatingConfig = () => {
        setWeightsForm({ ...DEFAULT_RATING_WEIGHTS });
    };
    
    const handleAddPlayer = async (e) => {
        e.preventDefault();
        if (!newPlayerName.trim() || !user) return;
        const trimmed = newPlayerName.trim();
        const seedPlayer = SEED_DATA.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
        const historical = seedPlayer
            ? { gamesPlayed: seedPlayer.gamesPlayed || 0, goals: seedPlayer.goals || 0, wins: seedPlayer.wins || 0 }
            : { gamesPlayed: 0, goals: 0, wins: 0 };

        await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS), {
            name: seedPlayer ? seedPlayer.name : trimmed,
            goals: historical.goals,
            assists: 0,
            wins: historical.wins,
            gamesPlayed: historical.gamesPlayed,
            historical,
            ...(seedPlayer?.ratings ? { ratings: seedPlayer.ratings } : {}),
            createdAt: serverTimestamp()
        });
        setNewPlayerName('');
    };

    const handleQuickAdd = async (e) => {
        e.preventDefault();
        if (!quickAddPlayer || !user) return;

        const seedPlayer = SEED_DATA.find(p => p.name === quickAddPlayer);
        if (!seedPlayer) return;

        const existingPlayer = players.find(p => p.name.toLowerCase() === seedPlayer.name.toLowerCase());
        const historical = {
            gamesPlayed: seedPlayer.gamesPlayed || 0,
            goals: seedPlayer.goals || 0,
            wins: seedPlayer.wins || 0
        };

        try {
            if (existingPlayer) {
                const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existingPlayer.id);
                await updateDoc(ref, {
                    historical: {
                        ...(existingPlayer.historical || {}),
                        ...historical
                    },
                    goals: seedPlayer.goals,
                    wins: seedPlayer.wins,
                    gamesPlayed: seedPlayer.gamesPlayed
                });
                alert(`Updated ${seedPlayer.name}'s baseline stats!`);
            } else {
                await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS), {
                    ...seedPlayer,
                    historical,
                    assists: 0,
                    createdAt: serverTimestamp()
                });
                alert(`Added ${seedPlayer.name} to the squad!`);
            }
            setQuickAddPlayer('');
        } catch (err) {
            console.error("Quick add failed", err);
        }
    };

    const handleResetData = async () => {
        if (!window.confirm("DANGER: Are you sure you want to delete ALL data? This cannot be undone.")) return;
        if (!window.confirm("Double check: This will wipe all players, matches, and checkins. Proceed?")) return;

        try {
            const batch = writeBatch(db);

            // 1. Delete Players
            const playersSnapshot = await getDocs(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS));
            playersSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // 2. Delete Matches
            const matchesSnapshot = await getDocs(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.MATCHES));
            matchesSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // 3. Delete Checkins
            const checkinsSnapshot = await getDocs(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.CHECKINS));
            checkinsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            alert("Database has been reset.");
        } catch (err) {
            console.error("Reset failed", err);
            alert("Failed to reset database: " + err.message);
        }
    };

    return (
        <div className="mb-8 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase">Admin Controls</h3>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setShowRatingConfig(!showRatingConfig)}
                        className="bg-purple-600/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5"
                    >
                        <Sliders size={15} /> {showRatingConfig ? 'Hide MCR Config' : '0–10 Rating Config'}
                    </button>
                    <button onClick={handleSeedData} className="bg-yellow-600/20 text-yellow-400 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5"><Zap size={15} /> Load History</button>
                    <button onClick={() => setShowImporter(true)} className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5"><FileUp size={15} /> Import CSV</button>
                </div>
            </div>

            {showRatingConfig && (
                <form onSubmit={handleSaveRatingConfig} className="mb-6 p-4 bg-slate-950/80 border border-purple-500/30 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                            <h4 className="text-xs sm:text-sm font-black uppercase text-purple-300 tracking-wider">
                                0–10 Match Contribution Rating Formula
                            </h4>
                            <p className="text-[11px] text-slate-400">
                                Calculated strictly in code. Adjust weights below to customize player match ratings.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleResetRatingConfig}
                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700"
                        >
                            <RotateCcw size={12} /> Defaults
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {[
                            { key: 'baseline', label: 'Base Rating', step: 0.1 },
                            { key: 'goalWeight', label: 'Goal (+)', step: 0.1 },
                            { key: 'assistWeight', label: 'Assist (+)', step: 0.1 },
                            { key: 'winBonus', label: 'Win Bonus (+)', step: 0.1 },
                            { key: 'drawBonus', label: 'Draw Bonus (+)', step: 0.1 },
                            { key: 'lossPenalty', label: 'Loss Penalty (-)', step: 0.1 },
                            { key: 'cleanSheetBonus', label: 'Clean Sheet (+)', step: 0.1 },
                            { key: 'motmBonus', label: 'MOTM Bonus (+)', step: 0.1 },
                            { key: 'hatTrickBonus', label: 'Hat-Trick (+)', step: 0.1 },
                            { key: 'ownGoalPenalty', label: 'Own Goal (-)', step: 0.1 }
                        ].map(item => (
                            <div key={item.key} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    {item.label}
                                </label>
                                <input
                                    type="number"
                                    step={item.step}
                                    value={weightsForm[item.key]}
                                    onChange={(e) => setWeightsForm(prev => ({ ...prev, [item.key]: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="submit"
                            disabled={savingWeights}
                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5"
                        >
                            <Check size={14} /> {savingWeights ? 'Saving…' : 'Save Rating Weights'}
                        </button>
                    </div>
                </form>
            )}

            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Add New Player</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Quick Add Legend */}
                <form onSubmit={handleQuickAdd} className="flex gap-2">
                    <select
                        className="flex-1 bg-slate-800 text-white p-2 rounded border border-slate-600 text-sm"
                        value={quickAddPlayer}
                        onChange={(e) => setQuickAddPlayer(e.target.value)}
                    >
                        <option value="">Select a Legend...</option>
                        {availableLegends.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <button type="submit" disabled={!quickAddPlayer} className="bg-blue-600 disabled:opacity-50 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1">
                        <UserPlus size={16} /> Add/Update
                    </button>
                </form>

                {/* Manual Add */}
                <form onSubmit={handleAddPlayer} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Or type new name..."
                        className="flex-1 bg-slate-800 border border-slate-600 text-white px-4 py-2 rounded text-sm"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                    <button type="submit" disabled={!newPlayerName} className="bg-green-600 disabled:opacity-50 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">
                        Create
                    </button>
                </form>
            </div>

            <p className="text-xs text-slate-500 mt-4 italic">Tip: Typing a Legend's name in the "Type new name" box will also automatically pull their stats!</p>

            <div className="border-t border-slate-800 pt-4 mt-6">
                <h3 className="text-sm font-bold text-red-500 uppercase mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Danger Zone</h3>
                <button
                    onClick={handleResetData}
                    className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <Trash2 size={18} /> Reset Database (Delete All Data)
                </button>
            </div>
        </div>
    );
}
