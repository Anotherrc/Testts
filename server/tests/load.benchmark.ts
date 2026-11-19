import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createApp } from '../app.js';
import { initStore } from '../store.js';

process.env.NODE_ENV = 'test';

async function runLoadBenchmark() {
  const dbPath = path.join(os.tmpdir(), `vilas_load_${Date.now()}.db`);
  initStore(dbPath);
  const app = createApp();
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    if (!addr || typeof addr !== 'object') throw new Error('No se pudo obtener puerto de prueba');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin@vilasmotor.cl', password: 'VilasAdmin2026!' }),
    });
    const { access } = (await loginRes.json()) as { access: string };

    const endpoints = ['/api/equipos', '/api/ordenes', '/api/mantenciones', '/api/clientes', '/api/insumos'];
    const totalRequests = 150;
    const concurrency = 25;
    const latencies: number[] = [];
    let errors = 0;
    let cursor = 0;

    const startTotal = performance.now();

    async function worker() {
      while (cursor < totalRequests) {
        const idx = cursor++;
        const endpoint = endpoints[idx % endpoints.length];
        const t0 = performance.now();
        try {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            headers: { Authorization: `Bearer ${access}` },
          });
          await res.arrayBuffer();
          if (res.status !== 200) errors += 1;
        } catch {
          errors += 1;
        }
        latencies.push(performance.now() - t0);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const elapsedMs = performance.now() - startTotal;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const max = latencies[latencies.length - 1] || 0;
    const rps = (totalRequests / (elapsedMs / 1000)).toFixed(1);

    console.log('=== PRUEBA DE CARGA Y ESTRES VILAS MOTOR ===');
    console.log(`Solicitudes totales: ${totalRequests} (concurrencia: ${concurrency})`);
    console.log(`Errores HTTP:        ${errors}`);
    console.log(`Tiempo total:        ${elapsedMs.toFixed(1)} ms`);
    console.log(`Rendimiento:         ${rps} req/s`);
    console.log(`Latencia p50:        ${p50.toFixed(2)} ms`);
    console.log(`Latencia p95:        ${p95.toFixed(2)} ms`);
    console.log(`Latencia maxima:     ${max.toFixed(2)} ms`);

    if (errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const suffix of ['', '-wal', '-shm']) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
  }
}

void runLoadBenchmark();
