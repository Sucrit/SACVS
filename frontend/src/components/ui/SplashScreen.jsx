import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, FileKey, Server } from 'lucide-react';
import studentImg from '@/assets/student.jpg';
import institutionImg from '@/assets/institution.jpg';
import employerImg from '@/assets/employer.jpg';
import adminImg from '@/assets/admin.png';

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing system...');

  useEffect(() => {
    // Preload images
    const imagesToPreload = [studentImg, institutionImg, employerImg, adminImg];
    let loadedCount = 0;

    const preloadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = resolve;
        img.onerror = resolve; // Continue even if error
      });
    };

    const runLoader = async () => {
      // Start fake loading progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 5;
        });
      }, 100);

      // Preload images in parallel
      setStatus('Preloading assets...');
      await Promise.all(imagesToPreload.map(preloadImage));
      
      clearInterval(progressInterval);
      setProgress(100);
      setStatus('System ready');
      
      setTimeout(onComplete, 800); // Short delay at 100%
    };

    runLoader();

    // Cycling status messages for flair
    const messages = ['Verifying integrity...', 'Connecting to blockchain...', 'Establishing secure tunnel...', 'Loading modules...'];
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
        if(progress < 90) {
            setStatus(messages[msgIndex % messages.length]);
            msgIndex++;
        }
    }, 800);

    return () => {
        clearInterval(msgInterval);
    }
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020817] text-white overflow-hidden font-sans"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020817] to-[#020817]" />
      
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-8">
        {/* Logo/Icon Container */}
        <div className="relative mb-12">
            {/* Spinning Rings */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-6 rounded-full border-t border-r border-indigo-500/50 w-32 h-32"
            />
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-2 rounded-full border-b border-l border-purple-500/50 w-24 h-24 m-auto inset-0"
            />
            
            {/* Central Icon */}
            <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-indigo-500/20 shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                <Shield className="w-10 h-10 text-indigo-400" />
            </div>
            
            {/* Pulse Effect */}
            <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-indigo-500/30 rounded-2xl blur-xl -z-10"
            />
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl font-bold tracking-[0.2em] mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-white">
            SEC_VAULT
        </h1>

        {/* Progress Bar Container */}
        <div className="w-full space-y-4">
            <div className="flex justify-between items-end text-xs font-mono text-indigo-300/80">
                <span className="uppercase tracking-widest">{status}</span>
                <span>{Math.round(progress)}%</span>
            </div>
            
            <div className="h-1 bg-indigo-950/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
                <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_100%]"
                    animate={{ width: `${progress}%`, backgroundPosition: ["0% 0%", "100% 0%"] }}
                    transition={{ width: { type: "spring", stiffness: 50 }, backgroundPosition: { duration: 1, repeat: Infinity, ease: "linear" } }}
                />
            </div>

            {/* System Specs / Decor */}
            <div className="flex justify-between text-[10px] text-indigo-500/40 font-mono pt-2 border-t border-white/5 mt-4">
                <span className="flex items-center gap-1"><Server className="w-3 h-3" /> NODE_SYNC</span>
                <span className="flex items-center gap-1"><FileKey className="w-3 h-3" /> TLS_1.3</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> AES_256</span>
            </div>
        </div>
      </div>
    </motion.div>
  );
}
