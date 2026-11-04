import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  AppNavbar,
  ControlPanel,
  Chatter,
} from '@/components/odoo';

export const revalidate = 0;

export default async function CRMPage() {
  // ==========================================
  // 1. BACKEND LOGIC: SERVER ACTIONS (PRESERVED STRICTLY)
  // ==========================================

  // A. Tambah Lead / Prospek Baru
  async function createLead(formData: FormData) {
    'use server';
    const title = formData.get('title') as string;
    const contactName = formData.get('contactName') as string;
    const value = parseFloat(formData.get('value') as string) || 0;

    if (!title || !contactName) return;

    await prisma.lead.create({
      data: {
        title,
        contactName,
        value,
        stage: 'New',
      },
    });

    revalidatePath('/crm');
  }

  // B. Geser Stage Lead (New -> Qualified -> Proposition -> Won)
  async function updateLeadStage(formData: FormData) {
    'use server';
    const leadId = formData.get('leadId') as string;
    const nextStage = formData.get('nextStage') as string;

    await prisma.lead.update({
      where: { id: leadId },
      data: { stage: nextStage },
    });

    revalidatePath('/crm');
  }

  // ==========================================
  // 2. FETCH DATA LEADS
  // ==========================================
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const stages = [
    {
      id: 'New',
      wireframe: '[3] New',
      label: 'Prospek Baru',
      icon: '🆕',
      color: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30',
      badgeColor: 'bg-[#3B82F6] text-white',
    },
    {
      id: 'Qualified',
      wireframe: '[4] Qualified',
      label: 'Terkualifikasi',
      icon: '🎯',
      color: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
      badgeColor: 'bg-[#F59E0B] text-white',
    },
    {
      id: 'Proposition',
      wireframe: '[5] Proposition',
      label: 'Negosiasi / Proposal',
      icon: '💼',
      color: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/30',
      badgeColor: 'bg-[#8B5CF6] text-white',
    },
    {
      id: 'Won',
      wireframe: '[6] Won',
      label: 'Deal Menang (Won)',
      icon: '🎉',
      color: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30',
      badgeColor: 'bg-[#10B981] text-white',
    },
  ];

  const totalPipelineValue = leads.reduce((sum, l) => sum + l.value, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="CRM Pipeline (S-04)" />

      {/* 2. Control Panel Header Odoo */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'CRM', href: '/crm' },
          { label: 'Pipeline Leads' },
        ]}
        searchPlaceholder="Cari nama prospek atau perusahaan..."
        pagerText={`Total Peluang: ${leads.length}`}
        availableViews={['kanban', 'list']}
        currentView="kanban"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748B]">Total Nilai Pipeline:</span>
          <span className="text-xs font-mono font-black text-[#0F172A] bg-[#CFFF30]/40 px-2 py-0.5 rounded border border-[#CFFF30]">
            Rp {totalPipelineValue.toLocaleString('id-ID')}
          </span>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-04 CRM Pipeline Kanban */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        
        {/* Form Tambah Lead Baru ala Odoo Quick Create */}
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-[#E2E8F0] pb-2">
            <h2 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span>➕</span>
              <span>Input Peluang / Prospek Baru (F-04)</span>
            </h2>
            <span className="text-[11px] text-[#64748B]">
              Tahap awal: <strong>New (Prospek Baru)</strong>
            </span>
          </div>

          <form action={createLead} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              name="title"
              placeholder="Judul Peluang (misal: Pengadaan Meja Kantor)"
              required
              className="bg-[#F8FAFC] border border-[#E2E8F0] text-xs rounded-lg px-3 py-2 text-[#0F172A] outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-all placeholder-[#64748B]"
            />
            <input
              type="text"
              name="contactName"
              placeholder="Nama Klien / Perusahaan (Kontak)"
              required
              className="bg-[#F8FAFC] border border-[#E2E8F0] text-xs rounded-lg px-3 py-2 text-[#0F172A] outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-all placeholder-[#64748B]"
            />
            <input
              type="number"
              name="value"
              placeholder="Estimasi Nilai Opportunity (Rp)"
              className="bg-[#F8FAFC] border border-[#E2E8F0] text-xs rounded-lg px-3 py-2 text-[#0F172A] outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-all placeholder-[#64748B]"
            />
            <button
              type="submit"
              className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs py-2 px-4 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              <span>+</span>
              <span>Simpan Prospek</span>
            </button>
          </form>
        </div>

        {/* 4 Kolom Kanban S-04 ala Odoo 17.0 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          {stages.map((stg) => {
            const stageLeads = leads.filter((l) => l.stage === stg.id);
            const totalValue = stageLeads.reduce((acc, curr) => acc + curr.value, 0);

            return (
              <div
                key={stg.id}
                className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] min-h-[500px] flex flex-col justify-between"
              >
                <div>
                  {/* Kanban Column Header */}
                  <div
                    className={`p-3 rounded-lg border font-bold text-xs flex justify-between items-center mb-2 shadow-2xs ${stg.color}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{stg.icon}</span>
                      <span>{stg.label}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${stg.badgeColor}`}
                    >
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#64748B] font-semibold mb-3 px-1 flex justify-between">
                    <span>Subtotal Nilai:</span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      Rp {totalValue.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* List Cards in Column */}
                  <div className="space-y-3">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs hover:border-[#00F0FF] hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-extrabold text-[#0F172A] text-xs group-hover:text-[#1E293B] transition-colors leading-snug">
                            {lead.title}
                          </h3>
                        </div>

                        <p className="text-[11px] text-[#64748B] flex items-center gap-1 mb-2">
                          <span>👤</span>
                          <span className="font-medium">{lead.contactName}</span>
                        </p>

                        <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
                          <span className="text-[10px] text-[#64748B] font-semibold uppercase">
                            Expected
                          </span>
                          <span className="font-mono font-black text-xs text-[#0F172A]">
                            Rp {lead.value.toLocaleString('id-ID')}
                          </span>
                        </div>

                        {/* Interactive Stage Transition Forms */}
                        <div className="mt-3 pt-2 border-t border-[#E2E8F0]/70 flex items-center gap-1">
                          {stg.id === 'New' && (
                            <form action={updateLeadStage} className="w-full">
                              <input type="hidden" name="leadId" value={lead.id} />
                              <input type="hidden" name="nextStage" value="Qualified" />
                              <button
                                type="submit"
                                className="w-full bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 font-bold text-[10px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                              >
                                <span>Kualifikasi ➔</span>
                              </button>
                            </form>
                          )}
                          {stg.id === 'Qualified' && (
                            <form action={updateLeadStage} className="w-full">
                              <input type="hidden" name="leadId" value={lead.id} />
                              <input type="hidden" name="nextStage" value="Proposition" />
                              <button
                                type="submit"
                                className="w-full bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30 font-bold text-[10px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                              >
                                <span>Ajukan Proposal ➔</span>
                              </button>
                            </form>
                          )}
                          {stg.id === 'Proposition' && (
                            <form action={updateLeadStage} className="w-full">
                              <input type="hidden" name="leadId" value={lead.id} />
                              <input type="hidden" name="nextStage" value="Won" />
                              <button
                                type="submit"
                                className="w-full bg-[#10B981] hover:brightness-95 text-white font-extrabold text-[10px] py-1.5 rounded-lg transition-all shadow-xs flex items-center justify-center gap-1"
                              >
                                <span>🎉 Mark as Won</span>
                              </button>
                            </form>
                          )}
                          {stg.id === 'Won' && (
                            <div className="w-full text-center text-[#10B981] font-bold text-[10px] bg-[#10B981]/10 py-1.5 rounded-lg border border-[#10B981]/30">
                              ✓ Siap Jadi Quotation (S-05)
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {stageLeads.length === 0 && (
                      <div className="border border-dashed border-[#CBD5E1] rounded-lg p-6 text-center text-[#64748B] text-xs">
                        Kosong
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section Chatter Log Notes Pipeline */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-2">
          <Chatter
            documentId="CRM-PIPELINE"
            documentType="Pipeline Stage Tracker"
            initialLogs={[
              {
                id: 'crm1',
                user: 'Maya Lestari (Sales Mgr)',
                role: 'Sales Manager',
                action: 'Update status Lead Kantor Baru ke Qualified',
                timestamp: 'Hari ini, 10:00',
                message: 'Prospek kebutuhan kantor 4x P001 dan 2x P003 telah diverifikasi.',
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
