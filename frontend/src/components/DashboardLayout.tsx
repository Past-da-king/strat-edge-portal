import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  FolderOpen, 
  Folder, 
  Coins, 
  Activity, 
  Plus, 
  Bolt,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, to, isCollapsed }: { icon: any, label: string, to: string, isCollapsed: boolean }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `
      flex items-center gap-3 px-6 py-4 cursor-pointer transition-all border-r-2 group
      ${isActive 
        ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' 
        : 'hover:bg-accent-primary/5 border-transparent text-slate-500 dark:text-slate-400 hover:text-accent-primary'
      }
      ${isCollapsed ? 'justify-center px-0' : ''}
    `}
    title={isCollapsed ? label : ''}
  >
    <Icon className="w-5 h-5 shrink-0" />
    {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
  </NavLink>
);

const MobileNavItem = ({ icon: Icon, label, to }: { icon: any, label: string, to: string }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `
      flex flex-col items-center justify-center gap-1 flex-1 py-3 transition-all
      ${isActive ? 'text-accent-primary scale-110' : 'text-slate-400 dark:text-slate-600'}
    `}
  >
    <Icon className="w-5 h-5" />
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </NavLink>
);

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const userStr = localStorage.getItem('user');
  const user = JSON.parse(userStr || '{}');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", to: "/", mobile: true },
    { icon: FolderOpen, label: "Projects", to: "/projects", mobile: true },
    { icon: Bolt, label: "Activity", to: "/activity", mobile: true },
    { icon: Coins, label: "Spend", to: "/expenditure", mobile: true },
    { icon: Plus, label: "Setup", to: "/setup", roles: ['admin', 'pm'] },
    { icon: AlertTriangle, label: "Risks", to: "/risks" },
    { icon: Folder, label: "Repository", to: "/repository" },
    { icon: Activity, label: "Monitoring", to: "/monitoring", roles: ['admin', 'executive'] },
    { icon: ShieldCheck, label: "Settings", to: "/settings", roles: ['admin'] },
    { icon: Settings, label: "Admin", to: "/admin", roles: ['admin'] },
  ];

  const primaryNav = navItems.filter(item => item.mobile);
  const secondaryNav = navItems.filter(item => !item.mobile && (!item.roles || item.roles.includes(user.role)));

  return (
    <div className="flex h-screen bg-background text-slate-900 dark:text-slate-300 font-sans transition-colors duration-300 overflow-hidden">
      
      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex transition-all duration-300 ease-in-out flex-col bg-sidebar border-r border-slate-200 dark:border-slate-800 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between transition-all ${isCollapsed ? 'flex-col gap-4' : 'gap-3'}`}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Strat Edge Logo" className={`transition-all duration-300 ${isCollapsed ? 'w-8 h-8' : 'w-8 h-8'}`} />
            {!isCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">
                  STRAT EDGE
                </h1>
                <p className="text-[9px] uppercase tracking-[0.2em] text-accent-secondary font-black">Project Portal</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 hover:bg-accent-primary/5 rounded-lg transition-colors text-slate-500 hover:text-accent-primary`}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems
            .filter(item => !item.roles || item.roles.includes(user.role))
            .map(item => (
              <SidebarItem 
                key={item.to} 
                icon={item.icon} 
                label={item.label} 
                to={item.to} 
                isCollapsed={isCollapsed} 
              />
            ))
          }
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button 
            onClick={() => setIsDark(!isDark)}
            className={`w-full flex items-center transition-all duration-300 text-slate-500 hover:text-accent-primary hover:bg-accent-primary/10 rounded-xl group py-4 ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-6'}`}
          >
            {isDark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            {!isCollapsed && <span className="text-sm font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center transition-all duration-300 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl group py-4 ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-6'}`}
          >
            <LogOut className="w-5 h-5 group-hover:text-red-500 shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar dark:bg-[#0f1115] border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 z-[50] shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-7 h-7" />
          <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tighter uppercase">Strat Edge</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDark(!isDark)} className="p-2 text-slate-500 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 transition-all">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer (Overlay) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-background animate-in slide-in-from-right duration-300 p-8 pt-24">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Navigation Network</p>
            {navItems
              .filter(item => !item.roles || item.roles.includes(user.role))
              .map(item => (
                <NavLink 
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `
                    flex items-center gap-4 p-5 rounded-2xl border transition-all
                    ${isActive 
                      ? 'bg-accent-primary/10 border-accent-primary text-accent-primary shadow-lg shadow-accent-primary/5' 
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-bold uppercase tracking-tight text-sm">{item.label}</span>
                </NavLink>
              ))
            }
            <button 
              onClick={handleLogout}
              className="flex items-center gap-4 p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-500 mt-8"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-bold uppercase tracking-tight text-sm">Terminate Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-background pt-16 lg:pt-0 pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Bar (Primary Quick Access) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-sidebar dark:bg-[#0f1115] border-t border-slate-200 dark:border-white/5 flex items-center px-4 z-[50] shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        {primaryNav.map(item => (
          <MobileNavItem key={item.to} icon={item.icon} label={item.label} to={item.to} />
        ))}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-3 text-slate-400 dark:text-slate-600"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-tighter">More</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardLayout;
