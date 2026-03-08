import { useAuth } from '@/contexts/AuthContext';
import { Copy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const GlobalHeader = () => {
  const { profile, role, signOut } = useAuth();

  const copyCode = () => {
    if (profile?.doctor_code) {
      navigator.clipboard.writeText(profile.doctor_code);
      toast.success('Код скопирован');
    }
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
        <Button variant="ghost" size="icon" onClick={() => { console.log('LOGOUT'); signOut(); }} className="h-8 w-8 rounded-xl hover:bg-card/60">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};

export default GlobalHeader;
