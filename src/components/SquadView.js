import React, { useMemo, useState } from 'react';
import { Camera, Users, Filter, Trophy } from 'lucide-react';
import AdminTools from './AdminTools';

export default function SquadView({
    players,
    checkins,
    authStatus,
    user,
    availableLegends,
    setShowImporter,
    handleSeedData,
    setSelectedPlayerForEdit,
    setView
}) {
    const [filterCheckedIn, setFilterCheckedIn] = useState(false);

    // Derived Filtered List for Squad View
    const squadDisplayPlayers = useMemo(() => {
        if (!filterCheckedIn) return players;
        return players.filter(p => checkins.some(c => c.playerId === p.id));
    }, [players, checkins, filterCheckedIn]);

    const getPlayerStatus = (playerId) => {
        const index = checkins.findIndex(c => c.playerId === playerId);
        if (index === -1) return null;
        if (index < 12) return 'in';
        return 'waitlist';
    };

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                <h2 className="text-2xl font-bold text-white">Squad</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterCheckedIn(!filterCheckedIn)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold flex gap-2 border ${filterCheckedIn ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}
                    >
                        <Filter size={16} /> {filterCheckedIn ? 'Show All' : 'Show Checked In'}
                    </button>
                </div>
            </div>

            {authStatus.role === 'admin' && (
                <AdminTools
                    user={user}
                    players={players}
                    availableLegends={availableLegends}
                    setShowImporter={setShowImporter}
                    handleSeedData={handleSeedData}
                />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {squadDisplayPlayers.map(p => {
                    const status = getPlayerStatus(p.id);
                    return (
                        <div
                            key={p.id}
                            onClick={() => { if (authStatus.role === 'admin') setSelectedPlayerForEdit(p); }}
                            className={`flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800 group ${authStatus.role === 'admin' ? 'cursor-pointer hover:border-slate-600' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                                        {p.photoUrl ? (
                                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Users size={16} className="text-slate-500" />
                                        )}
                                    </div>
                                    {/* STATUS INDICATOR DOT */}
                                    {status === 'in' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>}
                                    {status === 'waitlist' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-slate-900"></div>}
                                </div>
                                <span className="font-bold text-slate-200">{p.name}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                {status === 'in' && <span className="text-green-400 font-bold uppercase text-[10px]">Playing</span>}
                                {status === 'waitlist' && <span className="text-orange-400 font-bold uppercase text-[10px]">Waitlist</span>}
                                <span className="ml-2">{p.gamesPlayed} Apps</span>
                                {authStatus.role === 'admin' && <div className="opacity-0 group-hover:opacity-100 bg-slate-700 p-1 rounded-full text-white"><Camera size={12} /></div>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={() => setView('dashboard')} className="mt-8 text-slate-400 hover:text-white text-sm font-bold flex items-center gap-1">← Back to Dashboard</button>
        </div>
    );
}
