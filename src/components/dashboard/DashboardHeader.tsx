import React from 'react';
import { Clock } from 'lucide-react';

interface DashboardHeaderProps {
  userName?: string;
}

export const DashboardHeader = React.memo(({ userName }: DashboardHeaderProps) => {
  return (
    <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-2xl border border-slate-800/40 select-none shrink-0 text-right">
      <div>
        <h2 className="text-sm font-semibold text-slate-400 font-sans tracking-tight">صحتك بالدنيا، الله يقويك</h2>
        <h1 className="text-lg font-bold text-slate-100 Shami mt-0.5">أهلاً، {userName || ''}</h1>
      </div>
      <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner text-center">
        <Clock className="w-5 h-5 text-emerald-400 mx-auto" strokeWidth={1.5} />
        <span className="text-[9px] text-slate-500 font-bold block mt-1 uppercase font-sans">تحديث دقيق</span>
      </div>
    </div>
  );
});
DashboardHeader.displayName = 'DashboardHeader';
