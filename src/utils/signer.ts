/**
 * Ethereum Transaction Signer para Cloudflare Workers
 * Versión simplificada que delega firma a Node.js crypto nativo
 * Usa ECDH para secp256k1 + keccak256 manual
 */

// =============================================
// 1. Utilerías base
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

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte);
  }
  return result;
}

function bigIntToBytes(n: bigint, minLen: number = 0): Uint8Array {
  if (n === 0n) {
    const zero = new Uint8Array(1);
    zero[0] = 0;
    if (minLen <= 1) return zero;
    const padded = new Uint8Array(minLen);
    padded[padded.length - 1] = 0;
    return padded;
  }
  const parts: number[] = [];
  let v = n;
  while (v > 0n) {
    parts.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  const len = Math.max(parts.length, minLen);
  const result = new Uint8Array(len);
  for (let i = 0; i < parts.length; i++) {
    result[result.length - parts.length + i] = parts[i];
  }
  return result;
}

// =============================================
// 2. Keccak-256 (SHA3 con keccak padding)
// Algoritmo FIPS-202 simplificado para 256 bits
// =============================================
function keccak256(data: Uint8Array): Uint8Array {
  // Constantes del algoritmo Keccak
  const R = [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8,
    25, 43, 62, 18, 39, 61, 20, 44
  ];
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
    0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
    0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
    0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
    0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
  ];

  const rate = 136; // 1088 bits = 136 bytes for sha3-256
  const outputLen = 32; // 256 bits

  // Padding: pad10*1
  const padded = new Uint8Array(
    Math.ceil((data.length + 1) / rate) * rate + 
    (data.length % rate === rate - 1 ? rate : 0)
  );
  padded.set(data);
  padded[data.length] = 0x01; // start pad
  padded[padded.length - 1] |= 0x80; // end pad

  // State: 5x5 matrix of 64-bit words
  const state: bigint[] = new Array(25).fill(0n);

  // Absorb
  for (let i = 0; i < padded.length; i += rate) {
    for (let j = 0; j < rate; j++) {
      const x = j % 5;
      const y = Math.floor(j / 5);
      const bitPos = BigInt(padded[i + j]);
      state[x + y * 5] ^= bitPos;
    }

    // Keccak-f[1600] permutation
    for (let round = 0; round < 24; round++) {
      // θ (theta)
      const C: bigint[] = new Array(5).fill(0n);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
      }
      const D: bigint[] = new Array(5).fill(0n);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rot64(C[(x + 1) % 5], 1);
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + y * 5] ^= D[x];
        }
      }

      // ρ (rho) and π (pi)
      let X = 1, Y = 0;
      let current = state[X + Y * 5];
      for (let t = 0; t < 24; t++) {
        const newX = Y;
        const newY = (2 * X + 3 * Y) % 5;
        const temp = state[newX + newY * 5];
        state[newX + newY * 5] = rot64(current, R[t]);
        current = temp;
        X = newX;
        Y = newY;
      }

      // χ (chi)
      for (let y = 0; y < 5; y++) {
        const col: bigint[] = [];
        for (let x = 0; x < 5; x++) col.push(state[x + y * 5]);
        for (let x = 0; x < 5; x++) {
          state[x + y * 5] = col[x] ^ ((~col[(x + 1) % 5]) & col[(x + 2) % 5]);
        }
      }

      // ι (iota)
      state[0] ^= RC[round];
    }
  }

  // Squeeze
  const result = new Uint8Array(outputLen);
  for (let i = 0; i < outputLen; i++) {
    const word = state[Math.floor(i / 8) % 25];
    result[i] = Number((word >> BigInt(8 * (i % 8))) & 0xffn);
  }
  return result;
}

function rot64(x: bigint, n: number): bigint {
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & 0xffffffffffffffffn;
}

// =============================================
// 3. RLP Encoding
// =============================================
function rlpEncodeBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) return new Uint8Array([0x80]);
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  
  const len = bytes.length;
  if (len <= 55) {
    const prefix = new Uint8Array([0x80 + len]);
    return concat(prefix, bytes);
  }
  
  const lenBytes = bigIntToBytes(BigInt(len));
  const prefix = new Uint8Array([0xb7 + lenBytes.length]);
  return concat(prefix, lenBytes, bytes);
}

function rlpEncodeBigInt(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([0x80]);
  return rlpEncodeBytes(bigIntToBytes(n));
}

function rlpEncodeHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length === 0) return new Uint8Array([0x80]);
  // For even-length hex, decode; for odd, it's an error but pad
  const padded = h.length % 2 === 0 ? h : '0' + h;
  return rlpEncodeBytes(hexToBytes(padded));
}

