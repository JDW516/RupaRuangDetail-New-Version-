'use client';

import React from 'react';
import AppNavbar, { AppNavbarProps } from './AppNavbar';
import ControlPanel, { ControlPanelProps } from './ControlPanel';

export interface OdooAppLayoutProps {
  navbarProps?: AppNavbarProps;
  controlPanelProps?: ControlPanelProps;
  children: React.ReactNode;
}

export default function OdooAppLayout({
  navbarProps,
  controlPanelProps,
  children,
}: OdooAppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 1. Global Navigation Bar Odoo 17 */}
      <AppNavbar
        currentModule={navbarProps?.currentModule}
        subMenus={navbarProps?.subMenus}
        companyName={navbarProps?.companyName}
        userName={navbarProps?.userName}
      />

      {/* 2. Control Panel Header (Breadcrumbs, Search, View Switchers, Actions) */}
      {controlPanelProps && <ControlPanel {...controlPanelProps} />}

      {/* 3. Main Workspace Canvas */}
      <main className="flex-1 w-full">{children}</main>
    </div>
  );
}
