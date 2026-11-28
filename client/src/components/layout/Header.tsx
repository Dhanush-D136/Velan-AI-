import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Bell, Search, Command, LogOut, ShieldCheck, Menu } from 'lucide-react';
import { UserRole } from '@velan/shared';

export interface HeaderProps {
  onOpenCommandPalette?: () => void;
  onOpenNotifications?: () => void;
  onOpenMobileMenu?: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onOpenNotifications,
  onOpenMobileMenu,
  unreadNotificationsCount = 2,
}) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const getRoleBadgeVariant = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'admin';
      case UserRole.FACULTY:
        return 'faculty';
      case UserRole.STUDENT:
        return 'student';
      default:
        return 'brand';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-white/80 backdrop-blur-md border-b border-border/80 transition-all">
      {/* Mobile Menu + Search / Command Palette Trigger */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2.5 text-content bg-surface-muted hover:bg-slate-200/70 border border-border rounded-2xl transition-all"
          title="All Menu Options"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm text-content-secondary bg-surface-muted hover:bg-slate-200/70 border border-border rounded-2xl transition-all w-40 sm:w-72"
        >
          <Search className="w-4 h-4 text-content-muted" />
          <span className="flex-1 text-left truncate">Quick search & actions...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono bg-white rounded-lg border border-border text-content-muted">
            <Command className="w-3 h-3" /> K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Notifications & User Card */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Device Lock status indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-accent-emerald text-xs font-medium border border-emerald-200/60">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Device Secured</span>
        </div>

        {/* Notifications */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2.5 text-content-secondary hover:text-content hover:bg-surface-muted rounded-2xl transition-colors border border-transparent hover:border-border"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-rose  ring-2 ring-white" />
          )}
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2 sm:border-l border-border">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            title="Profile & Settings"
            className="flex items-center gap-3 rounded-2xl px-1.5 py-1 hover:bg-surface-muted transition-colors text-left"
          >
            <Avatar
              name={user?.name || 'User'}
              src={user?.avatarUrl}
              size="sm"
              className="ring-2 ring-brand-500/20"
            />
            <div className="hidden sm:flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-content leading-tight">
                  {user?.name || 'Velan User'}
                </span>
                <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
                  {user?.role || 'GUEST'}
                </Badge>
              </div>
              <span className="text-[11px] text-content-secondary font-mono leading-tight">
                {user?.email}
              </span>
            </div>
          </button>

          <button
            onClick={() => logout()}
            className="p-2 text-content-muted hover:text-accent-rose hover:bg-rose-50 rounded-2xl transition-colors ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
