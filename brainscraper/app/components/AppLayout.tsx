'use client';

import React from 'react';
import Sidebar from './Sidebar';
import PipelineStatusBar from './PipelineStatusBar';

interface AppLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  hidePipelineStatus?: boolean;
}

export default function AppLayout({ 
  children, 
  hideSidebar = false,
  hidePipelineStatus = false 
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-black">
      {/* Sidebar */}
      {!hideSidebar && <Sidebar />}
      
      {/* Main Content Area */}
      <div className={`${!hideSidebar ? 'ml-64' : ''} min-h-screen flex flex-col`}>
        {/* Pipeline Status Bar */}
        {!hidePipelineStatus && <PipelineStatusBar />}
        
        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}