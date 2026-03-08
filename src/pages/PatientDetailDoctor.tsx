import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKS } from '@/lib/questions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays, format, isFuture, isToday, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { downloadWorkbook } from '@/lib/xlsxDownload';
import type { EntrySummary } from '@/types';

const EXPORT_RANGES = [
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
  { label: '90 дней', days: 90 },
  { label: 'Всё', days: null },
];

const PatientDetailDoctor = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [patientName, setPatientName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState<EntrySummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hasData, setHasData] = useState(true);

  const [exportRangeIdx, setExportRangeIdx] = useState(3);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const today = new Date();
  const atToday = isToday(selectedDate) || isFuture(selectedDate);

  useEffect(() => {
    if (!patientId) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', patientId)
      .single()
      .then(({ data }) => setPatientName(data?.full_name || 'Пациент'));
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      const { data: entry } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', patientId)
        .eq('entry_date', dateStr)
        .maybeSingle();

      if (entry) {
        const { data } = await supabase
          .from('entry_summaries')
          .select('*')
          .eq('entry_id', entry.id)
          .maybeSingle();
        setSummary(data as EntrySummary | null);
      } else {
        setSummary(null);
      }
    };
    load();
  }, [patientId, dateStr]);

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

  const isCustomValid = useCustomRange ? !!(customFrom && customTo && customFrom <= customTo) : true;

  const handleExport = useCallback(async () => {
    if (!patientId) return;
    console.log('EXPORT_START', { patientId, exportRangeIdx, useCustomRange });
    setExporting(true);
    try {
      let fromDate: string | null = null;
      let toDate: string = format(new Date(), 'yyyy-MM-dd');
      let isAll = false;

      if (useCustomRange) {
        fromDate = format(customFrom!, 'yyyy-MM-dd');
        toDate = format(customTo!, 'yyyy-MM-dd');
      } else {
        const range = EXPORT_RANGES[exportRangeIdx];
        if (range.days === null) {
          isAll = true;
        } else {
          fromDate = format(subDays(new Date(), range.days), 'yyyy-MM-dd');
        }
      }

      let query = supabase
        .from('entries')
        .select('id, entry_date, daily_note')
        .eq('user_id', patientId)
        .order('entry_date', { ascending: true });

      if (fromDate) query = query.gte('entry_date', fromDate);
      if (!isAll) query = query.lte('entry_date', toDate);

      const { data: entries, error: entriesError } = await query;
      if (entriesError) throw entriesError;

      if (!entries?.length) {
        const noDataError = new Error('NO_DATA_FOR_EXPORT');
        console.error('EXPORT_ERROR', noDataError);
        toast.error('Нет сохранённых записей для выбранного периода.');
        return;
      }

      const entryIds = entries.map((e) => e.id);

      const { data: answers, error: answersError } = await supabase
        .from('mania_answers')
        .select('entry_id, block_id, question_id, score')
        .in('entry_id', entryIds);
      if (answersError) throw answersError;

      const { data: summaries, error: summariesError } = await supabase
        .from('entry_summaries')
        .select('entry_id, block1_sum, block2_sum, block3_sum, block4_sum, block5_sum, block6_sum, block7_sum')
        .in('entry_id', entryIds);
      if (summariesError) throw summariesError;

      const summaryMap = new Map<string, any>();
      summaries?.forEach((s) => summaryMap.set(s.entry_id, s));

      const dataMap: Record<number, Record<number, Record<string, number>>> = {};
      answers?.forEach((a) => {
        if (!dataMap[a.block_id]) dataMap[a.block_id] = {};
        if (!dataMap[a.block_id][a.question_id]) dataMap[a.block_id][a.question_id] = {};
        dataMap[a.block_id][a.question_id][a.entry_id] = a.score;
      });

      const wb = XLSX.utils.book_new();

      for (const block of BLOCKS) {
        const blockData = dataMap[block.id] || {};
        const sortedDates = entries.map((e) => e.entry_date);

        const datesWithData = sortedDates.filter((date) => {
          const eid = entries.find((e) => e.entry_date === date)?.id;
          if (!eid) return false;
          return block.questions.some((_, qIdx) => blockData[qIdx]?.[eid] !== undefined);
        });

        const header = ['Критерий', ...(datesWithData.length ? datesWithData : [])];

        const rows = block.questions.map((q, qIdx) => {
          const row: (string | number)[] = [q];
          datesWithData.forEach((date) => {
            const eid = entries.find((e) => e.entry_date === date)?.id;
            const score = eid ? blockData[qIdx]?.[eid] : undefined;
            row.push(score !== undefined ? score : '');
          });
          return row;
        });

        const sumRow: (string | number)[] = ['Сумма блока'];
        datesWithData.forEach((date) => {
          const eid = entries.find((e) => e.entry_date === date)?.id;
          if (eid) {
            const s = summaryMap.get(eid);
            const key = `block${block.id}_sum`;
            sumRow.push(s?.[key] ?? '');
          } else {
            sumRow.push('');
          }
        });

        const sheetData = [header, ...rows, sumRow];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 60 }, ...datesWithData.map(() => ({ wch: 12 }))];
        XLSX.utils.book_append_sheet(wb, ws, `Блок ${block.id}`);
      }

      const notesRows: string[][] = [['Дата', 'Заметка']];
      entries.forEach((e) => {
        const note = (e as any).daily_note;
        if (note) {
          notesRows.push([e.entry_date, note]);
        }
      });
      if (notesRows.length > 1) {
        const notesWs = XLSX.utils.aoa_to_sheet(notesRows);
        notesWs['!cols'] = [{ wch: 12 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, notesWs, 'Заметки');
      }

      const safeName = patientName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
      const fileSuffix = isAll ? 'ALL' : `${fromDate}_${toDate}`;
      const fileName = `PatientData_${safeName}_${fileSuffix}.xlsx`;
      downloadWorkbook(wb, fileName);
      console.log('EXPORT_SUCCESS', fileName);
      toast.success('Файл скачан');
    } catch (e: any) {
      console.error('EXPORT_ERROR', e);
      toast.error(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  }, [patientId, patientName, exportRangeIdx, useCustomRange, customFrom, customTo]);

  return (
    <div className="p-4 pb-20 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-medium">{patientName}</h1>
      </div>

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
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              disabled={(d) => d > today}
              className="p-3 pointer-events-auto"
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={atToday}
          onClick={() => !atToday && setSelectedDate(addDays(selectedDate, 1))}
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Просмотр: {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {BLOCKS.map((block) => {
          const sum = getBlockSum(block.id);
          const isRisk = sum !== null && sum > 4;
          const isFullWidth = block.id === 7;
          return (
            <Card
              key={block.id}
              className={cn('transition-shadow', isFullWidth && 'col-span-2')}
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

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Экспорт данных</h3>
        <div className="flex flex-wrap gap-2">
          {EXPORT_RANGES.map((r, i) => (
            <Button
              key={r.label}
              variant={!useCustomRange && exportRangeIdx === i ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => {
                setExportRangeIdx(i);
                setUseCustomRange(false);
              }}
            >
              {r.label}
            </Button>
          ))}
          <Button
            variant={useCustomRange ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setUseCustomRange(true)}
          >
            Свой период
          </Button>
        </div>

        {useCustomRange && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs flex-1">
                  {customFrom ? format(customFrom, 'd MMM yyyy', { locale: ru }) : 'Дата с'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  disabled={(d) => d > today}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs flex-1">
                  {customTo ? format(customTo, 'd MMM yyyy', { locale: ru }) : 'Дата по'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  disabled={(d) => d > today}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {useCustomRange && customFrom && customTo && customFrom > customTo && (
          <p className="text-xs text-destructive">«Дата с» должна быть раньше «Дата по»</p>
        )}

        <Button
          className="w-full gap-2"
          onClick={handleExport}
          disabled={exporting || !hasData || (useCustomRange && !isCustomValid)}
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
    </div>
  );
};

export default PatientDetailDoctor;
