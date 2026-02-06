import React from 'react';

export function MerchantAccess() {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>Merchant Users & Roles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <h3>Users</h3>
          <ul>
            <li>Owner - MERCHANT_OWNER</li>
            <li>Manager - MERCHANT_MANAGER</li>
            <li>Cashier - MERCHANT_CASHIER</li>
          </ul>
        </div>
        <div>
          <h3>Role Assignment</h3>
          <input placeholder="User ID" style={{ width: '100%', padding: '0.5rem' }} />
          <select style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}>
            <option>MERCHANT_OWNER</option>
            <option>MERCHANT_MANAGER</option>
            <option>MERCHANT_CASHIER</option>
            <option>MERCHANT_VIEWER</option>
          </select>
          <button style={{ marginTop: '0.5rem' }}>Assign Role</button>
        </div>
      </div>
    </section>
  );
}
