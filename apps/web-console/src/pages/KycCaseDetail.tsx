import React from 'react';

export function KycCaseDetail() {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>KYC Case Detail</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <h3>Applicant</h3>
          <p><strong>Name:</strong> Jane Doe</p>
          <p><strong>Country:</strong> BB</p>
          <p><strong>Tier:</strong> TIER_0</p>
        </div>
        <div>
          <h3>Decision</h3>
          <select style={{ width: '100%', padding: '0.5rem' }}>
            <option>Approve</option>
            <option>Reject</option>
            <option>Request More Info</option>
          </select>
          <textarea placeholder="Decision notes" style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
          <button style={{ marginTop: '0.5rem' }}>Submit Decision</button>
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <h3>Documents</h3>
        <ul>
          <li>National ID (hash verified)</li>
          <li>Proof of Address (pending)</li>
        </ul>
      </div>
    </section>
  );
}
