/**
 * Ethereum Transaction Signer - Versión mínima sin dependencias
 * Firma y envía transacciones EIP-155 usando solo Web Crypto API + crypto.getRandomValues
 */

// =============================================
// 1. Hex/bytes utilities (solo Number, sin BigInt en conversiones intermedias)
// =============================================
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function padTo32(value: Uint8Array): Uint8Array {
  if (value.length === 32) return value;
  const result = new Uint8Array(32);
  result.set(value, 32 - value.length);
  return result;
}

// =============================================
// 2. Keccak-256 (adaptado de @noble/hashes - MIT)
// Implementación inline para evitar importar paquetes
// =============================================
interface KeccakState {
  state: Uint8Array;        // 200 bytes (1600 bits)
  pos: number;
}

function keccakInit(state: Uint8Array, rate: number): void {
  // rate = 136 for keccak256 (1088 bits)
  state.fill(0, 0, 200);
}

const ROUND_CONSTANTS: bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

function ROL64(x: bigint, y: number): bigint {
  return ((x << BigInt(y)) | (x >> BigInt(64 - y))) & 0xFFFFFFFFFFFFFFFFn;
}

function keccakF1600(state: Uint8Array): void {
  // Convert 200 bytes to 25 64-bit words (little-endian)
  const a: bigint[] = new Array(25);
  for (let i = 0; i < 25; i++) {
    const off = i * 8;
    a[i] = BigInt(state[off]) | 
           (BigInt(state[off + 1]) << 8n) | 
           (BigInt(state[off + 2]) << 16n) | 
           (BigInt(state[off + 3]) << 24n) |
           (BigInt(state[off + 4]) << 32n) |
           (BigInt(state[off + 5]) << 40n) |
           (BigInt(state[off + 6]) << 48n) |
           (BigInt(state[off + 7]) << 56n);
  }

  // Rounds
  for (let round = 0; round < 24; round++) {
    // θ (theta)
    const C = new Array(5);
    for (let x = 0; x < 5; x++) {
      C[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20];
    }
    const D = new Array(5);
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x + 4) % 5] ^ ROL64(C[(x + 1) % 5], 1);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] ^= D[x];
      }
    }

    // ρ (rho) + π (pi)
    let X = 1, Y = 0;
    let current = a[X + 5 * Y];
    const rot = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43,
                 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
    for (let t = 0; t < 24; t++) {
      const nX = Y;
      const nY = (2 * X + 3 * Y) % 5;
      const temp = a[nX + 5 * nY];
      a[nX + 5 * nY] = ROL64(current, rot[(t + 1) % 25]);
      current = temp;
      X = nX;
      Y = nY;
    }

    // χ (chi)
    for (let y = 0; y < 5; y++) {
      const col: bigint[] = [];
      for (let x = 0; x < 5; x++) col.push(a[x + 5 * y]);
      for (let x = 0; x < 5; x++) {
        a[x + 5 * y] = col[x] ^ ((~col[(x + 1) % 5]) & col[(x + 2) % 5]);
      }
    }

    // ι (iota)
    a[0] ^= ROUND_CONSTANTS[round];
  }

  // Convert back to bytes
  for (let i = 0; i < 25; i++) {
    const off = i * 8;
    const v = a[i];
    state[off] = Number(v & 0xFFn);
    state[off + 1] = Number((v >> 8n) & 0xFFn);
    state[off + 2] = Number((v >> 16n) & 0xFFn);
    state[off + 3] = Number((v >> 24n) & 0xFFn);
    state[off + 4] = Number((v >> 32n) & 0xFFn);
    state[off + 5] = Number((v >> 40n) & 0xFFn);
    state[off + 6] = Number((v >> 48n) & 0xFFn);
    state[off + 7] = Number((v >> 56n) & 0xFFn);
  }
}

function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136; // 1088 bits
  const state = new Uint8Array(200);
  
  // Absorb
  let pos = 0;
  for (let i = 0; i < data.length; i++) {
    state[pos] ^= data[i];
    pos++;
    if (pos === rate) {
      keccakF1600(state);
      pos = 0;
    }
  }
  
  // Padding: 0x01 || 0x00* || 0x80
  state[pos] ^= 0x01;
  pos++;
  if (pos > rate - 1) {
    keccakF1600(state);
    pos = 0;
  }
  // Fill with zeros until last byte
  while (pos < rate - 1) {
    state[pos] = 0;
    pos++;
  }
  state[pos] ^= 0x80;
  keccakF1600(state);
  
  // Squeeze: first 32 bytes
  return state.slice(0, 32);
}

