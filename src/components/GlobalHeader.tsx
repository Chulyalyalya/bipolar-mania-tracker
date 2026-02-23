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
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <span className="text-sm font-medium text-foreground">
        {profile?.full_name || 'Пользователь'}
      </span>
      <div className="flex items-center gap-2">
        {role === 'doctor' && profile?.doctor_code && (
          <button
            onClick={copyCode}
            className="flex items-center gap-1 text-xs font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            {profile.doctor_code}
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};

export default GlobalHeader;
