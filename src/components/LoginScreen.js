import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { ACCESS_CODE_PLAYER, ACCESS_CODE_ADMIN } from '../services/firebase';

const LoginScreen = ({ onLogin }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanCode = code.toUpperCase().trim();
        if (cleanCode === ACCESS_CODE_PLAYER) {
            onLogin('player');
        } else if (cleanCode === ACCESS_CODE_ADMIN) {
            onLogin('admin');
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-slate-950 -z-10"></div>
            <div className="text-center mb-10">
                <Trophy size={48} className="text-yellow-500 drop-shadow-lg mx-auto mb-4" />
                <h1 className="text-4xl font-black uppercase italic tracking-widest text-white mb-2">Friday<span className="text-green-500">FUT</span></h1>
            </div>
            <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ENTER CODE" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-center text-xl font-bold tracking-widest text-white uppercase" />
                    <button type="submit" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg">Unlock</button>
                    {error && <p className="text-red-500 text-xs text-center font-bold">Invalid Code</p>}
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
