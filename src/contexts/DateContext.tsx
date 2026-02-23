import React, { createContext, useContext, useState } from 'react';
import { format } from 'date-fns';

interface DateState {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  dateStr: string; // YYYY-MM-DD
}

const DateContext = createContext<DateState | undefined>(undefined);

export const useSelectedDate = () => {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error('useSelectedDate must be used within DateProvider');
  return ctx;
};

export const DateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate, dateStr }}>
      {children}
    </DateContext.Provider>
  );
};
