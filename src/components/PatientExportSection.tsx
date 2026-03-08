import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKS } from '@/lib/questions';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

type RangeKey = '7' | '30' | '90' | 'all' | 'custom';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7', label: '7 дней' },
  { key: '30', label: '30 дней' },
  { key: '90', label: '90 дней' },
  { key: 'all', label: 'Всё' },
  { key: 'custom', label: 'Custom' },
];

const PatientExportSection = () => {
  const { user, profile } = useAuth();
  const [range, setRange] = useState<RangeKey>('7');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [exporting, setExporting] = useState(false);
  const [noData, setNoData] = useState(false);

  const today = new Date();

  const customValid = useMemo(() => {
    if (range !== 'custom') return true;
    if (!customFrom || !customTo) return false;
    return customFrom <= customTo;
  }, [range, customFrom, customTo]);

  const customError = useMemo(() => {
    if (range !== 'custom') return '';
    if (!customFrom || !customTo) return 'Выберите обе даты';
    if (customFrom > customTo) return '«Дата с» должна быть раньше «Дата по»';
    return '';
  }, [range, customFrom, customTo]);

  const handleExport = async () => {
    if (!user) return;
    console.log('EXPORT_START', { range, customFrom, customTo });
    setExporting(true);
    setNoData(false);

    try {
      let fromDate: string | undefined;
      let toDate: string = format(today, 'yyyy-MM-dd');
      let isAll = false;

      if (range === 'all') {
        isAll = true;
      } else if (range === 'custom') {
        fromDate = format(customFrom!, 'yyyy-MM-dd');
        toDate = format(customTo!, 'yyyy-MM-dd');
      } else {
        fromDate = format(subDays(today, Number(range)), 'yyyy-MM-dd');
      }

      let query = supabase
        .from('entries')
        .select('id, entry_date, daily_note')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (!isAll && fromDate) {
        query = query.gte('entry_date', fromDate).lte('entry_date', toDate);
      }

      const { data: entries } = await query;

      if (!entries?.length) {
        setNoData(true);
        setExporting(false);
        return;
      }

      const entryIds = entries.map((e) => e.id);

      let allAnswers: { entry_id: string; block_id: number; question_id: number; score: number }[] = [];
      for (let i = 0; i < entryIds.length; i += 500) {
        const batch = entryIds.slice(i, i + 500);
        const { data } = await supabase
          .from('mania_answers')
          .select('entry_id, block_id, question_id, score')
          .in('entry_id', batch);
        if (data) allAnswers = allAnswers.concat(data);
      }

      const dataMap: Record<number, Record<number, Record<string, number>>> = {};
      allAnswers.forEach((a) => {
        if (!dataMap[a.block_id]) dataMap[a.block_id] = {};
        if (!dataMap[a.block_id][a.question_id]) dataMap[a.block_id][a.question_id] = {};
        dataMap[a.block_id][a.question_id][a.entry_id] = a.score;
      });

      const wb = XLSX.utils.book_new();

      for (const block of BLOCKS) {
        const blockData = dataMap[block.id] || {};

        const datesWithData = entries.filter((e) => {
          return block.questions.some((_, qIdx) => blockData[qIdx]?.[e.id] !== undefined);
        });

        const header = ['Критерий', ...datesWithData.map((e) => e.entry_date)];
        const rows = block.questions.map((q, qIdx) => {
          const row: (string | number)[] = [q];
          datesWithData.forEach((e) => {
            const score = blockData[qIdx]?.[e.id];
            row.push(score !== undefined ? score : '');
          });
          return row;
        });

        const sumRow: (string | number)[] = ['Сумма блока'];
        datesWithData.forEach((e) => {
          let total = 0;
          block.questions.forEach((_, qIdx) => {
            total += blockData[qIdx]?.[e.id] ?? 0;
          });
          sumRow.push(total);
        });

        const sheetData = [header, ...rows, sumRow];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 60 }, ...datesWithData.map(() => ({ wch: 12 }))];
        XLSX.utils.book_append_sheet(wb, ws, `Блок ${block.id}`);
      }

      const notesRows: string[][] = [['Дата', 'Заметка']];
      entries.forEach((e) => {
        const note = (e as any).daily_note;
        if (note && note.trim()) {
          notesRows.push([e.entry_date, note]);
        }
      });
      if (notesRows.length > 1) {
        const notesWs = XLSX.utils.aoa_to_sheet(notesRows);
        notesWs['!cols'] = [{ wch: 12 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, notesWs, 'Заметки');
      }

      const safeName = (profile?.full_name || 'Patient').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
      const fileName = isAll
        ? `PatientData_${safeName}_ALL.xlsx`
        : `PatientData_${safeName}_${fromDate}_${toDate}.xlsx`;

      XLSX.writeFile(wb, fileName);
      console.log('EXPORT_SUCCESS', fileName);
      toast.success('Файл скачан');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        Экспорт данных
      </p>

      {/* Range selector */}
      <div className="flex flex-wrap gap-1.5">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.key}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
              range === r.key
                ? 'bg-foreground text-background'
                : 'bg-card/40 text-muted-foreground hover:bg-card/60 border border-border/30'
            )}
            onClick={() => {
              setRange(r.key);
              setNoData(false);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Custom date pickers */}
      {range === 'custom' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'flex-1 rounded-xl border border-border/30 bg-card/40 px-3 py-2 text-xs font-medium transition-all hover:bg-card/60',
                    !customFrom && 'text-muted-foreground'
                  )}
                >
                  {customFrom ? format(customFrom, 'd MMM yyyy', { locale: ru }) : 'Дата с'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-border/30" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={(d) => {
                    setCustomFrom(d);
                    setNoData(false);
                  }}
                  disabled={(d) => d > today}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'flex-1 rounded-xl border border-border/30 bg-card/40 px-3 py-2 text-xs font-medium transition-all hover:bg-card/60',
                    !customTo && 'text-muted-foreground'
                  )}
                >
                  {customTo ? format(customTo, 'd MMM yyyy', { locale: ru }) : 'Дата по'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-border/30" align="end">
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={(d) => {
                    setCustomTo(d);
                    setNoData(false);
                  }}
                  disabled={(d) => d > today}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          {customError && (
            <p className="text-[11px] text-destructive">{customError}</p>
          )}
        </div>
      )}

      {/* No data message */}
      {noData && (
        <p className="text-xs text-muted-foreground text-center py-1">
          Нет сохранённых записей для выбранного периода.
        </p>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting || !customValid || noData}
        className="group flex w-full items-center justify-center rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {exporting ? 'Экспорт…' : 'Скачать данные Excel'}
      </button>
    </div>
  );
};

export default PatientExportSection;
