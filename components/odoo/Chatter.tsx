'use client';

import React, { useState } from 'react';

export interface ChatterLogItem {
  id: string;
  user: string;
  avatar?: string;
  role?: string;
  action: string;
  timestamp: string;
  message?: string;
}

export interface ChatterProps {
  documentId?: string;
  documentType?: string;
  initialLogs?: ChatterLogItem[];
}

export default function Chatter({
  documentId,
  documentType = 'Document',
  initialLogs = [],
}: ChatterProps) {
  const [activeTab, setActiveTab] = useState<'log' | 'message' | 'activity'>('log');
  const [noteText, setNoteText] = useState('');
  const [logs, setLogs] = useState<ChatterLogItem[]>(() => {
    if (initialLogs.length > 0) return initialLogs;
    return [
      {
        id: '1',
        user: 'System Admin',
        role: 'Audit System',
        action: `Created ${documentType} ${documentId || ''}`,
        timestamp: 'Hari ini, 09:00',
        message: 'Status diinisiasi ke alur Draft.',
      },
    ];
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const newLog: ChatterLogItem = {
      id: String(Date.now()),
      user: 'Maya Lestari (Sales)',
      role: 'Staff Aktif',
      action: activeTab === 'log' ? 'Menambahkan Log Note' : 'Mengirim Pesan',
      timestamp: 'Baru saja',
      message: noteText.trim(),
    };

    setLogs([newLog, ...logs]);
    setNoteText('');
  };

  return (
    <div className="mt-8 border-t border-[#E2E8F0] pt-6 bg-[#FFFFFF] rounded-b-xl px-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3 mb-4">
        {/* Chatter Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('message')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'message'
                ? 'bg-[#1E293B] text-[#FFFFFF]'
                : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]'
            }`}
          >
            <span>✉️</span>
            <span>Send message</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('log')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'log'
                ? 'bg-[#1E293B] text-[#FFFFFF]'
                : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]'
            }`}
          >
            <span>📝</span>
            <span>Log note</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'bg-[#1E293B] text-[#FFFFFF]'
                : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]'
            }`}
          >
            <span>⏰</span>
            <span>Activities</span>
          </button>
        </div>

        <div className="text-[11px] text-[#64748B] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Audit Trail & Log Notes Aktif (Odoo 17)</span>
        </div>
      </div>

      {/* Input Note Form */}
      <form onSubmit={handleAddNote} className="mb-6">
        <div className="border border-[#E2E8F0] rounded-lg p-2.5 bg-[#F8FAFC] focus-within:border-[#00F0FF] focus-within:ring-1 focus-within:ring-[#00F0FF] transition-all">
          <textarea
            rows={2}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={
              activeTab === 'log'
                ? 'Tulis catatan log internal untuk dokumen ini...'
                : 'Kirim pesan atau notifikasi ke tim...'
            }
            className="w-full bg-transparent text-xs text-[#0F172A] placeholder-[#64748B] outline-none resize-none"
          />
          <div className="flex justify-end pt-2 border-t border-[#E2E8F0]/80">
            <button
              type="submit"
              disabled={!noteText.trim()}
              className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-bold text-xs px-3.5 py-1.5 rounded-md transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {activeTab === 'log' ? 'Simpan Catatan' : 'Kirim Pesan'}
            </button>
          </div>
        </div>
      </form>

      {/* Log History Stream */}
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC]/50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#1E293B] text-[#CFFF30] font-bold text-xs flex items-center justify-center shrink-0">
              {log.user.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-[#0F172A]">{log.user}</span>
                  {log.role && (
                    <span className="text-[10px] bg-[#F8FAFC] text-[#64748B] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                      {log.role}
                    </span>
                  )}
                  <span className="text-xs text-[#64748B] font-medium">— {log.action}</span>
                </div>
                <span className="text-[10px] text-[#64748B] whitespace-nowrap">{log.timestamp}</span>
              </div>
              {log.message && (
                <p className="mt-1 text-xs text-[#0F172A] leading-relaxed bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0]/60">
                  {log.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

