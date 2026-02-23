import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Settings = () => {
  const { profile, role, signOut } = useAuth();

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-lg font-medium">Настройки</h1>
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-sm">Профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Имя:</span> {profile?.full_name || '—'}</p>
          <p><span className="text-muted-foreground">Роль:</span> {role === 'doctor' ? 'Врач' : 'Пациент'}</p>
          {role === 'doctor' && profile?.doctor_code && (
            <p><span className="text-muted-foreground">Код:</span> <span className="font-mono">{profile.doctor_code}</span></p>
          )}
        </CardContent>
      </Card>
      <Button variant="outline" className="w-full" onClick={signOut}>
        Выйти
      </Button>
    </div>
  );
};

export default Settings;
