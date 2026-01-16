import React from 'react';
import { Trophy, Plus, Lock, BarChart2, Users, Shirt, Activity } from 'lucide-react';

export default function Layout({ children, view, setView, authStatus, handleLogout }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-2xl">
                <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Trophy className="text-yellow-500" />
                        <h1 className="text-xl font-black uppercase tracking-widest text-white italic">
                            Friday<span className="text-green-500">FUT</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {authStatus.role === 'admin' && (
                            <div className="bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded">
                                ADMIN
                            </div>
                        )}
                        {authStatus.role === 'admin' && (
                            <button
                                onClick={() => setView('add-match')}
                                className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"
                            >
                                <Plus size={16} /> Match
                            </button>
                        )}
                        <button onClick={handleLogout} className="text-slate-500 hover:text-white">
                            <Lock size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 py-6">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 pb-safe z-40">
                <div className="flex justify-around items-center max-w-4xl mx-auto">
                    <button
                        onClick={() => setView('dashboard')}
                        className={`flex flex-col items-center py-3 px-6 ${view === 'dashboard' ? 'text-green-400' : 'text-slate-500'}`}
                    >
                        <Trophy size={20} />
                        <span className="text-[10px] font-bold mt-1 uppercase">Home</span>
                    </button>
                    <button
                        onClick={() => setView('stats')}
                        className={`flex flex-col items-center py-3 px-6 ${view === 'stats' ? 'text-green-400' : 'text-slate-500'}`}
                    >
                        <BarChart2 size={20} />
                        <span className="text-[10px] font-bold mt-1 uppercase">Stats</span>
                    </button>
                    <button
                        onClick={() => setView('players')}
                        className={`flex flex-col items-center py-3 px-6 ${view === 'players' ? 'text-green-400' : 'text-slate-500'}`}
                    >
                        <Users size={20} />
                        <span className="text-[10px] font-bold mt-1 uppercase">Squad</span>
                    </button>
                    {authStatus.role === 'admin' && (
                        <>
                            <button
                                onClick={() => setView('teams')}
                                className={`flex flex-col items-center py-3 px-6 ${view === 'teams' ? 'text-green-400' : 'text-slate-500'}`}
                            >
                                <Shirt size={20} />
                                <span className="text-[10px] font-bold mt-1 uppercase">Sheet</span>
                            </button>
                            <button
                                onClick={() => setView('add-match')}
                                className={`flex flex-col items-center py-3 px-6 ${view === 'add-match' ? 'text-green-400' : 'text-slate-500'}`}
                            >
                                <Activity size={20} />
                                <span className="text-[10px] font-bold mt-1 uppercase">Log</span>
                            </button>
                        </>
                    )}
                </div>
            </nav>
        </div>
    );
}
