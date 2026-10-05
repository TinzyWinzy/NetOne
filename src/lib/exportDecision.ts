import { backend } from './backend';
import type { SavedScenario } from '../domain/scenarios';
export async function exportDecision(id: string, format: 'json' | 'csv' | 'pdf') {
  const payload = await backend('export', {}, id);
  const scenario = payload.scenario as SavedScenario;
  let content: Blob;
  if (format === 'json') content = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  else if (format === 'csv') {
    const quote = (value: unknown) => { const text = String(value); return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`; };
    const rows: unknown[][] = [['scenario_id', 'scenario_name', 'data_status', 'exported_by', 'engine_version', 'model_version', 'source', 'site', 'intervention', 'cost_usd', 'objective_points', 'selected', 'reason']];
    for (const allocation of scenario.result.allocations) {
      const candidate = scenario.result.candidates.find(value => value.id === allocation.candidateId)!;
      rows.push([scenario.id, scenario.name, 'SYNTHETIC', payload.exportedBy, scenario.result.engineVersion, candidate.modelVersion, candidate.sourceRef, candidate.siteId, candidate.action, allocation.cost, allocation.objectiveScore, allocation.selected, allocation.reason]);
    }
    content = new Blob([rows.map(row => row.map(quote).join(',')).join('\n')], { type: 'text/csv' });
  } else {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
    let page = pdf.addPage([595, 842]); let y = 800;
    const lines = ['NETONE INVESTMENT DECISION RECORD', 'SYNTHETIC DEMONSTRATION - ADVISORY ONLY', scenario.name,
      `Scenario ${scenario.id}`, `Saved ${scenario.savedAt}`, `Exported ${payload.exportedAt} by ${payload.exportedBy}`, `Evidence hash ${payload.evidenceHash}`,
      `Engine ${scenario.result.engineVersion}; objective ${scenario.result.input.objective}`,
      `Scope ${JSON.stringify(scenario.result.input.filters)}`, `Objective weights ${JSON.stringify(scenario.result.objectiveWeights)}`,
      `Budget USD ${scenario.result.input.budget}; spend USD ${scenario.result.spend}; unallocated USD ${scenario.result.unallocated}`,
      `Minimum score ${scenario.result.input.minimumScore}`, `Must fund ${scenario.result.input.mustFund.join(', ') || 'None'}`,
      `Excluded ${scenario.result.input.excluded.join(', ') || 'None'}`, 'Allocation uses a deterministic heuristic, not guaranteed optimal or predicted ROI.',
      'Full inputs, rules and candidate decomposition are available in the JSON evidence export.', ''];
    for (const allocation of scenario.result.allocations.filter(value => value.selected)) {
      const candidate = scenario.result.candidates.find(value => value.id === allocation.candidateId)!;
      lines.push(`${candidate.siteId} ${candidate.action}; USD ${allocation.cost}; objective ${allocation.objectiveScore.toFixed(2)}`, allocation.reason,
        `Evidence ${candidate.sourceRef}; model ${candidate.modelVersion}; weights ${candidate.weightVersion}`,
        `Rule ${candidate.serviceEvidence.rule.id} v${candidate.serviceEvidence.rule.version}; DEMO only`, '');
    }
    for (const line of lines) {
      if (/^N\d{3} /.test(line) && y < 150) { page = pdf.addPage([595, 842]); y = 800; }
      const segments: string[] = []; let current = '';
      for (const word of line.replace(/[^\x20-\x7e]/g, '?').split(' ')) {
        const next = current ? `${current} ${word}` : word;
        if (current && font.widthOfTextAtSize(next, 10) > 515) { segments.push(current); current = word; } else current = next;
      }
      segments.push(current);
      for (const segment of segments) {
        if (y < 45) { page = pdf.addPage([595, 842]); y = 800; }
        page.drawText(segment, { x: 40, y, size: line === lines[0] ? 13 : 10, font }); y -= 15;
      }
    }
    pdf.getPages().forEach((value, index) => value.drawText(`Page ${index + 1} of ${pdf.getPageCount()}`, { x: 490, y: 20, size: 8, font }));
    const bytes = await pdf.save(); content = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
  }
  const url = URL.createObjectURL(content); const link = document.createElement('a'); link.href = url; link.download = `netone-scenario-${scenario.id}.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
