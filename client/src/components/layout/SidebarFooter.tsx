import React from 'react';

interface SidebarFooterProps {
  collapsed?: boolean;
  withSafeArea?: boolean;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  collapsed = false,
  withSafeArea = false,
}) => {
  const currentYear = new Date().getFullYear();
  const text = `© ${currentYear} Velan AI. All rights reserved.`;

  return (
    <footer
      title={collapsed ? text : undefined}
      className="border-t border-border p-4 text-center text-[12px] leading-[1.5] text-content-secondary dark:text-slate-400"
      style={
        withSafeArea
          ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }
          : undefined
      }
    >
      {collapsed ? '©' : text}
    </footer>
  );
};
