import { useEffect, useState } from 'react';
import { backend } from '../../lib/backend';
export default function EvidenceAudit() {
  const [records, setRecords] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { backend('audit').then(data => setRecords(data.audit)).catch(failure => setError(failure.message)); }, []);
  return <section className="panel mt-6"><h2>Evidence audit</h2><p className="subtle">Server-attributed login, logout, save and export operations. Evidence hashes identify saved snapshots; records are append-only through the application.</p>{error && <p role="alert">{error}</p>}<div className="table-scroll"><table className="investment-table"><thead><tr><th>UTC time</th><th>Actor / role</th><th>Action</th><th>Subject</th><th>Evidence hash</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td>{record.occurredAt}</td><td>{record.actor} / {record.role}</td><td>{record.action}</td><td>{record.subject}</td><td><span title={record.evidenceHash}>{record.evidenceHash.slice(0, 16)}…</span></td></tr>)}</tbody></table></div></section>;
}
