import zlib from 'zlib';

export interface SampleArtifactPayload {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

// Pure-Node minimal PNG generator for an architectural topology wireframe schematic
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const FONT_5X7: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '{': ['00010', '00100', '00100', '01000', '00100', '00100', '00010'],
  '}': ['01000', '00100', '00100', '00010', '00100', '00100', '01000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '>': ['10000', '01000', '00100', '00010', '00100', '01000', '10000'],
};

function generateArchitectureWireframePng(): Buffer {
  const width = 800;
  const height = 440;
  const raw = Buffer.alloc(height * (1 + width * 3));

  const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const rowStart = y * (1 + width * 3);
    raw[rowStart + 1 + x * 3] = r;
    raw[rowStart + 1 + x * 3 + 1] = g;
    raw[rowStart + 1 + x * 3 + 2] = b;
  };

  const fillRect = (x0: number, y0: number, w: number, h: number, r: number, g: number, b: number) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        setPixel(x, y, r, g, b);
      }
    }
  };

  const strokeRect = (x0: number, y0: number, w: number, h: number, r: number, g: number, b: number) => {
    for (let x = x0; x < x0 + w; x++) {
      setPixel(x, y0, r, g, b);
      setPixel(x, y0 + 1, r, g, b);
      setPixel(x, y0 + h - 1, r, g, b);
      setPixel(x, y0 + h - 2, r, g, b);
    }
    for (let y = y0; y < y0 + h; y++) {
      setPixel(x0, y, r, g, b);
      setPixel(x0 + 1, y, r, g, b);
      setPixel(x0 + w - 1, y, r, g, b);
      setPixel(x0 + w - 2, y, r, g, b);
    }
  };

  const drawText = (
    text: string,
    x0: number,
    y0: number,
    scale: number,
    r: number,
    g: number,
    b: number
  ) => {
    const upper = text.toUpperCase();
    let cursorX = x0;
    for (const ch of upper) {
      const glyph = FONT_5X7[ch] ?? FONT_5X7[' '];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === '1') {
            fillRect(cursorX + col * scale, y0 + row * scale, scale, scale, r, g, b);
          }
        }
      }
      cursorX += 6 * scale;
    }
  };

  // Light slate background #F8FAFC
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width; x++) {
      setPixel(x, y, 248, 250, 252);
    }
  }

  // Subtle grid dots
  for (let y = 20; y < height; y += 24) {
    for (let x = 20; x < width; x += 24) {
      setPixel(x, y, 203, 213, 225);
    }
  }

  // Diagram Header
  drawText('ORDER FULFILLMENT TOPOLOGY - BOTTLENECK WIREFRAME', 40, 18, 2, 15, 23, 42);

  // Top Strip: API Gateway
  fillRect(40, 48, 720, 62, 255, 255, 255);
  strokeRect(40, 48, 720, 62, 37, 99, 235);
  drawText('API GATEWAY', 60, 62, 2, 15, 23, 42);
  drawText('ROUTE: GET /API/ORDERS/{CUSTOMER_ID}', 60, 84, 2, 71, 85, 105);
  fillRect(540, 64, 198, 28, 254, 242, 242);
  strokeRect(540, 64, 198, 28, 220, 38, 38);
  drawText('P99: 3420MS  4.8% ERR', 554, 72, 1, 185, 28, 28);

  // Down arrow from API Gateway -> Order Service
  fillRect(218, 110, 4, 46, 71, 85, 105);
  fillRect(212, 148, 16, 4, 71, 85, 105);
  fillRect(216, 152, 8, 4, 71, 85, 105);

  // Middle Left: Order Service
  fillRect(40, 160, 340, 112, 255, 255, 255);
  strokeRect(40, 160, 340, 112, 15, 23, 42);
  drawText('ORDER_SERVICE.PY', 58, 178, 2, 15, 23, 42);
  drawText('FASTAPI SYNC WORKER', 58, 202, 2, 71, 85, 105);
  drawText('BOTTLENECK: N+1 LOOP (24 Q/REQ)', 58, 226, 1, 185, 28, 28);
  drawText('SQL INJECTION RISK + CPU 88.4%', 58, 244, 1, 185, 28, 28);

  // Right Arrow: Order Service -> Inventory Internal
  fillRect(380, 214, 60, 4, 217, 119, 6);
  drawText('SYNC HTTP', 382, 198, 1, 180, 83, 9);

  // Middle Right: Inventory Internal Service
  fillRect(440, 160, 320, 112, 255, 251, 235);
  strokeRect(440, 160, 320, 112, 217, 119, 6);
  drawText('INVENTORY.INTERNAL', 458, 178, 2, 146, 64, 14);
  drawText('BLOCKING REQUESTS.GET()', 458, 202, 2, 180, 83, 9);
  drawText('NO TIMEOUT / NO CIRCUIT BREAKER', 458, 228, 1, 180, 83, 9);
  drawText('TARGET: ASYNC HTTPX + SEMAPHORE', 458, 246, 1, 37, 99, 235);

  // Down arrows to storage layer
  fillRect(208, 272, 4, 48, 37, 99, 235);
  fillRect(598, 272, 4, 48, 220, 38, 38);

  // Bottom Left: Primary SQLite/Postgres DB
  fillRect(40, 324, 340, 88, 239, 246, 255);
  strokeRect(40, 324, 340, 88, 37, 99, 235);
  drawText('ORDERS.DB (SQLITE/PG)', 58, 342, 2, 30, 64, 175);
  drawText('FULL TABLE SCAN - NO INDEX', 58, 368, 1, 185, 28, 28);
  drawText('FIX: INDEX (CUSTOMER_ID, CREATED_AT)', 58, 386, 1, 30, 64, 175);

  // Bottom Right: Missing Redis Cache
  fillRect(440, 324, 320, 88, 254, 242, 242);
  strokeRect(440, 324, 320, 88, 220, 38, 38);
  drawText('REDIS CACHE (MISSING)', 458, 342, 2, 185, 28, 28);
  drawText('NO READ-THROUGH STOCK CACHE', 458, 368, 1, 185, 28, 28);
  drawText('FIX: TTL CACHE + ASYNC ENRICHMENT', 458, 386, 1, 30, 64, 175);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function getHackGlobalSampleBundle(): SampleArtifactPayload[] {
  const orderServicePy = `from fastapi import FastAPI, HTTPException
import requests
import sqlite3
import time

app = FastAPI(title="Order Fulfillment Service")

def get_db():
    return sqlite3.connect("orders.db")

@app.get("/api/orders/{customer_id}")
def list_customer_orders(customer_id: str):
    conn = get_db()
    cursor = conn.cursor()
    # Bottleneck 1: Unindexed full-table scan on customer_id
    orders = cursor.execute(
        f"SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = '{customer_id}'"
    ).fetchall()

    enriched = []
    for order in orders:
        order_id = order[0]
        # Bottleneck 2: N+1 query per order
        items = cursor.execute(
            "SELECT sku, qty, unit_price FROM order_items WHERE order_id = ?",
            (order_id,),
        ).fetchall()

        # Bottleneck 3: Blocking synchronous HTTP call inside request loop without timeout/circuit breaker
        inventory_resp = requests.get(f"http://inventory.internal/v1/stock/{order_id}")
        enriched.append({
            "order_id": order_id,
            "status": order[1],
            "total_cents": order[2],
            "items": items,
            "warehouse": inventory_resp.json() if inventory_resp.status_code == 200 else None,
        })

    conn.close()
    return {"customer_id": customer_id, "orders": enriched}
`;

  const latencyCsv = `endpoint,p50_ms,p95_ms,p99_ms,db_queries_per_req,error_rate_pct,cpu_pct
/api/orders/{customer_id},420,1890,3420,24,4.8,88.4
/api/checkout/confirm,95,240,410,3,0.4,34.1
/api/inventory/sync,140,510,890,6,1.2,49.0
/api/auth/session,12,28,45,1,0.0,11.2
/api/webhooks/stripe,64,155,260,2,0.1,21.5
`;

  const specMd = `# Sprint 14 Architecture & Remediation Spec

## Context
Production telemetry indicates severe tail latency (p99 = 3.42s) and 4.8% HTTP 500 error spikes on \`GET /api/orders/{customer_id}\`.

## Requirements
1. Eliminate SQL injection vulnerability and add composite index on \`orders(customer_id, created_at DESC)\`.
2. Replace N+1 query pattern with batched \`JOIN\` or \`WHERE order_id IN (...)\` query.
3. Convert blocking \`requests.get\` inventory enrichment to async \`httpx.AsyncClient\` with concurrency limits, timeouts, and Redis read-through caching.
4. Generate a GitHub Actions CI workflow (pytest + ruff + bandit security scan) and stage sprint execution tickets.
`;

  return [
    {
      fileName: 'order_service.py',
      mimeType: 'text/plain',
      buffer: Buffer.from(orderServicePy, 'utf8'),
    },
    {
      fileName: 'latency_telemetry.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(latencyCsv, 'utf8'),
    },
    {
      fileName: 'architecture_spec.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(specMd, 'utf8'),
    },
    {
      fileName: 'service_topology_wireframe.png',
      mimeType: 'image/png',
      buffer: generateArchitectureWireframePng(),
    },
  ];
}
