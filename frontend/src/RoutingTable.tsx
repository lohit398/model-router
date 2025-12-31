import { useEffect, useState } from 'react';

export function RoutingTable() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/routing-decisions');
      const data = await res.json();
      setRows(data);
    })();
  }, []);

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Routing Decisions</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Created</th>
            <th>Task Type</th>
            <th>SLA</th>
            <th>Model</th>
            <th>Est. Cost</th>
            <th>Est. Latency</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>{r.tasks?.task_type}</td>
              <td>{r.tasks?.sla}</td>
              <td>{r.chosen_model}</td>
              <td>{r.estimated_cost_cents}</td>
              <td>{r.estimated_latency_ms} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
