import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Shield,
  GraduationCap,
  Activity,
  Menu,
  Settings,
  User,
  LayoutDashboard,
  FileCheck,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserButton, useUser } from '@clerk/clerk-react';

const roleNavItems = {
  student: [
    { label: 'Dashboard', icon: LayoutDashboard, page: 'StudentDashboard', path: '/student-dashboard' },
    { label: 'My Credentials', icon: GraduationCap, page: 'StudentCredentials', path: '#' },
    { label: 'Settings', icon: Settings, page: 'Settings', path: '#' },
  ],
  registrar: [
    { label: 'Dashboard', icon: LayoutDashboard, page: 'RegistrarDashboard', path: '/registrar-dashboard' },
    { label: 'Issue Credentials', icon: FileCheck, page: 'InstitutionDashboard', path: '/institution-dashboard' },
    { label: 'Verify Credentials', icon: Search, page: 'RegistrarVerificationDashboard', path: '/registrar-verification-dashboard' },
    { label: 'Students', icon: User, page: 'Students', path: '#' },
    { label: 'History', icon: Activity, page: 'History', path: '#' },
    { label: 'Settings', icon: Settings, page: 'Settings', path: '#' },
  ],
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, page: 'AdminDashboard', path: '/admin-dashboard' },
    { label: 'Security', icon: Shield, page: 'AdminDashboard', path: '#' },
    { label: 'Audit Logs', icon: Activity, page: 'AdminDashboard', path: '#' },
    { label: 'Users', icon: User, page: 'UserManagement', path: '#' },
  ],
};

export default function MainLayout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useUser();

  const rawRole = user?.publicMetadata?.role || localStorage.getItem('demo_user_role') || 'student';
  const normalizedRole = ['institution'].includes(rawRole?.toLowerCase()) ? 'registrar' : rawRole?.toLowerCase();
  
  const navItems = roleNavItems[normalizedRole] || roleNavItems['student'];

  if (currentPageName === 'Home') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.08),_transparent_38%),radial-gradient(circle_at_bottom_right,_hsl(var(--accent)/0.08),_transparent_34%)]">
      <div className="flex min-h-screen w-full bg-background/72 backdrop-blur-[1px]">
        {/* Desktop Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-border/70 bg-card/70 backdrop-blur-xl sm:flex">
          <div className="flex h-16 items-center border-b border-border/70 px-6">
            <Link to="/" className="group flex items-center gap-3 font-semibold">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-soft transition-transform group-hover:scale-105 overflow-hidden">
                <img
                  src="/SACVS_Logo.png"
                  alt="SACVS logo"
                  className="h-full w-full object-contain"
                  loading="eager"
                />
              </div>
              <div className="leading-tight">
                <span className="block text-sm text-muted-foreground font-semibold tracking-[0.12em] uppercase">Secured</span>
                <span className="text-lg font-heading text-foreground">SACVS</span>
              </div>
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
            <div className="px-3 pb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.16em]">
              {normalizedRole} Account
            </div>
            {navItems.map((item, idx) => {
              const isActive = location.pathname === item.path || (location.pathname === '/' && idx === 0);
              return (
                <Link
                  key={idx}
                  to={item.path !== '#' ? item.path : '#'}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/12 text-primary border border-primary/20 shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-border/70 p-4">
            <div className="rounded-xl bg-muted/45 border border-border/70 p-3">
              <p className="text-xs font-medium text-foreground">Security status</p>
              <p className="text-xs text-muted-foreground mt-1">Session monitored and encrypted</p>
            </div>
          </div>
        </aside>

        {/* Main Content Wrapper */}
        <div className="flex min-h-screen flex-col sm:pl-72 w-full">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/70 bg-background/82 backdrop-blur px-4 shadow-sm sm:px-6 lg:px-8">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="sm:hidden rounded-xl">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:max-w-xs border-border/80 bg-card/95 backdrop-blur-xl">
                <nav className="grid gap-6 text-base font-medium">
                  <Link to="/" className="flex items-center gap-3 text-lg font-semibold">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden">
                      <img
                        src="/SACVS_Logo.png"
                        alt="SACVS logo"
                        className="h-full w-full object-contain"
                        loading="eager"
                      />
                    </div>
                    <span className="font-heading">SACVS</span>
                  </Link>
                  {navItems.map((item, idx) => (
                    <Link
                      key={idx}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl px-3 py-2 transition-colors",
                        location.pathname === item.path
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            
            <div className="flex-1">
              <p className="text-sm text-muted-foreground font-medium">{currentPageName}</p>
            </div>

            <div className="flex items-center gap-4">
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>
          
          <main className="flex-1">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-enter-up">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
