import Link from 'next/link';

export const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const PILL: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-300',
  Ready: 'bg-amber-50 text-amber-700 border-amber-300',
  Confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Done: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Received: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Posted: 'bg-sky-50 text-sky-700 border-sky-300',
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-400',
  Open: 'bg-sky-50 text-sky-700 border-sky-300',
  Closed: 'bg-slate-100 text-slate-600 border-slate-300',
  'Pending Credit Approval': 'bg-red-50 text-red-700 border-red-300',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${PILL[status] ?? PILL.Draft}`}>
      {status}
    </span>
  );
}

export function TabLinks({ base, active, tabs }: { base: string; active: string; tabs: { id: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`${base}?tab=${t.id}`}
          className={`px-3 py-1 rounded-md font-semibold transition-colors ${
            active === t.id ? 'bg-[#1E293B] text-[#CFFF30]' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function ListTable({ headers, children, empty }: { headers: { label: string; right?: boolean }[]; children: React.ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
          <tr>
            {headers.map((h) => (
              <th key={h.label} className={`px-4 py-3 ${h.right ? 'text-right' : ''}`}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">{children}</tbody>
      </table>
      {!hasRows && <div className="p-10 text-center text-[#64748B] text-xs">{empty ?? 'Belum ada data.'}</div>}
    </div>
  );
}
