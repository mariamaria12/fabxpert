'use client';

import type { ProductivityKpis } from '@fabxpert/shared';
import {
  efficiencySubLabel,
  efficiencyTone,
  formatEfficiency,
  formatHours,
} from './reportsFormat';
import { TOKEN } from './reportColors';

type Kpi = {
  label: string;
  value: string;
  sub?: string;
  color: string;
};

function buildKpis(kpis: ProductivityKpis): Kpi[] {
  const tone = efficiencyTone(kpis.efficiencyPct);
  const efficiencyColor =
    tone === 'good' ? TOKEN.success : tone === 'bad' ? TOKEN.danger : TOKEN.muted;

  return [
    {
      label: 'Proiecte finalizate',
      value: String(kpis.completedCount),
      color: 'var(--color-text-primary)',
    },
    {
      label: 'La termen',
      value: String(kpis.onTimeCount),
      color: TOKEN.success,
    },
    {
      label: 'Întârziate',
      value: String(kpis.lateCount),
      color: TOKEN.danger,
    },
    {
      label: 'Ore lucrate',
      value: formatHours(kpis.totalWorkedMinutes),
      color: 'var(--color-text-primary)',
    },
    {
      label: 'Eficiență medie',
      value: formatEfficiency(kpis.efficiencyPct),
      sub: efficiencySubLabel(kpis.efficiencyPct),
      color: efficiencyColor,
    },
  ];
}

export function ReportKpiCards({ kpis }: { kpis: ProductivityKpis }) {
  const cards = buildKpis(kpis);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2"
        >
          <div className="truncate text-[11px] leading-tight text-text-muted">
            {card.label}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span
              className="text-2xl font-semibold tabular-nums leading-none"
              style={{ color: card.color }}
            >
              {card.value}
            </span>
            {card.sub && <span className="text-[10px] text-text-muted">{card.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
