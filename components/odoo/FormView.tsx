'use client';

import React from 'react';
import FormStatusBar, { FormStatusBarProps } from './FormStatusBar';
import FormSheet, { FormSheetProps } from './FormSheet';
import Chatter, { ChatterLogItem } from './Chatter';

export interface FormViewProps {
  statusBar?: FormStatusBarProps;
  sheet: FormSheetProps;
  chatter?: {
    documentId?: string;
    documentType?: string;
    initialLogs?: ChatterLogItem[];
  };
}

export default function FormView({ statusBar, sheet, chatter }: FormViewProps) {
  return (
    <div className="max-w-6xl mx-auto my-6 px-3 sm:px-6">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        {/* 1. Baris Status Bar (State Machine & Action Buttons) */}
        {statusBar && (
          <FormStatusBar
            actions={statusBar.actions}
            stages={statusBar.stages}
            currentStage={statusBar.currentStage}
            onStageClick={statusBar.onStageClick}
          >
            {statusBar.children}
          </FormStatusBar>
        )}

        {/* 2. Lembaran Kertas Form Sheet */}
        <FormSheet
          title={sheet.title}
          subtitle={sheet.subtitle}
          ribbon={sheet.ribbon}
          smartButtons={sheet.smartButtons}
        >
          {sheet.children}
        </FormSheet>

        {/* 3. Chatter / Log Notes Odoo Section */}
        {chatter && (
          <Chatter
            documentId={chatter.documentId}
            documentType={chatter.documentType}
            initialLogs={chatter.initialLogs}
          />
        )}
      </div>
    </div>
  );
}