// =============================================
// 3. RLP Encoding (sin BigInt en las funciones de encoding)
// =============================================
function rlpEncodeBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) return new Uint8Array([0x80]);
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  
  if (bytes.length < 56) {
    const prefix = new Uint8Array([0x80 + bytes.length]);
    return concat(prefix, bytes);
  }
  
  // Para listas muy largas (como data de tx), usamos length como bytes
  const lenStr = bytes.length.toString(16);
  const lenBytes = hexToBytes(lenStr.length % 2 === 0 ? lenStr : '0' + lenStr);
  const prefix = new Uint8Array([0xb7 + lenBytes.length]);
  return concat(prefix, lenBytes, bytes);
}

function rlpEncodeAddress(addr: string): Uint8Array {
  const clean = addr.startsWith('0x') ? addr.slice(2) : addr;
  const bytes = hexToBytes(clean);
  // Address is always 20 bytes
  return rlpEncodeBytes(bytes);
}

function rlpEncodeData(data: string): Uint8Array {
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  if (clean.length === 0) return new Uint8Array([0x80]);
  const bytes = hexToBytes(clean.length % 2 === 0 ? clean : '0' + clean);
  return rlpEncodeBytes(bytes);
}

function rlpEncodeNumber(n: number | bigint): Uint8Array {
  if (n === 0 || n === 0n) return new Uint8Array([0x80]);
  const nStr = typeof n === 'bigint' ? n.toString(16) : Math.floor(n).toString(16);
  const bytes = hexToBytes(nStr.length % 2 === 0 ? nStr : '0' + nStr);
  return rlpEncodeBytes(bytes);
}

function rlpEncodeList(items: Uint8Array[]): Uint8Array {
  const joined = concat(...items);
  if (joined.length < 56) {
    return concat(new Uint8Array([0xc0 + joined.length]), joined);
  }
  const lenStr = joined.length.toString(16);
  const lenBytes = hexToBytes(lenStr.length % 2 === 0 ? lenStr : '0' + lenStr);
  return concat(new Uint8Array([0xf7 + lenBytes.length]), lenBytes, joined);
}

// =============================================
// 4. ECDSA secp256k1 (curva elíptica manual)
// =============================================
const P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const GX = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
const GY = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');

function modInverse(a: bigint, p: bigint): bigint {
  let t = 0n, newT = 1n;
  let r = p, newR = ((a % p) + p) % p;
  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  if (r > 1n) throw new Error('No inverse');
  return t < 0n ? t + p : t;
}

function pointAdd(p1: {x: bigint, y: bigint}, p2: {x: bigint, y: bigint}): {x: bigint, y: bigint} {
  if (p1.x === 0n && p1.y === 0n) return p2;
  if (p2.x === 0n && p2.y === 0n) return p1;
  if (p1.x === p2.x) {
    if (p1.y !== p2.y) return { x: 0n, y: 0n };
    const m = ((3n * p1.x * p1.x) % P) * modInverse((2n * p1.y) % P, P) % P;
    const x3 = ((m * m) % P - p1.x - p1.x) % P;
    const y3 = (m * (p1.x - x3) - p1.y) % P;
    return { x: x3 < 0n ? x3 + P : x3, y: y3 < 0n ? y3 + P : y3 };
  }
  const dx = p2.x > p1.x ? (p2.x - p1.x) % P : (P - (p1.x - p2.x) % P) % P;
  const dy = p2.y > p1.y ? (p2.y - p1.y) % P : (P - (p1.y - p2.y) % P) % P;
  const m = (dy * modInverse(dx, P)) % P;
  const x3 = ((m * m) % P - p1.x - p2.x) % P;
  const y3 = (m * (p1.x - x3) - p1.y) % P;
  return { x: x3 < 0n ? x3 + P : x3, y: y3 < 0n ? y3 + P : y3 };
}

