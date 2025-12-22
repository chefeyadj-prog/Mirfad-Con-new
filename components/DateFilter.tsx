
import React, { useState, useRef, useEffect } from 'react';
import { Filter, Calendar, Check } from 'lucide-react';

export type DateRange = {
  label: string;
  start: Date | null;
  end: Date | null;
};

export const getThisMonthRange = (): DateRange => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  return { label: 'هذا الشهر', start: startOfMonth, end: endOfDay };
};

interface DateFilterProps {
  onFilterChange: (range: DateRange) => void;
  initialLabel?: string;
}

const DateFilter: React.FC<DateFilterProps> = ({ onFilterChange, initialLabel = 'هذا الشهر' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const applyFilter = (label: string, start: Date | null, end: Date | null) => {
    setSelectedLabel(label);
    onFilterChange({ label, start, end });
    setIsOpen(false);
  };

  const handleOptionClick = (type: 'all' | 'today' | 'week' | 'month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    switch (type) {
      case 'all':
        applyFilter('الكل', null, null);
        break;
      case 'today':
        applyFilter('اليوم', today, endOfDay);
        break;
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - 7);
        applyFilter('آخر 7 أيام', startOfWeek, endOfDay);
        break;
      case 'month':
        const range = getThisMonthRange();
        applyFilter(range.label, range.start, range.end);
        break;
    }
  };

  const handleCustomFilter = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      applyFilter('فترة مخصصة', start, end);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          selectedLabel !== 'الكل' 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' 
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Filter size={18} />
        <span>{selectedLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in">
          <div className="p-2 space-y-1">
            <button onClick={() => handleOptionClick('all')} className="w-full text-right px-4 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 flex justify-between">
               <span>الكل (عرض جميع البيانات)</span>
               {selectedLabel === 'الكل' && <Check size={16} className="text-indigo-600" />}
            </button>
            <button onClick={() => handleOptionClick('today')} className="w-full text-right px-4 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 flex justify-between">
               <span>اليوم</span>
               {selectedLabel === 'اليوم' && <Check size={16} className="text-indigo-600" />}
            </button>
            <button onClick={() => handleOptionClick('week')} className="w-full text-right px-4 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 flex justify-between">
               <span>آخر 7 أيام</span>
               {selectedLabel === 'آخر 7 أيام' && <Check size={16} className="text-indigo-600" />}
            </button>
            <button onClick={() => handleOptionClick('month')} className="w-full text-right px-4 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 flex justify-between">
               <span>هذا الشهر</span>
               {selectedLabel === 'هذا الشهر' && <Check size={16} className="text-indigo-600" />}
            </button>
          </div>
          
          <div className="border-t border-slate-100 p-3 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                <Calendar size={12} /> فترة مخصصة
            </p>
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-8">من:</span>
                    <input 
                        type="date" 
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="flex-1 p-1 text-sm border border-slate-300 rounded bg-white outline-none focus:border-indigo-500 text-slate-600"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-8">إلى:</span>
                    <input 
                        type="date" 
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="flex-1 p-1 text-sm border border-slate-300 rounded bg-white outline-none focus:border-indigo-500 text-slate-600"
                    />
                </div>
                <button 
                    onClick={handleCustomFilter}
                    disabled={!customStart || !customEnd}
                    className="w-full mt-2 bg-indigo-600 text-white py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    تطبيق الفلتر
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateFilter;
