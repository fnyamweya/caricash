import React from 'react';
import { Dashboard } from './pages/Dashboard';
import { KycQueueList } from './pages/KycQueueList';
import { KycCaseDetail } from './pages/KycCaseDetail';
import { MerchantAccess } from './pages/MerchantAccess';
import { AgentAccess } from './pages/AgentAccess';
import { PolicySimulator } from './pages/PolicySimulator';

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Caricash Admin Console</h1>
        <p style={{ color: '#6b7280', margin: '0.5rem 0 0' }}>Phase 2 - Admin Review Console</p>
      </header>
      <main>
        <Dashboard />
        <KycQueueList />
        <KycCaseDetail />
        <MerchantAccess />
        <AgentAccess />
        <PolicySimulator />
      </main>
    </div>
  );
}
