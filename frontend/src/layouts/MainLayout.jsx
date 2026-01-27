import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
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
  Settings,
  User,
  LayoutDashboard,
  FileCheck,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserButton, useUser, useClerk } from '@clerk/clerk-react';

const roleNavItems = {
  student: [
    { label: 'Dashboard', icon: LayoutDashboard, page: 'StudentDashboard', path: '/student-dashboard' },
    { label: 'My Credentials', icon: GraduationCap, page: 'StudentCredentials', path: '#' },
    { label: 'Settings', icon: Settings, page: 'Settings', path: '#' },
  ],
  institution: [
    { label: 'Dashboard', icon: LayoutDashboard, page: 'InstitutionDashboard', path: '/institution-dashboard' },
    { label: 'Issue Credentials', icon: FileCheck, page: 'IssueCredentials', path: '#' },
    { label: 'Students', icon: User, page: 'Students', path: '#' },
    { label: 'Settings', icon: Settings, page: 'Settings', path: '#' },
  ],
  employer: [
    { label: 'Dashboard', icon: LayoutDashboard, page: 'EmployerDashboard', path: '/employer-dashboard' },
    { label: 'Verify Credentials', icon: Search, page: 'EmployerDashboard', path: '#' },
    { label: 'History', icon: Activity, page: 'History', path: '#' },
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
  const { signOut } = useClerk();

  const userRole = user?.publicMetadata?.role || localStorage.getItem('demo_user_role') || 'student';
  
  const navItems = roleNavItems[userRole.toLowerCase()] || roleNavItems['student'];

  if (currentPageName === 'Home') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg">SACVS</span>
          </Link>
        </div>
        <nav className="flex flex-col gap-2 px-4 py-6">
          <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {userRole} Account
          </div>
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path || (location.pathname === '/' && idx === 0);
            return (
              <Link
                key={idx}
                to={item.path !== '#' ? item.path : '#'}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto border-t p-4">
           {/* Sidebar Footer if needed */}
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex flex-col sm:pl-64 w-full">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-6 shadow-sm sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
             <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="sm:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:max-w-xs">
                <nav className="grid gap-6 text-lg font-medium">
                  {/* Mobile Nav Items */}
                  <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
                    <Shield className="h-6 w-6 text-primary" />
                    <span>SACVS</span>
                  </Link>
                  {navItems.map((item, idx) => (
                    <Link
                      key={idx}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
          </Sheet>
          
          <div className="flex-1">
             {/* Optional Breadcrumb or Page Title could go here */}
          </div>

          <div className="flex items-center gap-4">
             <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