function rlpEncodeList(items: (bigint | string)[]): Uint8Array {
  const encoded: Uint8Array[] = [];
  for (const item of items) {
    if (typeof item === 'bigint') {
      encoded.push(rlpEncodeBigInt(item));
    } else {
      encoded.push(rlpEncodeHex(item));
    }
  }
  
  const totalLen = encoded.reduce((sum, e) => sum + e.length, 0);
  const joined = concat(...encoded);
  
  if (totalLen <= 55) {
    return concat(new Uint8Array([0xc0 + totalLen]), joined);
  }
  
  const lenBytes = bigIntToBytes(BigInt(totalLen));
  const prefix = new Uint8Array([0xf7 + lenBytes.length]);
  return concat(prefix, lenBytes, joined);
}

// =============================================
// 4. secp256k1 Curve Operations
// =============================================
const P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const GX = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
const GY = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');

interface Point { x: bigint; y: bigint }

function modInverse(a: bigint, p: bigint): bigint {
  let t = 0n, newT = 1n;
  let r = p, newR = ((a % p) + p) % p;
  while (newR !== 0n) {
    const quotient = r / newR;
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }
  if (r > 1n) throw new Error('No inverse');
  return t < 0n ? t + p : t;
}

function pointAdd(p1: Point, p2: Point): Point {
  if (p1.x === 0n && p1.y === 0n) return p2;
  if (p2.x === 0n && p2.y === 0n) return p1;
  if (p1.x === p2.x) {
    if (p1.y !== p2.y) return { x: 0n, y: 0n };
    // doubling
    const m = ((3n * p1.x * p1.x) % P) * modInverse((2n * p1.y) % P, P) % P;
    const x3 = ((m * m) % P - p1.x - p1.x) % P;
    const y3 = (m * (p1.x - x3) - p1.y) % P;
    return { x: (x3 + P) % P, y: (y3 + P) % P };
  }
  const dx = ((p2.x - p1.x) % P + P) % P;
  const dy = ((p2.y - p1.y) % P + P) % P;
  const m = (dy * modInverse(dx, P)) % P;
  const x3 = ((m * m) % P - p1.x - p2.x) % P;
  const y3 = (m * (p1.x - x3) - p1.y) % P;
  return { x: (x3 + P) % P, y: (y3 + P) % P };
}

