import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
// import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Shield,
  GraduationCap,
  Building2,
  Briefcase,
  Activity,
  LogOut,
  Home,
  Lock,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const roleNavItems = {
  student: [
    { label: 'Dashboard', icon: Home, page: 'StudentDashboard' },
    { label: 'My Credentials', icon: Shield, page: 'StudentCredentials' }, // unique key
  ],
  institution: [
    { label: 'Dashboard', icon: Home, page: 'InstitutionDashboard' },
    { label: 'Issue Credentials', icon: Shield, page: 'InstitutionDashboard' },
  ],
  employer: [
    { label: 'Dashboard', icon: Home, page: 'EmployerDashboard' },
    { label: 'Verify Credentials', icon: Shield, page: 'EmployerDashboard' },
  ],
  admin: [
    { label: 'Dashboard', icon: Home, page: 'AdminDashboard' },
    { label: 'Security', icon: Shield, page: 'AdminDashboard' },
    { label: 'Audit Logs', icon: Activity, page: 'AdminDashboard' },
  ],
};

const roleIcons = {
  student: GraduationCap,
  institution: Building2,
  employer: Briefcase,
  admin: Shield,
};

const roleColors = {
  student: 'from-blue-500 to-indigo-600',
  institution: 'from-indigo-500 to-violet-600',
  employer: 'from-cyan-500 to-blue-600',
  admin: 'from-violet-500 to-fuchsia-600',
};


export default function MainLayout({ children, currentPageName }) {
  // All hooks must be called unconditionally at the top
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState(() => localStorage.getItem('demo_user_role') || 'student');
  useEffect(() => {
    const onStorage = () => setUserRole(localStorage.getItem('demo_user_role') || 'student');
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    setUserRole(localStorage.getItem('demo_user_role') || 'student');
  }, [currentPageName]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);
  const user = { full_name: 'Demo User', email: 'demo@secvault.local', user_role: userRole };
  const RoleIcon = roleIcons[userRole] || GraduationCap;
  const navItems = roleNavItems[userRole] || [];

  if (currentPageName === 'Home') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-r bg-background">
                <div className="p-6 border-b border-border">
                  <Link to={createPageUrl('Home')} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="font-bold text-foreground">SACVS</span>
                      <p className="text-xs text-muted-foreground">Credential System</p>
                    </div>
                  </Link>
                </div>
                {/* Navigation removed to avoid cross-dashboard access */}
              </SheetContent>
            </Sheet>

            <Link to={createPageUrl('Home')} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-foreground">NAME</span>
                <p className="text-xs text-muted-foreground">Secure Academic Credential Verification</p>
              </div>
            </Link>
          </div>

          {/* Navigation removed to avoid cross-dashboard access */}

          <div className="flex items-center gap-3">
            {/* ...existing code... */}

            {/* Always show user dropdown for demo */}
            {true ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-muted/50">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center ring-2 ring-background',
                        roleColors[userRole]
                      )}
                    >
                      <RoleIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-foreground">{user.full_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center ring-2 ring-background',
                          roleColors[userRole]
                        )}
                      >
                        <RoleIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.full_name || 'User'}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="focus:bg-muted focus:text-foreground">
                    <Link to={createPageUrl('Home')} className="flex items-center gap-2 cursor-pointer">
                      <Home className="w-4 h-4" />
                      Switch Role
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-8rem)]">{children}</main>

      <footer className="border-t border-border/40 bg-background/95 py-6 mt-auto">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          {/* ...existing code... */}
        </div>
      </footer>
    </div>
  );
}
