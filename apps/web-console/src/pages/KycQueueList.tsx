import React from 'react';

export function KycQueueList() {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>KYC Queue</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Case ID</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Queue</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Assigned To</th>
          </tr>
        </thead>
        <tbody>
          {['CASE-1001', 'CASE-1002', 'CASE-1003'].map((id, idx) => (
            <tr key={id}>
              <td style={{ padding: '0.5rem' }}>{id}</td>
              <td style={{ padding: '0.5rem' }}>{idx === 0 ? 'HIGH_RISK' : 'STANDARD'}</td>
              <td style={{ padding: '0.5rem' }}>Assigned</td>
              <td style={{ padding: '0.5rem' }}>Compliance Team</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
