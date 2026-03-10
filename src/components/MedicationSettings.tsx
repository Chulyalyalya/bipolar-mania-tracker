import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Med {
  id: string;
  period: string;
  medication_name: string;
  dosage: string | null;
}

const MedicationSettings = () => {
  const { user } = useAuth();
  const [meds, setMeds] = useState<Med[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetPeriod, setSheetPeriod] = useState<'morning' | 'evening'>('morning');
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingMed, setDeletingMed] = useState<Med | null>(null);

  const fetchMeds = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase
      .from('medications' as any)
      .select('id, period, medication_name, dosage')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as any);
    setMeds((data as Med[]) ?? []);
  }, [user]);

  useEffect(() => { fetchMeds(); }, [fetchMeds]);

  const openAdd = (period: 'morning' | 'evening') => {
    setSheetPeriod(period);
    setMedName('');
    setMedDosage('');
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!user || !medName.trim()) return;
    setSaving(true);
    const { error } = await (supabase
      .from('medications' as any)
      .insert({
        user_id: user.id,
        period: sheetPeriod,
        medication_name: medName.trim(),
        dosage: medDosage.trim() || null,
      } as any) as any);

    if (error) {
      console.error('MED_SAVE_ERROR', error);
      toast.error('Ошибка сохранения');
    } else {
      toast.success('Лекарство добавлено');
      setSheetOpen(false);
      await fetchMeds();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingMed) return;
    const { error } = await (supabase
      .from('medications' as any)
      .delete()
      .eq('id', deletingMed.id) as any);

    if (error) {
      console.error('MED_DELETE_ERROR', error);
      toast.error('Ошибка удаления');
    } else {
      setMeds((prev) => prev.filter((m) => m.id !== deletingMed.id));
      toast.success('Лекарство удалено');
    }
    setDeletingMed(null);
  };

  const morningMeds = meds.filter((m) => m.period === 'morning');
  const eveningMeds = meds.filter((m) => m.period === 'evening');

  const renderList = (items: Med[], period: 'morning' | 'evening') => (
    <div className="space-y-2">
      {items.length > 0 ? (
        items.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-sm">
            <p className="truncate">
              {m.medication_name}
              {m.dosage && <span className="text-muted-foreground ml-1">· {m.dosage}</span>}
            </p>
            <button
              type="button"
              onClick={() => setDeletingMed(m)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0"
            >
              Удалить
            </button>
          </div>
        ))
      ) : (
        <p className="text-[11px] text-muted-foreground">Нет добавленных препаратов</p>
      )}
      <button
        type="button"
        onClick={() => openAdd(period)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {items.length > 0 ? 'Добавить еще одно лекарство' : 'Добавить лекарство'}
      </button>
    </div>
  );

  return (
    <>
      <div className="glass-card p-5 space-y-4">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Фармакология</p>

        <div className="space-y-1">
          <p className="text-sm font-medium">Утро</p>
          {renderList(morningMeds, 'morning')}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Вечер</p>
          {renderList(eveningMeds, 'evening')}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border/20">
          <SheetHeader>
            <SheetTitle>Добавить лекарство</SheetTitle>
            <SheetDescription>
              {sheetPeriod === 'morning' ? 'Утренний приём' : 'Вечерний приём'}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Название лекарства"
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              className="rounded-2xl border-border/30 bg-card/40"
            />
            <Input
              placeholder="Дозировка"
              value={medDosage}
              onChange={(e) => setMedDosage(e.target.value)}
              className="rounded-2xl border-border/30 bg-card/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !medName.trim()}
                className="flex-1 rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex-1 rounded-2xl border border-border/30 bg-card/40 px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-card/60"
              >
                Отмена
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deletingMed} onOpenChange={(open) => !open && setDeletingMed(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить лекарство?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingMed?.medication_name} будет удалено из списка.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MedicationSettings;
