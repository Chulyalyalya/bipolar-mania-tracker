import { NavLink } from 'react-router-dom';
import { Home, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const BottomNav = () => {
  const { role } = useAuth();
  const homePath = role === 'doctor' ? '/doctor' : '/dashboard';

  const links = [
    { to: homePath, icon: Home, label: 'Главная' },
    { to: '/settings', icon: Settings, label: 'Настройки' },
  ];

  return (
    <nav className="glass-surface fixed bottom-0 left-0 right-0 flex border-t border-border/20 z-50">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === homePath}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-all',
              isActive
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
