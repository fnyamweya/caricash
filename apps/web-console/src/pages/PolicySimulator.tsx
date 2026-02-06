import React from 'react';

export function PolicySimulator() {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>Policy Simulator</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label>Subject</label>
          <textarea placeholder="{principalType: 'MERCHANT', roles: ['MERCHANT_OWNER']}" style={{ width: '100%', padding: '0.5rem', minHeight: '120px' }} />
        </div>
        <div>
          <label>Resource & Context</label>
          <textarea placeholder="{type: 'merchant', id: 'store-1'}" style={{ width: '100%', padding: '0.5rem', minHeight: '120px' }} />
        </div>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        <input placeholder="Action (e.g., merchant.user.manage)" style={{ width: '100%', padding: '0.5rem' }} />
      </div>
      <button style={{ marginTop: '0.5rem' }}>Simulate</button>
    </section>
  );
}
