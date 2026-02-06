import React from 'react';

export function AgentAccess() {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>Agent Users & Roles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <h3>Users</h3>
          <ul>
            <li>Owner - AGENT_OWNER</li>
            <li>Supervisor - AGENT_SUPERVISOR</li>
            <li>Teller - AGENT_TELLER</li>
          </ul>
        </div>
        <div>
          <h3>Role Assignment</h3>
          <input placeholder="User ID" style={{ width: '100%', padding: '0.5rem' }} />
          <select style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}>
            <option>AGENT_OWNER</option>
            <option>AGENT_SUPERVISOR</option>
            <option>AGENT_TELLER</option>
            <option>AGENT_VIEWER</option>
          </select>
          <button style={{ marginTop: '0.5rem' }}>Assign Role</button>
        </div>
      </div>
    </section>
  );
}
