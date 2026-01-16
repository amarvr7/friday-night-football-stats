import React, { useState } from 'react';
import { UserPlus, Zap, FileUp, Trash2, AlertTriangle } from 'lucide-react';
import { addDoc, collection, serverTimestamp, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, PROJECT_ID, COLLECTIONS } from '../services/firebase';
import SEED_DATA from '../utils/seedData';

export default function AdminTools({ user, players, availableLegends, setShowImporter, handleSeedData }) {
    const [newPlayerName, setNewPlayerName] = useState('');
    const [quickAddPlayer, setQuickAddPlayer] = useState('');

    const handleAddPlayer = async (e) => {
        e.preventDefault();
        if (!newPlayerName.trim() || !user) return;
        await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS), {
            name: newPlayerName.trim(),
            goals: 0,
            assists: 0,
            wins: 0,
            gamesPlayed: 0,
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

        try {
            if (existingPlayer) {
                const ref = doc(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS, existingPlayer.id);
                await updateDoc(ref, {
                    goals: seedPlayer.goals,
                    wins: seedPlayer.wins,
                    gamesPlayed: seedPlayer.gamesPlayed
                });
                alert(`Updated ${seedPlayer.name}'s stats!`);
            } else {
                await addDoc(collection(db, 'artifacts', PROJECT_ID, 'public', 'data', COLLECTIONS.PLAYERS), {
                    ...seedPlayer,
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
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase">Admin Controls</h3>
                <div className="flex gap-2">
                    <button onClick={handleSeedData} className="bg-yellow-600/20 text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-bold flex gap-2"><Zap size={16} /> Load History</button>
                    <button onClick={() => setShowImporter(true)} className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold flex gap-2"><FileUp size={16} /> Import CSV</button>
                </div>
            </div>

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

            <div className="border-t border-slate-800 pt-4">
                <h3 className="text-sm font-bold text-red-500 uppercase mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Danger Zone</h3>
                <button
                    onClick={handleResetData}
                    className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <Trash2 size={18} /> Reset Database (Delete All Data)
                </button>
            </div>

            <p className="text-xs text-slate-500 mt-4 italic">Tip: Typing a Legend's name in the "Type new name" box will also automatically pull their stats!</p>
        </div>
    );
}
