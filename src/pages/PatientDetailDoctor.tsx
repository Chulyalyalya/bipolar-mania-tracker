import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useSelectedDate } from '@/contexts/DateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKS } from '@/lib/questions';
import { cn } from '@/lib/utils';
import { ChevronLeft, Download, Check } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { downloadWorkbook } from '@/lib/xlsxDownload';

interface MedicationRow {
  id: string;
  medication_name: string;
  dosage: string | null;
}

interface MedTracking {
  morning_taken: boolean;
  evening_taken: boolean;
}

const EXPORT_RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'Всё', days: null },
];

const PatientDetailDoctor = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { selectedDate, dateStr } = useSelectedDate();
  const [patientName, setPatientName] = useState('');
  const [entryData, setEntryData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [hasData, setHasData] = useState(true);

  const [exportRangeIdx, setExportRangeIdx] = useState(3);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const today = new Date();

  useEffect(() => {
    if (!patientId) return;
    (supabase
      .from('profiles')
      .select('full_name')
      .eq('id', patientId)
      .single() as any)
      .then(({ data }: any) => setPatientName(data?.full_name || 'Пациент'));
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      const { data: entry } = await (supabase
        .from('entries')
        .select('block1_sum, block2_sum, block3_sum, block4_sum, block5_sum, block6_sum, block7_sum, total_risk_blocks_count')
        .eq('user_id', patientId)
        .eq('entry_date', dateStr)
        .maybeSingle() as any);

      setEntryData(entry);
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
    if (!entryData) return null;
    const key = `block${blockId}_sum`;
    return entryData[key] as number;
  };

  const riskCount = entryData?.total_risk_blocks_count ?? 0;
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
        .select('id, entry_date, daily_note, block1_sum, block2_sum, block3_sum, block4_sum, block5_sum, block6_sum, block7_sum')
        .eq('user_id', patientId)
        .order('entry_date', { ascending: true });

      if (fromDate) query = query.gte('entry_date', fromDate);
      if (!isAll) query = query.lte('entry_date', toDate);

      const { data: entries, error: entriesError } = await (query as any);
      if (entriesError) throw entriesError;

      if (!entries?.length) {
        toast.error('Нет сохранённых записей для выбранного периода.');
        return;
      }

      const entryIds = entries.map((e: any) => e.id);

      const { data: answers, error: answersError } = await supabase
        .from('mania_answers')
        .select('entry_id, block_id, question_id, score')
        .in('entry_id', entryIds);
      if (answersError) throw answersError;

      const dataMap: Record<number, Record<number, Record<string, number>>> = {};
      answers?.forEach((a) => {
        if (!dataMap[a.block_id]) dataMap[a.block_id] = {};
        if (!dataMap[a.block_id][a.question_id]) dataMap[a.block_id][a.question_id] = {};
        dataMap[a.block_id][a.question_id][a.entry_id] = a.score;
      });

      const wb = XLSX.utils.book_new();

      for (const block of BLOCKS) {
        const blockData = dataMap[block.id] || {};
        const sortedDates = entries.map((e: any) => e.entry_date);

        const datesWithData = sortedDates.filter((date: string) => {
          const eid = entries.find((e: any) => e.entry_date === date)?.id;
          if (!eid) return false;
          return block.questions.some((_, qIdx) => blockData[qIdx]?.[eid] !== undefined);
        });

        const header = ['Критерий', ...(datesWithData.length ? datesWithData : [])];

        const rows = block.questions.map((q, qIdx) => {
          const row: (string | number)[] = [q];
          datesWithData.forEach((date: string) => {
            const eid = entries.find((e: any) => e.entry_date === date)?.id;
            const score = eid ? blockData[qIdx]?.[eid] : undefined;
            row.push(score !== undefined ? score : '');
          });
          return row;
        });

        const sumRow: (string | number)[] = ['Сумма блока'];
        datesWithData.forEach((date: string) => {
          const entry = entries.find((e: any) => e.entry_date === date);
          if (entry) {
            const key = `block${block.id}_sum`;
            sumRow.push(entry[key] ?? '');
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
      entries.forEach((e: any) => {
        const note = e.daily_note;
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="h-8 w-8 rounded-xl hover:bg-card/60 inline-flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-semibold">{patientName}</h1>
      </div>

      {/* Risk banner */}
      {riskCount >= 3 && (
        <div className="glass-card border-destructive/20 bg-destructive/5 p-3.5">
          <p className="text-xs text-destructive font-medium">
            {riskCount} блоков с повышенным риском за {format(selectedDate, 'd MMMM', { locale: ru })}.
          </p>
        </div>
      )}

      {/* Block grid */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Mania Checker
        </p>
        <div className="grid grid-cols-2 gap-3">
          {BLOCKS.map((block) => {
            const sum = getBlockSum(block.id);
            const isRisk = sum !== null && sum > 4;
            const isFullWidth = block.id === 7;
            return (
              <div
                key={block.id}
                className={cn(
                  'glass-card transition-all',
                  isFullWidth && 'col-span-2'
                )}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Блок {block.id}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{block.name}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {sum !== null && (
                      <span className="text-sm font-semibold">{sum}</span>
                    )}
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full',
                        sum === null ? 'bg-muted' : isRisk ? 'bg-alert-red' : 'bg-alert-green'
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export section */}
      <div className="space-y-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Экспорт данных
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {EXPORT_RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                setExportRangeIdx(i);
                setUseCustomRange(false);
              }}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                !useCustomRange && exportRangeIdx === i
                  ? 'bg-foreground text-background'
                  : 'bg-card/40 text-muted-foreground hover:bg-card/60 border border-border/30'
              )}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUseCustomRange(true)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
              useCustomRange
                ? 'bg-foreground text-background'
                : 'bg-card/40 text-muted-foreground hover:bg-card/60 border border-border/30'
            )}
          >
            Период
          </button>
        </div>

        {useCustomRange && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-border/30 bg-card/40 px-3 py-2 text-xs hover:bg-card/60 transition-colors"
                >
                  {customFrom ? format(customFrom, 'd MMM yyyy', { locale: ru }) : 'Дата с'}
                </button>
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
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-border/30 bg-card/40 px-3 py-2 text-xs hover:bg-card/60 transition-colors"
                >
                  {customTo ? format(customTo, 'd MMM yyyy', { locale: ru }) : 'Дата по'}
                </button>
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
          <p className="text-[11px] text-destructive">«Дата с» должна быть раньше «Дата по»</p>
        )}

        <button
          type="button"
          onClick={() => {
            console.log('DOCTOR_EXPORT_CLICK');
            void handleExport();
          }}
          disabled={exporting || !hasData || (useCustomRange && !isCustomValid)}
          className="relative z-10 pointer-events-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Экспорт…' : 'Скачать данные'}
        </button>

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
