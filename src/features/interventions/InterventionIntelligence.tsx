export default function InterventionIntelligence() {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Intervention Intelligence</h2>
        <span className="record-count">AEHML Workflow</span>
      </div>
      <p className="subtle">Dedicated workspace for turning analysis into daily operational decisions. Full lifecycle workflow in development.</p>
      <div className="mt-4">
        <p>States: DETECTED → UNDER REVIEW → EVALUATED → APPROVAL REQUESTED → APPROVED/REJECTED → SCHEDULED → IN PROGRESS → IMPLEMENTED → VERIFYING → VERIFIED/INCONCLUSIVE → CLOSED</p>
        <p className="subtle mt-2">Exceptions: CANCELLED, BLOCKED, REOPENED</p>
      </div>
    </section>
  );
}
