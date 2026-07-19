import type { GatewayMetrics } from './contracts.js';

interface Metric {
  name: string;
  labels: Readonly<Record<string, string>>;
  value: number;
}

export class InMemoryGatewayMetrics implements GatewayMetrics {
  readonly #counters = new Map<string, Metric>();
  readonly #observations = new Map<string, Metric>();

  increment(name: string, labels: Readonly<Record<string, string>> = {}): void {
    update(this.#counters, name, labels, 1);
  }

  observe(name: string, value: number, labels: Readonly<Record<string, string>> = {}): void {
    update(this.#observations, `${name}_sum`, labels, value);
    update(this.#observations, `${name}_count`, labels, 1);
  }

  render(): string {
    return [...this.#counters.values(), ...this.#observations.values()]
      .sort((left, right) =>
        key(left.name, left.labels).localeCompare(key(right.name, right.labels)),
      )
      .map((metric) => `${metric.name}${renderLabels(metric.labels)} ${metric.value}`)
      .join('\n')
      .concat('\n');
  }
}

function update(
  metrics: Map<string, Metric>,
  name: string,
  labels: Readonly<Record<string, string>>,
  amount: number,
): void {
  if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) throw new TypeError('Invalid metric name');
  const id = key(name, labels);
  const metric = metrics.get(id) ?? { name, labels: { ...labels }, value: 0 };
  metric.value += amount;
  metrics.set(id, metric);
}

function key(name: string, labels: Readonly<Record<string, string>>): string {
  return `${name}|${Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => `${label}=${value}`)
    .join(',')}`;
}

function renderLabels(labels: Readonly<Record<string, string>>): string {
  const values = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  if (values.length === 0) return '';
  return `{${values.map(([label, value]) => `${label}="${escape(value)}"`).join(',')}}`;
}

function escape(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}
