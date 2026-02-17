import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import studentImg from '@/assets/student.jpg';
import employeeImg from '@/assets/employer.jpg';
import adminImg from '@/assets/admin.png';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  Building2,
  Briefcase,
  Shield,
  ArrowDown,
  CheckCircle2,
  Lock,
  Brain,
  Box,
  FileCheck,
  Users,
  Globe,
} from 'lucide-react';
import { motion } from 'framer-motion';


import { useUser } from '@clerk/clerk-react';

const roles = [
  {
    id: 'student',
    title: 'Student',
    description: 'View and manage your academic credentials',
    icon: GraduationCap,
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-500/10',
    features: ['Upload credentials', 'Track verification status', 'Share with employers'],
  },
  {
    id: 'employee',
    title: 'Employee',
    description: 'Issue, manage, and verify credentials for organizations',
    icon: Briefcase,
    color: 'from-indigo-500 to-cyan-500',
    bgColor: 'bg-indigo-500/10',
    features: ['Issue credentials', 'Manage student records', 'Request & verify credentials', 'Verification history'],
  },
  {
    id: 'admin',
    title: 'System Administrator',
    description: 'Manage system security and operations',
    icon: Shield,
    color: 'from-violet-500 to-fuchsia-600',
    bgColor: 'bg-violet-500/10',
    features: ['Audit logs', 'Security monitoring', 'User management'],
  },
];

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Validation',
    description: 'Advanced document analysis and fraud detection',
  },
  {
    icon: Box,
    title: 'Blockchain Security',
    description: 'Immutable credential records on distributed ledger',
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'Data Encryption, Access Control, and Compliance',
  },
  {
    icon: FileCheck,
    title: 'Instant Verification',
    description: 'Real-time credential authenticity checks',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  
  const [pendingRole, setPendingRole] = useState(null);
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (isSignedIn && pendingRole) {
      // Navigate client-side to dashboard after sign-in and sync (avoid full page reload)
      navigate(`/${pendingRole.toLowerCase()}-dashboard`, { replace: true });
    }
  }, [isSignedIn, pendingRole, navigate]);

  useEffect(() => {
    const stored = localStorage.getItem('pending_role');
    if (isSignedIn && stored) {
      const uiRole = ['EMPLOYEE', 'INSTITUTION', 'EMPLOYER'].includes(stored) ? 'employee' : stored.toLowerCase();
      navigate(`/${uiRole}-dashboard`, { replace: true });
    }
  }, [isSignedIn, navigate]);

  // Listen for auth success messages from the auth popup/tab or storage changes
  useEffect(() => {
    function handleAuthMessage(e) {
      // Only accept messages from the same origin
      try {
        if (e.origin !== window.location.origin) return;
      } catch (err) {
        return;
      }

      const data = e.data || {};
      if (data.type === 'clerk_signed_in' && data.path) {
        setPendingRole(null);
        navigate(data.path, { replace: true });
      }
    }

    function handleStorage(e) {
      if (e.key === 'clerk_signed_in_path' && e.newValue) {
        try {
          const path = e.newValue;
          // remove the storage key so it doesn't trigger again
          localStorage.removeItem('clerk_signed_in_path');
          setPendingRole(null);
          navigate(path, { replace: true });
        } catch (err) {
          // ignore
        }
      }
    }

    window.addEventListener('message', handleAuthMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleAuthMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [navigate]);
  const preloadSources = [studentImg, employeeImg, adminImg];

  useEffect(() => {
    const links = preloadSources.map((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
      return link;
    });

    const timeoutId = setTimeout(() => {
      preloadSources.forEach((src) => {
        const img = new Image();
        img.src = src;
        if (img.decode) {
          img.decode().catch(() => {});
        }
      });
    }, 1000);

    return () => {
      links.forEach((link) => link.parentNode?.removeChild(link));
      clearTimeout(timeoutId);
    };
  }, []);

  const handleRoleSelect = (roleId) => {
    const upper = roleId.toUpperCase();
    const mappedBackendRole = ['INSTITUTION', 'EMPLOYER'].includes(upper) ? 'EMPLOYEE' : upper;
    localStorage.setItem('pending_role', mappedBackendRole);
    setPendingRole(roleId);

    // Navigate current window to the auth route (replace history)
    const authUrl = `/auth?role=${encodeURIComponent(roleId)}`;
    navigate(authUrl, { replace: true });
  };

  const handleSignInClose = () => {
    setPendingRole(null);
    localStorage.removeItem('pending_role');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      {/* Sign-in opens in a separate tab via `/auth`; inline modal removed */}
      <div className="sr-only" aria-hidden="true">
        {preloadSources.map((src) => (
          <img key={src} src={src} alt="" loading="eager" fetchPriority="high" decoding="async" />
        ))}
      </div>
      <header className="relative min-h-[90vh] flex items-center justify-center overflow-hidden" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 90vh' }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-background to-background" />
        <div 
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" 
          style={{ willChange: "transform" }}
        />
        <div 
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" 
          style={{ willChange: "transform" }}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative z-10 w-full">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              
              
              <motion.h1 
                className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] mb-8 text-slate-900"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Trust in Every
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Digital Credential
                </span>
              </motion.h1>
              
              <motion.p 
                className="mt-6 text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Next-generation verification system powered by privacy-focused AI and immutable ledger technology.
              </motion.p>
            </motion.div>

             <motion.div 
               className="mt-12 group"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.5 }}
             >
                <a href="#roles" className="inline-flex flex-col items-center gap-2 text-slate-400 hover:text-primary transition-colors cursor-pointer">
                  <span className="text-sm font-medium tracking-widest uppercase opacity-70">Explore Us</span>
                  <ArrowDown className="w-5 h-5 animate-bounce" />
                </a>
             </motion.div>
          </div>
        </div>

        {/* Floating Abstract Elements - Subtle in Light Mode */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <motion.div 
            initial={{ rotate: 0 }}
            whileInView={{ rotate: 360 }}
            viewport={{ once: false }}
            transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
            style={{ willChange: "transform" }}
            className="absolute top-1/4 left-1/4 w-96 h-96 border border-indigo-200 rounded-full"
          />
           <motion.div 
            initial={{ rotate: 0 }}
            whileInView={{ rotate: -360 }}
            viewport={{ once: false }}
            transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
            style={{ willChange: "transform" }}
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] border border-purple-200 rounded-full"
          />
        </div>
      </header>

      <div id="roles" className="relative z-20 -mt-20" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 1000px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "100px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                style={{ willChange: "transform, opacity" }}
                className="bg-card/50 backdrop-blur-md border border-border/50 p-6 rounded-2xl hover:bg-card/80 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  {React.createElement(feature.icon, { className: "w-6 h-6 text-primary group-hover:scale-110 transition-transform" })}
                </div>
                <h3 className="font-semibold text-foreground text-base mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Select Authentication Role</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Identify your user type to access the portal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-24">
            {roles.map((role, idx) => (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "100px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
                style={{ willChange: "transform, opacity" }}
                className="group relative"
              >
                <div className="relative h-full bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl overflow-hidden hover:border-primary/50 transition-colors flex flex-col">
                  <div className="w-full h-40 flex items-center justify-center bg-muted/30 group-hover:bg-muted/50 transition-colors">
                    {React.createElement(role.icon, { className: "w-12 h-12 text-primary" })}
                  </div>
                  <div className="p-8 flex-1 flex flex-col justify-between gap-6">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">{role.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{role.description}</p>
                    </div>
                    <ul className="space-y-3">
                      {role.features && role.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    <Button onClick={() => handleRoleSelect(role.id)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border border-transparent shadow-md transition-all duration-300">
                      Authenticate
                      <ArrowDown className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ...existing code... */}
    </div>
  );
}
