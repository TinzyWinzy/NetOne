export interface MonteCarloConfig {
  iterations: number;
  seed: number;
}

export interface Distribution {
  type: 'normal' | 'triangular' | 'uniform' | 'lognormal';
  params: Record<string, number>;
}

export interface UncertainInput {
  name: string;
  distribution: Distribution;
  source?: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MonteCarloResult {
  mean: number;
  median: number;
  stdDev: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  probNegative: number;
  samples: number[];
  seed: number;
  iterations: number;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function sampleNormal(rand: () => number, mean: number, stdDev: number): number {
  const u1 = rand();
  const u2 = rand();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

function sampleTriangular(rand: () => number, min: number, mode: number, max: number): number {
  const u = rand();
  const c = (mode - min) / (max - min);
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function sampleUniform(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function sampleDistribution(rand: () => number, dist: Distribution): number {
  if (dist.type === 'normal') {
    return sampleNormal(rand, dist.params.mean, dist.params.stdDev);
  }
  if (dist.type === 'triangular') {
    return sampleTriangular(rand, dist.params.min, dist.params.mode, dist.params.max);
  }
  if (dist.type === 'uniform') {
    return sampleUniform(rand, dist.params.min, dist.params.max);
  }
  if (dist.type === 'lognormal') {
    const mu = dist.params.mu;
    const sigma = dist.params.sigma;
    const z = sampleNormal(rand, 0, 1);
    return Math.exp(mu + sigma * z);
  }
  return dist.params.mean || 0;
}

export function runMonteCarlo(
  config: MonteCarloConfig,
  inputs: UncertainInput[],
  evaluate: (sampled: Record<string, number>) => number
): MonteCarloResult {
  const rand = seededRandom(config.seed);
  const samples: number[] = [];
  for (let i = 0; i < config.iterations; i++) {
    const sampled: Record<string, number> = {};
    for (const input of inputs) {
      sampled[input.name] = sampleDistribution(rand, input.distribution);
    }
    samples.push(evaluate(sampled));
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  const median = samples[Math.floor(samples.length / 2)];
  const variance = samples.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / samples.length;
  const stdDev = Math.sqrt(variance);
  const p5 = samples[Math.floor(samples.length * 0.05)];
  const p25 = samples[Math.floor(samples.length * 0.25)];
  const p75 = samples[Math.floor(samples.length * 0.75)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const probNegative = samples.filter(s => s < 0).length / samples.length;
  return { mean, median, stdDev, p5, p25, p75, p95, probNegative, samples, seed: config.seed, iterations: config.iterations };
}