function pointMul(k: bigint, p: Point): Point {
  let result = { x: 0n, y: 0n };
  let addend = { x: p.x, y: p.y };
  let scalar = k;
  while (scalar > 0n) {
    if (scalar & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    scalar >>= 1n;
  }
  return result;
}

function derivePublicKey(pk: bigint): Point {
  return pointMul(pk, { x: GX, y: GY });
}

function publicKeyToAddress(pub: Point): string {
  const xBytes = bigIntToBytes(pub.x, 32);
  const yBytes = bigIntToBytes(pub.y, 32);
  const uncompressed = concat(new Uint8Array([0x04]), xBytes, yBytes); // 65 bytes
  const hash = keccak256(uncompressed.slice(1)); // keccak of (x || y) = 64 bytes
  const addressBytes = hash.slice(12); // last 20 bytes
  return '0x' + bytesToHex(addressBytes);
}

// =============================================
// 5. ECDSA Signing
// =============================================
function ecdsaSign(hash: Uint8Array, pk: bigint): { r: bigint; s: bigint; v: number } {
  const zBig = bytesToBigInt(hash);
  const z = zBig >= N ? (zBig >> 1n) : zBig;
  
  // Deterministic k using HMAC-like approach (simplified RFC6979)
  function generateK(attempt: number): bigint {
    const input = new TextEncoder().encode(`k-${z.toString()}-${pk.toString()}-${attempt}`);
    const hashInput = keccak256(input);
    const kVal = bytesToBigInt(hashInput);
    return (kVal % (N - 1n)) + 1n;
  }
  
  let r = 0n, s = 0n;
  for (let attempt = 0; attempt < 200 && (r === 0n || s === 0n); attempt++) {
    const k = generateK(attempt);
    const R = pointMul(k, { x: GX, y: GY });
    r = R.x % N;
    if (r === 0n) continue;
    
    const kInv = modInverse(k, N);
    s = (kInv * (z + r * pk)) % N;
    if (s === 0n) continue;
    
    // Low-S
    if (s > N / 2n) s = N - s;
  }
  
  if (r === 0n || s === 0n) throw new Error('ECDSA: falló generación de firma');
  
  // v: 27 + (s was flipped ? 1 : 0)
  const v = 27 + (s > bytesToBigInt(keccak256(new TextEncoder().encode('test'))) % (N / 2n) ? 0n : 1n);
  // Simplified: just check if original s was > N/2
  const isHighS = (s > N / 2n);
  
  return { r, s, v: 27 + (isHighS ? 0 : 1) };
}

// =============================================
// 6. Main: sign and send transaction
// =============================================
export async function signAndSendTransaction(
  privateKeyHex: string,
  txParams: {
    to: string;
    data: string;
    value?: string;
    gasLimit?: string;
    gasPrice?: string;
    nonce?: string;
    chainId?: string;
  },
  rpcUrl: string
): Promise<string> {
  const pkClean = privateKeyHex.replace('0x', '');
  const pkBytes = hexToBytes(pkClean);
  const pkBig = bytesToBigInt(pkBytes);
  
  // Derive address
  const pub = derivePublicKey(pkBig);
  const fromAddress = publicKeyToAddress(pub);
  
  // Fetch tx params if not provided
  let nonce = txParams.nonce || '0x0';
  let gasPrice = txParams.gasPrice || '0x59682f00';
  let gasLimit = txParams.gasLimit || '0x52080';
  let chainId = txParams.chainId || '0x2105';
  const value = txParams.value || '0x0';
  
  // Fetch from RPC
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [fromAddress.toLowerCase(), 'latest'] },
      { jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] },
      { jsonrpc: '2.0', id: 3, method: 'eth_chainId', params: [] }
    ].map(r => JSON.stringify(r)).join('\n'))
  });
  
  // Batch request might not work, send individually
  const [nonceRes, gasPriceRes, chainIdRes] = await Promise.all([
    fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [fromAddress.toLowerCase(), 'latest'] })
    }),
    fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] })
    }),
    fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_chainId', params: [] })
    })
  ]);
  
  const [nonceData, gasPriceData, chainIdData] = await Promise.all([
    nonceRes.json(),
    gasPriceRes.json(),
    chainIdRes.json()
  ]);
  
  if (nonceData?.result) nonce = nonceData.result;
  if (gasPriceData?.result) gasPrice = gasPriceData.result;
  if (chainIdData?.result) chainId = chainIdData.result;
  
  // Estimate gas
  try {
    const gasRes = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'eth_estimateGas', params: [{ from: fromAddress, to: txParams.to, data: txParams.data }] })
    });
    const gasData: any = await gasRes.json();
    if (gasData?.result) gasLimit = gasData.result;
  } catch (_) {}
  
  const nonceBig = BigInt(nonce);
  const gasPriceBig = BigInt(gasPrice);
  const gasLimitBig = BigInt(gasLimit);
  const valueBig = BigInt(value);
  const chainIdBig = BigInt(chainId);
  
  // Build RLP for signing: [nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]
  const rlpItems: (bigint | string)[] = [
    nonceBig,
    gasPriceBig,
    gasLimitBig,
    txParams.to.toLowerCase(),
    valueBig,
    txParams.data,
    chainIdBig,
    0n,
    0n
  ];
  
  let rlpForSigning: Uint8Array;
  try {
    rlpForSigning = rlpEncodeList(rlpItems);
  } catch (e: any) {
    throw new Error(`RLP encode for signing failed: ${e.message}`);
  }
  
  // Hash for signing
  let hash: Uint8Array;
  try {
    hash = keccak256(rlpForSigning);
  } catch (e: any) {
    throw new Error(`Keccak256 failed: ${e.message}`);
  }
  
  // Sign
  let sig: { r: bigint; s: bigint; v: number };
  try {
    sig = ecdsaSign(hash, pkBig);
  } catch (e: any) {
    throw new Error(`ECDSA sign failed: ${e.message}`);
  }
  
  // Calculate v with EIP-155: v = chainId * 2 + 35 + (s > N/2 ? 1 : 0)
  let vFinal: bigint;
  try {
    const isLowS = sig.s <= N / 2n;
    vFinal = chainIdBig * 2n + 35n + (isLowS ? 0n : 1n);
  } catch (e: any) {
    throw new Error(`v calculation failed: ${e.message}`);
  }
  
  // Build final RLP with signature: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
  let rlpFinal: Uint8Array;
  try {
    rlpFinal = rlpEncodeList([
      nonceBig,
      gasPriceBig,
      gasLimitBig,
      txParams.to.toLowerCase(),
      valueBig,
      txParams.data,
      vFinal,
      sig.r,
      sig.s
    ]);
  } catch (e: any) {
    throw new Error(`RLP encode final failed: ${e.message}`);
  }
  
  const rawTx = '0x' + bytesToHex(rlpFinal);
  
  // Send
  const sendRes = await fetch(rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'eth_sendRawTransaction', params: [rawTx] })
  });
  const sendData: any = await sendRes.json();
  
  if (sendData?.error) {
    throw new Error(`RPC: ${sendData.error.message || JSON.stringify(sendData.error)}`);
  }
  
  return sendData?.result || '';
}
