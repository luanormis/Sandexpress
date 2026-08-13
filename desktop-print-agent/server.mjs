import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';

const HTTP_PORT = 17891;
const EMULATOR_PORT = 19100;
const DISCOVERY_PORTS = [9100, 515, 631];
const spoolDir = path.resolve('spool');
const allowedOrigins = new Set(['https://sandexpress.com.br', 'https://www.sandexpress.com.br', 'https://app.sandexpress.com.br', 'https://sandexpress.vercel.app', 'http://localhost:3000']);

function isPrivateIpv4(host) {
  const parts = String(host).split('.').map(Number);
  return parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 127);
}

function localSubnets() {
  const result = new Set();
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal && isPrivateIpv4(address.address)) result.add(address.address.split('.').slice(0, 3).join('.'));
    }
  }
  return [...result];
}

function probe(host, port = 9100, timeout = 220) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = found => { socket.destroy(); resolve(found); };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function discover() {
  const printers = [{ name: 'SandExpress térmica virtual', host: '127.0.0.1', port: EMULATOR_PORT, virtual: true, rawCompatible: true }];
  for (const subnet of localSubnets()) {
    const hosts = Array.from({ length: 254 }, (_, index) => `${subnet}.${index + 1}`);
    for (let offset = 0; offset < hosts.length; offset += 32) {
      const batch = hosts.slice(offset, offset + 32);
      const found = await Promise.all(batch.flatMap(host => DISCOVERY_PORTS.map(async port => ({ host, port, found: await probe(host, port) }))));
      found.filter(item => item.found).forEach(item => {
        if (printers.some(printer => printer.host === item.host && printer.port === item.port)) return;
        printers.push({
          name: `Impressora de rede ${item.host}`,
          host: item.host,
          port: item.port,
          virtual: false,
          rawCompatible: item.port === 9100,
          protocol: item.port === 9100 ? 'RAW/ESC-POS' : item.port === 631 ? 'IPP' : 'LPD',
        });
      });
    }
  }
  return printers;
}

async function sendRaw(host, port, text) {
  if (!isPrivateIpv4(host)) throw new Error('Destino fora da rede privada.');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) || 9100 }, () => {
      socket.end(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([0x1d, 0x56, 0x00])]));
    });
    socket.setTimeout(5000);
    socket.once('close', resolve);
    socket.once('timeout', () => { socket.destroy(); reject(new Error('Tempo limite da impressora.')); });
    socket.once('error', reject);
  });
}

await fs.mkdir(spoolDir, { recursive: true });
net.createServer(socket => {
  const chunks = [];
  socket.on('data', chunk => chunks.push(chunk));
  socket.on('end', async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.join(spoolDir, `ticket-${stamp}.txt`), Buffer.concat(chunks));
  });
}).listen(EMULATOR_PORT, '127.0.0.1');

http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin && !allowedOrigins.has(origin) && !origin.endsWith('.vercel.app')) {
    res.writeHead(403).end('Origem não autorizada.');
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost:3000');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  try {
    if (req.method === 'GET' && req.url === '/health') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ready: true, emulator_port: EMULATOR_PORT }));
    if (req.method === 'GET' && req.url === '/printers') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ printers: await discover() }));
    if (req.method === 'POST' && req.url === '/print') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (typeof body.text !== 'string' || body.text.length > 100_000) throw new Error('Conteúdo inválido.');
      await sendRaw(String(body.host), Number(body.port), body.text);
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ printed: true }));
    }
    res.writeHead(404).end('Não encontrado.');
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha no agente.' }));
  }
}).listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`Agente SandExpress ativo em http://127.0.0.1:${HTTP_PORT}`);
  console.log(`Impressora térmica virtual ativa em 127.0.0.1:${EMULATOR_PORT}`);
  console.log(`Tickets de teste: ${spoolDir}`);
});

