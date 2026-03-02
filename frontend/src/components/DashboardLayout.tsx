import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  Menu
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, to, isCollapsed }: { icon: any, label: string, to: string, isCollapsed: boolean }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `
      flex items-center gap-3 px-6 py-4 cursor-pointer transition-all border-r-2 group
      ${isActive 
        ? 'bg-accent-primary/5 border-accent-primary text-white' 
        : 'hover:bg-white/5 border-transparent text-slate-400 hover:text-slate-200'
      }
      ${isCollapsed ? 'justify-center px-0' : ''}
    `}
    title={isCollapsed ? label : ''}
  >
    <Icon className="w-5 h-5 shrink-0" />
    {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
  </NavLink>
);

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const userStr = localStorage.getItem('user');
  const user = JSON.parse(userStr || '{}');

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", to: "/" },
    { icon: FolderOpen, label: "Projects", to: "/projects" },
    { icon: Plus, label: "Project Setup", to: "/setup", roles: ['admin', 'pm'] },
    { icon: Bolt, label: "Record Activity", to: "/activity" },
    { icon: Coins, label: "Expenditure", to: "/expenditure" },
    { icon: AlertTriangle, label: "Risks", to: "/risks" },
    { icon: Folder, label: "Repository", to: "/repository" },
    { icon: Activity, label: "System Monitoring", to: "/monitoring", roles: ['admin', 'executive'] },
    { icon: ShieldCheck, label: "System Settings", to: "/settings", roles: ['admin'] },
    { icon: Settings, label: "Admin Panel", to: "/admin", roles: ['admin'] },
  ];

  return (
    <div className="flex h-screen bg-background text-slate-300 font-sans">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ease-in-out flex flex-col bg-sidebar border-r border-slate-800 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`p-6 border-b border-slate-800 flex items-center justify-between transition-all ${isCollapsed ? 'flex-col gap-4' : 'gap-3'}`}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Strat Edge Logo" className={`transition-all duration-300 ${isCollapsed ? 'w-8 h-8' : 'w-8 h-8'}`} />
            {!isCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-white leading-tight uppercase tracking-tighter">
                  STRAT EDGE
                </h1>
                <p className="text-[9px] uppercase tracking-[0.2em] text-accent-secondary font-black">Project Portal</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-white`}
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

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center transition-all duration-300 text-slate-400 hover:text-white hover:bg-red-500/10 rounded-xl group py-4 ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-6'}`}
            title={isCollapsed ? "Sign Out" : ""}
          >
            <LogOut className="w-5 h-5 group-hover:text-red-400 shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#0a0a0c]">
        <div className="max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
