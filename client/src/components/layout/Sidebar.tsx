import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { clsx } from 'clsx';
import { getRoleNavItems } from './navConfig';
import { SidebarFooter } from './SidebarFooter';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role || UserRole.ADMIN;
  const navItems = getRoleNavItems(role);

  return (
    <aside className="hidden lg:flex flex-col w-72 h-[calc(100vh-2rem)] sticky top-4 my-4 ml-4 bg-white/90 backdrop-blur-xl border border-border rounded-3xl shadow-glass overflow-hidden z-20 shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border/80">
        <BrandLogo size="md" />
        <div>
          <h2 className="font-heading font-extrabold text-xl tracking-tight text-content flex items-center gap-1.5">
            Velan <span className="bg-clip-text text-transparent bg-brand-gradient">AI</span>
          </h2>
          <p className="text-[11px] font-medium text-content-secondary tracking-wide uppercase">
            {role} Portal
          </p>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length <= 2}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 select-none group',
                isActive
                  ? 'bg-brand-gradient text-white shadow-glass'
                  : 'text-content-secondary hover:text-content hover:bg-surface-soft'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'transition-colors',
                    isActive ? 'text-white' : 'text-content-muted group-hover:text-brand-500'
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      <SidebarFooter />
    </aside>
  );
};
