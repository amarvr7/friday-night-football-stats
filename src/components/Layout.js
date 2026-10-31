import React from 'react';
import { Trophy, Award, Plus, Lock, BarChart2, Users, Shirt, Activity } from 'lucide-react';

export default function Layout({ children, view, setView, authStatus, handleLogout, hasUpcomingTeams, handleStartLiveMatch }) {
    const navItems = [
        { id: 'dashboard', label: 'Home', icon: Trophy, onClick: () => setView('dashboard'), active: view === 'dashboard' },
        { id: 'records', label: 'Records', icon: Award, onClick: () => setView('records'), active: view === 'records' },
        { id: 'stats', label: 'Stats', icon: BarChart2, onClick: () => setView('stats'), active: view === 'stats' || view === 'log-match' },
        { id: 'players', label: 'Squad', icon: Users, onClick: () => setView('players'), active: view === 'players' },
        ...(authStatus.role === 'admin' ? [
            { id: 'teams', label: 'Sheet', icon: Shirt, onClick: () => setView('teams'), active: view === 'teams' },
            {
                id: 'live-or-add',
                label: hasUpcomingTeams ? 'Live' : 'Quick+',
                icon: hasUpcomingTeams ? Activity : Plus,
                onClick: hasUpcomingTeams ? handleStartLiveMatch : () => setView('add-match'),
                active: view === 'add-match' || view === 'live-match',
                pulse: hasUpcomingTeams && view !== 'live-match'
            }
        ] : [])
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-nav-safe overflow-x-hidden">
            {/* Header */}
            <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 shadow-lg pt-safe">
                <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex justify-between items-center">
                    <button
                        onClick={() => setView('dashboard')}
                        className="flex items-center gap-2 text-left focus:outline-none"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/30 flex items-center justify-center">
                            <Trophy className="text-yellow-400" size={17} />
                        </div>
                        <h1 className="text-base sm:text-xl font-black uppercase tracking-wider text-white italic">
                            Friday<span className="text-green-400">FUT</span>
                        </h1>
                    </button>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {authStatus.role === 'admin' && (
                            <span className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider">
                                ADMIN
                            </span>
                        )}
                        {authStatus.role === 'admin' && (
                            <button
                                onClick={hasUpcomingTeams ? handleStartLiveMatch : () => setView('add-match')}
                                title={hasUpcomingTeams ? "Start Live Match" : "Quick Stats Entry"}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all min-h-[36px] ${hasUpcomingTeams
                                    ? 'bg-green-500 hover:bg-green-400 text-slate-950 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                    }`}
                            >
                                {hasUpcomingTeams ? <Activity size={14} className="animate-pulse" /> : <Plus size={14} />}
                                <span>{hasUpcomingTeams ? 'Go Live' : 'Stats'}</span>
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            title="Lock / Logout"
                            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                        >
                            <Lock size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 pb-safe z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-stretch justify-between max-w-5xl mx-auto w-full px-1">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={item.onClick}
                                className={`relative flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-1 transition-all min-h-[56px] ${
                                    item.active
                                        ? 'text-green-400'
                                        : item.pulse
                                            ? 'text-green-400 animate-pulse'
                                            : 'text-slate-500 hover:text-slate-300 active:scale-95'
                                }`}
                            >
                                {item.active && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-400 rounded-full" />
                                )}
                                <Icon size={19} strokeWidth={item.active ? 2.5 : 2} />
                                <span className="text-[10px] font-bold mt-1 uppercase tracking-tight truncate w-full text-center">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
