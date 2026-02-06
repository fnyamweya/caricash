import React from 'react';

export function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <DashboardCard title="Ledger Entries" value="—" description="Total posted entries" />
        <DashboardCard title="Audit Events" value="—" description="Total audit trail events" />
        <DashboardCard title="Outbox Queue" value="—" description="Pending outbox events" />
      </div>
    </div>
  );
}

function DashboardCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', color: '#374151' }}>{title}</h3>
      <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem' }}>{value}</p>
      <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>{description}</p>
    </div>
  );
}