function pointMul(k: bigint, p: {x: bigint, y: bigint}): {x: bigint, y: bigint} {
  let result = { x: 0n, y: 0n };
  let addend = { x: p.x, y: p.y };
  // Convert BigInt to bytes for iteration
  const kBytes = new Uint8Array(32);
  let temp = k;
  for (let i = 31; i >= 0; i--) {
    kBytes[i] = Number(temp & 0xFFn);
    temp >>= 8n;
  }
  // Iterate bits
  for (const byte of kBytes) {
    for (let b = 7; b >= 0; b--) {
      result = pointAdd(result, result);
      if ((byte >> b) & 1) {
        result = pointAdd(result, addend);
      }
    }
  }
  return result;
}

function bigIntToBytes32(n: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(n & 0xFFn);
    n >>= 8n;
  }
  return bytes;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte);
  }
  return result;
}

// =============================================
// 5. Firma ECDSA
// =============================================
function ecdsaSign(hash32: Uint8Array, privateKeyBig: bigint): { r: bigint; s: bigint; v: number } {
  const z = bytesToBigInt(hash32);
  
  // Deterministic k (simplified - usando keccak de hash+pk)
  function getK(attempt: number): bigint {
    const input = new Uint8Array(64 + 1);
    input.set(hash32, 0);
    // Copiar private key bytes (solo 32 bytes menos significativos)
    const pkBytes = bigIntToBytes32(privateKeyBig);
    input.set(pkBytes, 32);
    input[64] = attempt;
    const h = keccak256(input);
    let k = bytesToBigInt(h);
    if (k >= N) k = k - N;
    if (k === 0n) k = 1n;
    return k;
  }

  let r = 0n, s = 0n;
  for (let attempt = 0; attempt < 100 && (r === 0n || s === 0n); attempt++) {
    const k = getK(attempt);
    const R = pointMul(k, { x: GX, y: GY });
    r = R.x % N;
    if (r === 0n) continue;
    
    const kInv = modInverse(k, N);
    s = (kInv * (z + r * privateKeyBig)) % N;
    if (s === 0n) continue;
    
    // Low-S
    if (s > N / 2n) s = N - s;
  }

  if (r === 0n || s === 0n) throw new Error('ECDSA: generación de firma falló');
  
  return { r, s, v: 0 }; // v se calcula después con EIP-155
}

