// Serves bench/index.html and writes each POSTed result to bench-results.jsonl.
import { createServer } from 'node:http';
import { readFileSync, appendFileSync } from 'node:fs';
const dir = new URL('./', import.meta.url).pathname;
createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/mark') { let b = ''; req.on('data', d => b += d); req.on('end', () => { appendFileSync(dir + 'bench-marks.jsonl', b + '\n'); console.log('MARK ' + b); res.end('ok'); }); return; }
  if (req.method === 'POST' && req.url === '/result') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => { appendFileSync(dir + 'bench-results.jsonl', b + '\n'); console.log('RESULT ' + b); res.end('ok'); });
    return;
  }
  res.setHeader('Content-Type', 'text/html'); res.setHeader('Cache-Control', 'no-store');
  res.end(readFileSync(dir + 'draw-bench.html'));
}).listen(8799, '0.0.0.0', () => console.log('listening 8799'));
