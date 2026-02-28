import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKS } from '@/lib/questions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays, format, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { EntrySummary } from '@/types';

const PatientDetailDoctor = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [patientName, setPatientName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState<EntrySummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hasData, setHasData] = useState(true);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Load patient profile
  useEffect(() => {
    if (!patientId) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', patientId)
      .single()
      .then(({ data }) => setPatientName(data?.full_name || 'Пациент'));
  }, [patientId]);

  // Load summary for selected date
  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      const { data: entry } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', patientId)
        .eq('entry_date', dateStr)
        .single();

      if (entry) {
        const { data } = await supabase
          .from('entry_summaries')
          .select('*')
          .eq('entry_id', entry.id)
          .single();
        setSummary(data as EntrySummary | null);
      } else {
        setSummary(null);
      }
    };
    load();
  }, [patientId, dateStr]);

  // Check if patient has any data
  useEffect(() => {
    if (!patientId) return;
    supabase
      .from('entries')
      .select('id')
      .eq('user_id', patientId)
      .limit(1)
      .then(({ data }) => setHasData(!!data?.length));
  }, [patientId]);

  const getBlockSum = (blockId: number): number | null => {
    if (!summary) return null;
    const key = `block${blockId}_sum` as keyof EntrySummary;
    return summary[key] as number;
  };

  const handleExport = useCallback(async () => {
    if (!patientId) return;
    setExporting(true);
    try {
      // Get all entries for this patient
      const { data: entries } = await supabase
        .from('entries')
        .select('id, entry_date')
        .eq('user_id', patientId)
        .order('entry_date', { ascending: true });

      if (!entries?.length) {
        toast.error('Нет сохранённых записей для экспорта.');
        setExporting(false);
        return;
      }

      const entryIds = entries.map((e) => e.id);

      // Get all mania answers
      const { data: answers } = await supabase
        .from('mania_answers')
        .select('entry_id, block_id, question_id, score')
        .in('entry_id', entryIds);

      // Build map: block_id -> question_id -> { entry_id -> score }
      const dataMap: Record<number, Record<number, Record<string, number>>> = {};
      answers?.forEach((a) => {
        if (!dataMap[a.block_id]) dataMap[a.block_id] = {};
        if (!dataMap[a.block_id][a.question_id]) dataMap[a.block_id][a.question_id] = {};
        dataMap[a.block_id][a.question_id][a.entry_id] = a.score;
      });

      // Map entry_id -> date string
      const entryDateMap = new Map(entries.map((e) => [e.id, e.entry_date]));

      // Get sorted unique dates
      const sortedDates = entries.map((e) => e.entry_date);

      const wb = XLSX.utils.book_new();

      for (const block of BLOCKS) {
        const blockData = dataMap[block.id] || {};

        // Filter dates that have any data for this block
        const datesWithData = sortedDates.filter((date) => {
          const eid = entries.find((e) => e.entry_date === date)?.id;
          if (!eid) return false;
          return block.questions.some((_, qIdx) => blockData[qIdx]?.[eid] !== undefined);
        });

        if (datesWithData.length === 0) {
          // Empty sheet with just question labels
          const sheetData = [['Критерий']];
          block.questions.forEach((q) => sheetData.push([q]));
          const ws = XLSX.utils.aoa_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, ws, `Блок ${block.id}`);
          continue;
        }

        // Header row
        const header = ['Критерий', ...datesWithData];

        // Data rows
        const rows = block.questions.map((q, qIdx) => {
          const row: (string | number)[] = [q];
          datesWithData.forEach((date) => {
            const eid = entries.find((e) => e.entry_date === date)?.id;
            const score = eid ? blockData[qIdx]?.[eid] : undefined;
            row.push(score !== undefined ? score : '');
          });
          return row;
        });

        const sheetData = [header, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto-width for first column
        ws['!cols'] = [{ wch: 60 }, ...datesWithData.map(() => ({ wch: 12 }))];

        XLSX.utils.book_append_sheet(wb, ws, `Блок ${block.id}`);
      }

      const safeName = patientName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
      XLSX.writeFile(wb, `PatientData_${safeName}_ALL.xlsx`);
      toast.success('Файл скачан');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  }, [patientId, patientName]);

  return (
    <div className="p-4 pb-20 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-medium">{patientName}</h1>
      </div>

      {/* Date selector */}
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setSelectedDate(new Date())}>
          Сегодня
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-sm font-medium">
              {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Просмотр: {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
      </p>

      {/* Blocks grid (read-only) */}
      <div className="grid grid-cols-2 gap-3">
        {BLOCKS.map((block) => {
          const sum = getBlockSum(block.id);
          const isRisk = sum !== null && sum > 4;
          const isFullWidth = block.id === 7;
          return (
            <Card
              key={block.id}
              className={cn(
                'transition-shadow',
                isFullWidth && 'col-span-2'
              )}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Блок {block.id}</p>
                  <p className="text-xs text-muted-foreground truncate">{block.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {sum !== null && (
                    <span className={cn('text-sm font-medium', isRisk ? 'text-alert-red' : 'text-alert-green')}>
                      {sum}
                    </span>
                  )}
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full',
                      sum === null ? 'bg-muted' : isRisk ? 'bg-alert-red' : 'bg-alert-green'
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Export button */}
      <Button
        className="w-full gap-2"
        onClick={handleExport}
        disabled={exporting || !hasData}
      >
        <Download className="h-4 w-4" />
        {exporting ? 'Экспорт…' : 'Скачать данные'}
      </Button>

      {!hasData && (
        <p className="text-xs text-muted-foreground text-center">
          Нет сохранённых записей для экспорта.
        </p>
      )}
    </div>
  );
};

export default PatientDetailDoctor;