// =============================================
// 6. Signer principal - envía transacción via eth_sendRawTransaction
// =============================================
export async function signAndSendTransaction(
  privateKeyHex: string,
  txParams: {
    to: string;
    data: string;
    value?: string;
    from?: string; // dirección conocida, evita derivación incorrecta
  },
  rpcUrl: string
): Promise<string> {
  // 1. Parse private key
  const pkClean = privateKeyHex.replace('0x', '');
  const pkBytes = hexToBytes(pkClean.length === 64 ? pkClean : pkClean.padStart(64, '0'));
  const pkBig = bytesToBigInt(pkBytes);
  
  // 2. Use provided from address or derive it
  const fromAddress = txParams.from ? txParams.from.toLowerCase() : _deriveAddress(pkHex);
  const toAddress = txParams.to.toLowerCase();
  
  // Log para debug
  console.log("📬 Signer fromAddress:", fromAddress, "toAddress:", toAddress);
  
  // 3. Fetch chain data from RPC (try multiple RPCs)
  const rpcUrls = [
    'https://base.drpc.org',
    'https://base-rpc.publicnode.com',
    rpcUrl,
    'https://1rpc.io/base',
    'https://mainnet.base.org',
  ];
  // Eliminar duplicados
  const uniqueRpcs = [...new Set(rpcUrls)];
  
  let nonceHex = '0x0';
  let gasPriceHex = '0x59682f00';
  let chainIdHex = '0x2105';
  let gasLimitHex = '0x52080';
  let rpcFound: string | null = null;
  
  for (const rpc of uniqueRpcs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      
      const [nonceRes, gasPriceRes, chainIdRes] = await Promise.all([
        fetch(rpc, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [fromAddress, 'latest'] }),
          signal: controller.signal
        }),
        fetch(rpc, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] }),
          signal: controller.signal
        }),
        fetch(rpc, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_chainId', params: [] }),
          signal: controller.signal
        })
      ]);
      
      clearTimeout(timer);
      
      const [nonceData, gasPriceData, chainIdData]: any[] = await Promise.all([
        nonceRes.json(), gasPriceRes.json(), chainIdRes.json()
      ]);
      
      if (nonceData?.result && gasPriceData?.result && chainIdData?.result) {
        nonceHex = nonceData.result;
        gasPriceHex = gasPriceData.result;
        chainIdHex = chainIdData.result;
        rpcFound = rpc;
        
        // Also estimate gas
        try {
          const gasRes = await fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 4, method: 'eth_estimateGas',
              params: [{ from: fromAddress, to: toAddress, data: txParams.data }]
            })
          });
          const gasData: any = await gasRes.json();
          if (gasData?.result) gasLimitHex = gasData.result;
        } catch (_) {}
        
        break; // Success, stop trying
      }
    } catch (err: any) {
      console.log(`⚠️ RPC failed [${rpc}]: ${err.message?.slice(0, 60) || 'unknown'}`);
      continue; // Try next RPC
    }
  }
  
  if (!rpcFound) {
    throw new Error(`No se pudo conectar a ningún RPC de Base. Last fromAddress: ${fromAddress}`);
  }

  // 5. Parse values to BigInt
  const nonceBn = BigInt(nonceHex);
  const gasPriceBn = BigInt(gasPriceHex);
  const gasLimitBn = BigInt(gasLimitHex);
  const chainIdBn = BigInt(chainIdHex);
  const valueBn = BigInt(txParams.value || '0x0');
  
  // 6. RLP encode for signing: [nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]
  const rlpItems: Uint8Array[] = [
    rlpEncodeNumber(nonceBn),
    rlpEncodeNumber(gasPriceBn),
    rlpEncodeNumber(gasLimitBn),
    rlpEncodeAddress(toAddress),
    rlpEncodeNumber(valueBn),
    rlpEncodeData(txParams.data),
    rlpEncodeNumber(chainIdBn),
    rlpEncodeNumber(0),
    rlpEncodeNumber(0),
  ];
  const rlpForSign = rlpEncodeList(rlpItems);
  
  // 7. Keccak256 hash
  const hash = keccak256(rlpForSign);
  
  // 8. Sign
  const sig = ecdsaSign(hash, pkBig);
  
  // 9. Calculate v: v = chainId * 2 + 35
  let vBn = chainIdBn * 2n + 35n;
  // Si s > N/2, incrementamos v (low-s)
  if (sig.s > N / 2n) vBn += 1n;
  
  // 10. RLP encode final: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
  const finalItems: Uint8Array[] = [
    rlpEncodeNumber(nonceBn),
    rlpEncodeNumber(gasPriceBn),
    rlpEncodeNumber(gasLimitBn),
    rlpEncodeAddress(toAddress),
    rlpEncodeNumber(valueBn),
    rlpEncodeData(txParams.data),
    rlpEncodeNumber(vBn),
    rlpEncodeNumber(sig.r),
    rlpEncodeNumber(sig.s),
  ];
  const rlpFinal = rlpEncodeList(finalItems);
  const rawTx = '0x' + bytesToHex(rlpFinal);
  
  // 11. Send (usar el mismo RPC que funcionó para los datos)
  const sendRes = await fetch(rpcFound, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'eth_sendRawTransaction', params: [rawTx] })
  });
  const sendData: any = await sendRes.json();
  
  if (sendData?.error) {
    throw new Error(`RPC error: ${sendData.error.message || JSON.stringify(sendData.error)}`);
  }
  
  return sendData?.result || '';
}

// Función auxiliar para derivar dirección desde private key (puede tener bugs, usar con precaución)
function _deriveAddress(privateKeyHex: string): string {
  const pkClean = privateKeyHex.replace('0x', '');
  const pkBytes = hexToBytes(pkClean.length === 64 ? pkClean : pkClean.padStart(64, '0'));
  const pkBig = bytesToBigInt(pkBytes);
  const pubKeyPoint = pointMul(pkBig, { x: GX, y: GY });
  const pubKeyUncompressed = concat(
    new Uint8Array([0x04]),
    bigIntToBytes32(pubKeyPoint.x),
    bigIntToBytes32(pubKeyPoint.y)
  );
  const addressHash = keccak256(pubKeyUncompressed.slice(1));
  return '0x' + bytesToHex(addressHash.slice(12));
}
