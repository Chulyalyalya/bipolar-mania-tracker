import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKS } from '@/lib/questions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

      // Fetch answers in batches if needed (Supabase 1000 limit)
      let allAnswers: { entry_id: string; block_id: number; question_id: number; score: number }[] = [];
      for (let i = 0; i < entryIds.length; i += 500) {
        const batch = entryIds.slice(i, i + 500);
        const { data } = await supabase
          .from('mania_answers')
          .select('entry_id, block_id, question_id, score')
          .in('entry_id', batch);
        if (data) allAnswers = allAnswers.concat(data);
      }

      // Build lookup: block -> question -> entryId -> score
      const dataMap: Record<number, Record<number, Record<string, number>>> = {};
      allAnswers.forEach((a) => {
        if (!dataMap[a.block_id]) dataMap[a.block_id] = {};
        if (!dataMap[a.block_id][a.question_id]) dataMap[a.block_id][a.question_id] = {};
        dataMap[a.block_id][a.question_id][a.entry_id] = a.score;
      });

      const wb = XLSX.utils.book_new();

      // Block sheets
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

      // Notes sheet
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

      // Filename
      const safeName = (profile?.full_name || 'Patient').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
      const fileName = isAll
        ? `PatientData_${safeName}_ALL.xlsx`
        : `PatientData_${safeName}_${fromDate}_${toDate}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success('Файл скачан');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Экспорт данных</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Range selector */}
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((r) => (
            <Button
              key={r.key}
              variant={range === r.key ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => {
                setRange(r.key);
                setNoData(false);
              }}
            >
              {r.label}
            </Button>
          ))}
        </div>

        {/* Custom date pickers */}
        {range === 'custom' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('text-xs flex-1', !customFrom && 'text-muted-foreground')}
                  >
                    {customFrom ? format(customFrom, 'd MMM yyyy', { locale: ru }) : 'Дата с'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('text-xs flex-1', !customTo && 'text-muted-foreground')}
                  >
                    {customTo ? format(customTo, 'd MMM yyyy', { locale: ru }) : 'Дата по'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
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
        <Button
          className="w-full"
          onClick={handleExport}
          disabled={exporting || !customValid || noData}
        >
          {exporting ? 'Экспорт…' : 'Скачать данные Excel'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PatientExportSection;
