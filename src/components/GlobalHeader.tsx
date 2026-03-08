import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Copy, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const GlobalHeader = () => {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const copyCode = () => {
    if (profile?.doctor_code) {
      navigator.clipboard.writeText(profile.doctor_code);
      toast.success('Код скопирован');
    }
  };

  const handleLogout = async () => {
    console.log('LOGOUT');
    console.log('LOGOUT_CLICK');
    alert('LOGOUT_CLICK');
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <header className="glass-surface sticky top-0 z-40 flex items-center justify-between px-5 py-3.5 border-b border-border/30">
      <span className="text-sm font-semibold text-foreground tracking-tight">
        {profile?.full_name || 'Пользователь'}
      </span>
      <div className="flex items-center gap-2">
        {role === 'doctor' && profile?.doctor_code && (
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-xl border border-border/30 bg-card/40 px-2.5 py-1 text-[11px] font-mono tracking-wider text-muted-foreground hover:text-foreground hover:bg-card/60 transition-all"
          >
            {profile.doctor_code}
            <Copy className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="h-8 w-8 rounded-xl hover:bg-card/60 inline-flex items-center justify-center"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

export default GlobalHeader;
