import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

function SidebarLayout() {
  const legacySubTheme = localStorage.getItem('legacySubTheme') || 'green';
  const primaryColor = legacySubTheme === 'green' ? '#10b981' : '#0ea5e9';

  return (
    <div className="dashboard-layout-wrapper" style={{ '--so-primary': primaryColor }}>
      <Sidebar isStandalone={true} />
      <main className="right-content-panel">
        <Outlet />
      </main>
    </div>
  );
}

export default SidebarLayout;
