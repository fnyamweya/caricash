import React from 'react';
import { Dashboard } from './pages/Dashboard';

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Caricash Admin Console</h1>
        <p style={{ color: '#6b7280', margin: '0.5rem 0 0' }}>Phase 1 - Staff Dashboard</p>
      </header>
      <main>
        <Dashboard />
      </main>
    </div>
  );
}
