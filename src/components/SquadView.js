import React, { useMemo, useState } from 'react';
import { Camera, Filter } from 'lucide-react';
import AdminTools from './AdminTools';
import { getPlayerStats } from '../utils/helpers';

export default function SquadView({
    players,
    checkins,
    matches,
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
        // Big Night (24+ check-ins) expands the playing roster to 24
        const rosterSize = checkins.length >= 24 ? 24 : 12;
        if (index < rosterSize) return 'in';
        return 'waitlist';
    };

    return (
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 sm:mb-6 gap-3 sm:gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Squad</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setFilterCheckedIn(!filterCheckedIn)}
                        className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold flex gap-2 items-center border flex-1 sm:flex-none justify-center min-h-[44px] ${filterCheckedIn ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {squadDisplayPlayers.map(p => {
                    const status = getPlayerStatus(p.id);
                    const pStats = getPlayerStats(p, matches, 'all');
                    return (
                        <div
                            key={p.id}
                            onClick={() => { if (authStatus.role === 'admin') setSelectedPlayerForEdit({ ...p, ...pStats }); }}
                            className={`flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800 group min-h-[64px] ${authStatus.role === 'admin' ? 'cursor-pointer hover:border-slate-600 active:bg-slate-850' : ''}`}
                        >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                                        <img src={p.photoUrl || '/logo.png'} alt={p.name} className="w-full h-full object-cover" />
                                    </div>
                                    {status === 'in' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>}
                                    {status === 'waitlist' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-slate-900"></div>}
                                </div>
                                <span className="font-bold text-slate-200 text-sm sm:text-base truncate">{p.name}</span>
                            </div>
                            <div className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-2 flex-shrink-0">
                                {status === 'in' && <span className="text-green-400 font-bold uppercase text-[9px] sm:text-[10px]">Playing</span>}
                                {status === 'waitlist' && <span className="text-orange-400 font-bold uppercase text-[9px] sm:text-[10px]">Waitlist</span>}
                                <span className="ml-1 sm:ml-2">{pStats.gamesPlayed} Apps</span>
                                {authStatus.role === 'admin' && <div className="opacity-0 group-hover:opacity-100 bg-slate-700 p-1 rounded-full text-white"><Camera size={12} /></div>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={() => setView('dashboard')} className="mt-6 sm:mt-8 text-slate-400 hover:text-white text-sm font-bold flex items-center gap-1 min-h-[44px]">← Back to Dashboard</button>
        </div>
    );
}
