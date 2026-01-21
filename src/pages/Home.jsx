import React, { useState, useEffect } from 'react';
import studentImg from '@/assets/student.jpg';
import institutionImg from '@/assets/institution.jpg';
import employerImg from '@/assets/employer.jpg';
import adminImg from '@/assets/admin.png';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
// import { base44 } from '@/api/base44Client';
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
import { cn } from '@/lib/utils';

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
    id: 'institution',
    title: 'Educational Institution',
    description: 'Issue and manage credentials for students',
    icon: Building2,
    color: 'from-indigo-500 to-violet-600',
    bgColor: 'bg-indigo-500/10',
    features: ['Issue credentials', 'Manage student records', 'Digital signing'],
  },
  {
    id: 'employer',
    title: 'Employer',
    description: 'Verify candidate credentials securely',
    icon: Briefcase,
    color: 'from-cyan-500 to-blue-600',
    bgColor: 'bg-cyan-500/10',
    features: ['Request verification', 'View authenticity status', 'Verification history'],
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const preloadSources = [studentImg, institutionImg, employerImg, adminImg];

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

  // useEffect(() => {
  //   const checkAuth = async () => {
  //     try {
  //       const isAuth = await base44.auth.isAuthenticated();
  //       if (isAuth) {
  //         const userData = await base44.auth.me();
  //         setUser(userData);
  //       }
  //     } catch {
  //       // ignore
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //   checkAuth();
  // }, []);

  const handleRoleSelect = (roleId) => {
    localStorage.setItem('demo_user_role', roleId);
    const dashboardMap = {
      student: 'StudentDashboard',
      institution: 'InstitutionDashboard',
      employer: 'EmployerDashboard',
      admin: 'AdminDashboard',
    };
    navigate(createPageUrl(dashboardMap[roleId]));
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      <div className="sr-only" aria-hidden="true">
        {preloadSources.map((src) => (
          <img key={src} src={src} alt="" loading="eager" fetchpriority="high" decoding="async" />
        ))}
      </div>
      <header className="relative min-h-[90vh] flex items-center justify-center overflow-hidden" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 90vh' }}>
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-background to-background" />
        <div 
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" 
          style={{ willChange: "transform" }}
        />
        <div 
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" 
          style={{ willChange: "transform" }}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative z-10 w-full">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              {/* ...existing code... */}
              
              <motion.h1 
                className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Trust in Every
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                  Digital Credential
                </span>
              </motion.h1>
              
              <motion.p 
                className="mt-6 text-xl md:text-2xl text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed"
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
                <a href="#roles" className="inline-flex flex-col items-center gap-2 text-muted-foreground hover:text-white transition-colors cursor-pointer">
                  <span className="text-sm font-medium tracking-widest uppercase opacity-70">Explore Us</span>
                  <ArrowDown className="w-5 h-5 animate-bounce" />
                </a>
             </motion.div>
          </div>
        </div>

        {/* Floating Abstract Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div 
            initial={{ rotate: 0 }}
            whileInView={{ rotate: 360 }}
            viewport={{ once: false }}
            transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
            style={{ willChange: "transform" }}
            className="absolute top-1/4 left-1/4 w-96 h-96 border border-white/5 rounded-full"
          />
           <motion.div 
            initial={{ rotate: 0 }}
            whileInView={{ rotate: -360 }}
            viewport={{ once: false }}
            transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
            style={{ willChange: "transform" }}
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] border border-white/5 rounded-full"
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
                  <feature.icon className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
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
            {/* Student */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "100px" }}
              transition={{ duration: 0.5, delay: 0 }}
              whileHover={{ y: -5 }}
              style={{ willChange: "transform, opacity" }}
              className="group relative"
            >
              <div className="relative h-full bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl overflow-hidden hover:border-primary/50 transition-colors flex flex-col">
                <img src={studentImg} alt="Student" className="w-full h-40 object-cover" loading="eager" fetchpriority="high" decoding="async" />
                <div className="p-8 flex-1 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Student</h3>
                    <p className="text-white/80 text-sm leading-relaxed">View and manage your academic credentials</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Upload credentials</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Track verification status</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Share with employers</li>
                  </ul>
                  <Button onClick={() => handleRoleSelect('student')} className="w-full bg-primary text-white border border-primary transition-all duration-300">Authenticate<ArrowDown className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></Button>
                </div>
              </div>
            </motion.div>
            {/* Educational Institution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -5 }}
              style={{ willChange: "transform, opacity" }}
              className="group relative"
            >
              <div className="relative h-full bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl overflow-hidden hover:border-primary/50 transition-colors flex flex-col">
                <img src={institutionImg} alt="Educational Institution" className="w-full h-40 object-cover" loading="eager" fetchpriority="high" decoding="async" />
                <div className="p-8 flex-1 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Educational Institution</h3>
                    <p className="text-white/80 text-sm leading-relaxed">Issue and manage credentials for students</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Issue credentials</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Manage student records</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Digital signing</li>
                  </ul>
                  <Button onClick={() => handleRoleSelect('institution')} className="w-full bg-primary text-white border border-primary transition-all duration-300">Authenticate<ArrowDown className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></Button>
                </div>
              </div>
            </motion.div>
            {/* Employer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -5 }}
              style={{ willChange: "transform, opacity" }}
              className="group relative"
            >
              <div className="relative h-full bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl overflow-hidden hover:border-primary/50 transition-colors flex flex-col">
                <img src={employerImg} alt="Employer" className="w-full h-40 object-cover" loading="eager" fetchpriority="high" decoding="async" />
                <div className="p-8 flex-1 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Employer</h3>
                    <p className="text-white/80 text-sm leading-relaxed">Verify candidate credentials securely</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Request verification</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />View authenticity status</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Verification history</li>
                  </ul>
                  <Button onClick={() => handleRoleSelect('employer')} className="w-full bg-primary text-white border border-primary transition-all duration-300">Authenticate<ArrowDown className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></Button>
                </div>
              </div>
            </motion.div>
            {/* System Administrator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "100px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -5 }}
              style={{ willChange: "transform, opacity" }}
              className="group relative"
            >
              <div className="relative h-full bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl overflow-hidden hover:border-primary/50 transition-colors flex flex-col">
                <img src={adminImg} alt="System Administrator" className="w-full h-40 object-cover" loading="eager" fetchpriority="high" decoding="async" />
                <div className="p-8 flex-1 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">System Administrator</h3>
                    <p className="text-white/80 text-sm leading-relaxed">Manage system security and operations</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Audit logs</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />Security monitoring</li>
                    <li className="flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />User management</li>
                  </ul>
                  <Button onClick={() => handleRoleSelect('admin')} className="w-full bg-primary text-white border border-primary transition-all duration-300">Authenticate<ArrowDown className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ...existing code... */}
    </div>
  );
}
