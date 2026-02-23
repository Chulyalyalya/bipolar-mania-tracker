import { NavLink } from 'react-router-dom';
import { Home, Activity, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', icon: Home, label: 'Главная' },
  { to: '/ipsrt', icon: Activity, label: 'IPSRT' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

const BottomNav = () => (
  <nav className="fixed bottom-0 left-0 right-0 flex border-t border-border bg-card z-50">
    {links.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )
        }
      >
        <Icon className="h-5 w-5" />
        {label}
      </NavLink>
    ))}
  </nav>
);

export default BottomNav;
