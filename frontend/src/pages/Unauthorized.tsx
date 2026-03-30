import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function Unauthorized() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 relative overflow-hidden font-jakarta text-white">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] h-[300px] w-[300px] animate-blob rounded-full bg-indigo-600/20 blur-[120px] sm:h-[600px] sm:w-[600px]"></div>
            <div className="absolute bottom-[-20%] right-[-10%] h-[300px] w-[300px] animate-blob animation-delay-2000 rounded-full bg-rose-600/20 blur-[120px] sm:h-[600px] sm:w-[600px]"></div>

            <div className="glass-card mx-4 flex w-full max-w-md flex-col items-center rounded-lg border border-white/5 p-6 text-center relative z-10 sm:p-12">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                     <ShieldAlert size={40} className="text-rose-500" />
                </div>
                
                <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent mb-2 sm:text-6xl">403</h1>
                <h2 className="text-lg font-semibold text-white mb-4">Access Denied</h2>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    Hold up! You don't have the required permissions to access this secure area. Please contact an administrator if you think this is a mistake.
                </p>

                <Link 
                    to="/" 
                    className="group flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-xl font-bold hover:bg-indigo-50 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/10"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Safety
                </Link>
            </div>
        </div>
    )
}
