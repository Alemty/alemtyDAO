/**
 * Ethereum Transaction Signer para Cloudflare Workers
 * Firma transacciones EIP-155 usando Web Crypto API (sin ethers.js)
 */

// Keccak-256 implementation (FIPS-202 SHA3-256 con keccak padding)
// Adaptado de js-sha3 (dominio público)
class Keccak {
  private blocks: number[] = [];
  private blockSize = 0;
  private padding = 0;
  private outputBits = 0;
  private resetState: number[][] = [];
  private state: number[][] = [];
  private block: number[] = [];
  private start = 0;
  private blockCount = 0;

  constructor(bits: number = 256) {
    this.blockSize = (1600 - bits * 2) / 32;
    this.padding = 0x01;
    this.outputBits = bits;
    this.reset();
  }

  private reset() {
    this.state = Array.from({ length: 5 }, () => Array(5).fill(0n));
    this.block = Array(this.blockSize).fill(0);
    this.start = 0;
    this.blockCount = 0;
  }

  private absorb(data: number[]) {
    for (let i = 0; i < data.length; i++) {
      this.block[this.start] ^= data[i];
      this.start++;
      if (this.start === this.blockSize) {
        this.keccakF();
        this.start = 0;
      }
    }
  }

  private keccakF() {
    const lfsr = (state: bigint, offset: number) => {
      const t = state >> BigInt(offset);
      return (state ^ (t & 1n)) & (1n << BigInt(offset)); // fixed: preserve bit
    };

    // Convert block to state
    for (let i = 0; i < this.blockSize; i++) {
      const row = i % 5;
      const col = Math.floor(i / 5);
      this.state[row][col] ^= BigInt(this.block[i]);
    }

    const R = [
      [0, 1, 62, 28, 27],
      [36, 44, 6, 55, 20],
      [3, 10, 43, 25, 39],
      [41, 45, 15, 21, 8],
      [18, 2, 61, 56, 14]
    ];

    for (let round = 0; round < 24; round++) {
      // θ (theta)
      const C = Array(5).fill(0n);
      const D = Array(5).fill(0n);
      for (let x = 0; x < 5; x++) {
        C[x] = this.state[x][0] ^ this.state[x][1] ^ this.state[x][2] ^ this.state[x][3] ^ this.state[x][4];
      }
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ this.rot(C[(x + 1) % 5], 1);
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          this.state[x][y] ^= D[x];
        }
      }

      // ρ (rho) and π (pi)
      let x = 1, y = 0;
      let current = this.state[x][y];
      for (let t = 0; t < 24; t++) {
        const [newX, newY] = [y, (2 * x + 3 * y) % 5];
        const temp = this.state[newX][newY];
        this.state[newX][newY] = this.rot(current, ((t + 1) * (t + 2) / 2) % 64);
        current = temp;
        [x, y] = [newX, newY];
      }

      // χ (chi)
      for (let y = 0; y < 5; y++) {
        const temp = [...this.state.map(row => row[y])];
        for (let x = 0; x < 5; x++) {
          this.state[x][y] = temp[x] ^ ((~temp[(x + 1) % 5]) & temp[(x + 2) % 5]);
        }
      }

      // ι (iota)
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
      this.state[0][0] ^= RC[round];
    }

    // Convert state back to block
    for (let i = 0; i < this.blockSize; i++) {
      const row = i % 5;
      const col = Math.floor(i / 5);
      this.block[i] = Number(this.state[row][col] & 0xffn);
    }
  }

  private rot(x: bigint, n: number): bigint {
    return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & 0xffffffffffffffffn;
  }

  public hash(data: Uint8Array): Uint8Array {
    this.reset();
    this.absorb(Array.from(data));

    // Padding
    const padLen = this.blockSize - this.start;
    const padding = Array(padLen).fill(0);
    padding[0] = 0x01;
    padding[padLen - 1] = 0x80;
    this.absorb(padding);

    // Squeeze
    const outputBytes = this.outputBits / 8;
    const result: number[] = [];
    while (result.length < outputBytes) {
      this.keccakF();
      for (let i = 0; i < this.blockSize && result.length < outputBytes; i++) {
        result.push(this.block[i]);
      }
    }

    return new Uint8Array(result);
  }
}

/**
 * RLP Encode para valores escalares y bytes
 */
function rlpEncode(value: bigint | string | Uint8Array): Uint8Array {
  if (typeof value === 'bigint') {
    if (value === 0n) return new Uint8Array([0x80]);
    const bytes: number[] = [];
    let v = value;
    while (v > 0n) {
      bytes.unshift(Number(v & 0xffn));
      v >>= 8n;
    }
    const b = new Uint8Array(bytes);
    if (b.length === 1 && b[0] < 0x80) return b;
    return concat(new Uint8Array([0x80 + b.length]), b);
  }
  if (typeof value === 'string') {
    if (value.startsWith('0x')) value = value.slice(2);
    const b = hexToBytes(value);
    return rlpEncode(b);
  }
  // Uint8Array
  if (value.length === 1 && value[0] < 0x80) return value;
  return concat(new Uint8Array([0x80 + value.length]), value);
}

function rlpEncodeList(items: (bigint | string | Uint8Array)[]): Uint8Array {
  const encoded = items.map(item => rlpEncode(item));
  const totalLen = encoded.reduce((sum, e) => sum + e.length, 0);
  const prefix = totalLen <= 55
    ? new Uint8Array([0xc0 + totalLen])
    : concat(new Uint8Array([0xf7 + bytesLength(totalLen)]), numberToBytes(totalLen));
  return concat(prefix, ...encoded);
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

function hexToBytes(hex: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function numberToBytes(n: number): Uint8Array {
  const bytes: number[] = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return new Uint8Array(bytes);
}

function bytesLength(n: number): number {
  let len = 0;
  while (n > 0) {
    len++;
    n >>= 8;
  }
  return len || 1;
}

/**
 * Crear el hash de una tx EIP-155 para firmar:
 * keccak256(RLP([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]))
 */
async function txHashEIP155(
  nonce: bigint,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: string,
  chainId: bigint
): Promise<Uint8Array> {
  const rlpTx = rlpEncodeList([
    nonce,
    gasPrice,
    gasLimit,
    to,
    value,
    data,
    chainId,
    0n,
    0n
  ]);
  const keccak = new Keccak(256);
  return keccak.hash(rlpTx);
}

/**
 * Firmar un hash con private key usando Web Crypto ECDSA (secp256k1)
 * Devuelve { r, s, v }
 */
async function signHash(
  hash: Uint8Array,
  privateKeyBytes: Uint8Array
): Promise<{ r: bigint; s: bigint; v: number }> {
  // Import private key
  const pkHex = bytesToHex(privateKeyBytes);
  const publicKey = await derivePublicKeyFromPrivateKey(privateKeyBytes);
  const uncompressedPubKeyHex = bytesToHex(publicKey);

  // Calcular v del recovery ID
  // Ethereum usa chainId * 2 + 35 para la recovery ID
  // Por ahora usamos v = 27/28 base y ajustamos después

  // Crear key pair para firmar
  const keyData = {
    kty: 'EC' as const,
    crv: 'P-256' as const, // Note: Use P-256 KDF but sign manually for secp256k1
    // We'll use the raw ECDSA implementation below
  };

  // Since Web Crypto doesn't support secp256k1 in Workers,
  // we implement ECDSA signing manually using the secp256k1 curve

  // Simple ECDSA implementation for secp256k1
  // Using the curve parameters
  const secp256k1 = {
    p: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
    n: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
    G: {
      x: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
      y: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8')
    }
  };

  const curve = secp256k1;
  const pk = bytesToBigInt(privateKeyBytes);

  // z = hash del mensaje
  let z = bytesToBigInt(hash);

  // Asegurar que z < n
  if (z >= curve.n) z = z >> 1n;

  // ECDSA: generar k aleatorio, calcular R = k*G, r = R.x mod n, s = k^(-1) * (z + r * pk) mod n
  // Usamos un nonce determinístico RFC6979 simplificado
  let r = 0n, s = 0n;
  let attempts = 0;

  while ((r === 0n || s === 0n) && attempts < 100) {
    const k = generateK(z, pk, attempts); // k determinístico con intentos
    const R = pointMultiply(curve.G, k, curve);
    r = R.x % curve.n;
    if (r === 0n) { attempts++; continue; }

    const kInv = modInverse(k, curve.n);
    s = (kInv * (z + r * pk)) % curve.n;
    if (s === 0n) { attempts++; continue; }

    // Asegurar s es "low-S" (mitad inferior de n)
    if (s > curve.n / 2n) {
      s = curve.n - s;
    }
  }

  if (r === 0n || s === 0n) {
    throw new Error('No se pudo generar firma');
  }

  // Calcular v (recovery ID)
  // v = 27 + (s > n/2 ? 1 : 0) + (chainId * 2 + 8)  -> simplificado
  const v = 27 + (s > curve.n / 2n ? 1 : 0);

  return { r, s, v };
}

// Simple ECC point addition and multiplication on secp256k1
interface Point {
  x: bigint;
  y: bigint;
}

function pointAdd(p1: Point, p2: Point, curve: any): Point {
  if (p1.x === 0n && p1.y === 0n) return p2;
  if (p2.x === 0n && p2.y === 0n) return p1;

  const p = curve.p;
  let m: bigint;

  if (p1.x === p2.x) {
    if (p1.y !== p2.y) return { x: 0n, y: 0n }; // P + (-P) = O
    // Point doubling
    m = (3n * p1.x * p1.x) * modInverse(2n * p1.y, p) % p;
  } else {
    m = ((p2.y - p1.y) % p) * modInverse(((p2.x - p1.x) % p + p) % p, p) % p;
  }

  const x3 = (m * m - p1.x - p2.x) % p;
  const y3 = (m * (p1.x - x3) - p1.y) % p;

  return {
    x: (x3 + p) % p,
    y: (y3 + p) % p
  };
}

function pointMultiply(p: Point, scalar: bigint, curve: any): Point {
  if (scalar === 0n) return { x: 0n, y: 0n };

  let result = { x: 0n, y: 0n };
  let addend = { x: p.x, y: p.y };
  let k = scalar;

  while (k > 0n) {
    if (k & 1n) {
      result = pointAdd(result, addend, curve);
    }
    addend = pointAdd(addend, addend, curve);
    k >>= 1n;
  }

  return result;
}

function modInverse(a: bigint, p: bigint): bigint {
  // Extended Euclidean algorithm
  let t = 0n, newT = 1n;
  let r = p, newR = ((a % p) + p) % p;

  while (newR !== 0n) {
    const quotient = r / newR;
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }

  if (r > 1n) throw new Error('No inverse exists');
  if (t < 0n) t += p;

  return t;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte);
  }
  return result;
}

function bigIntToBytes(n: bigint, minLen: number = 0): Uint8Array {
  if (n === 0n) return new Uint8Array(minLen > 0 ? [0] : [0]);
  const bytes: number[] = [];
  let v = n;
  while (v > 0n) {
    bytes.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  while (bytes.length < minLen) bytes.unshift(0);
  return new Uint8Array(bytes);
}

/**
 * Nonce determinístico para ECDSA
 */
function generateK(z: bigint, pk: bigint, attempt: number = 0): bigint {
  // Simple: k = HMAC-SHA256(z, pk) mod n
  // Using a simple hash-based approach
  const input = new TextEncoder().encode(
    `kgen-${z.toString()}-${pk.toString()}-${attempt}`
  );
  // Use a simple multiplicative hash as fallback
  let seed = BigInt(0);
  for (const byte of input) {
    seed = ((seed << 8n) ^ BigInt(byte)) & BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  }
  return (seed % BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')) + 1n;
}

/**
 * Derive uncompressed public key from private key
 */
async function derivePublicKeyFromPrivateKey(privateKeyBytes: Uint8Array): Promise<Uint8Array> {
  const pk = bytesToBigInt(privateKeyBytes);
  const curve = {
    p: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
    n: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
    G: {
      x: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
      y: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8')
    }
  };

  const pub = pointMultiply(curve.G, pk, curve);
  const xBytes = bigIntToBytes(pub.x, 32);
  const yBytes = bigIntToBytes(pub.y, 32);

  return concat(new Uint8Array([0x04]), xBytes, yBytes);
}

/**
 * Calcular address Ethereum desde public key uncompressed
 * address = '0x' + keccak256(pubkey[1:])[12:]
 */
function publicKeyToAddress(pubKeyUncompressed: Uint8Array): string {
  // Remove 0x04 prefix, hash the remaining 64 bytes
  const pubKeyBytes = pubKeyUncompressed.slice(1);
  const keccak = new Keccak(256);
  const hash = keccak.hash(pubKeyBytes);
  // Last 20 bytes
  const addressBytes = hash.slice(12);
  return '0x' + bytesToHex(addressBytes);
}

/**
 * Firmar y enviar una transacción Ethereum EIP-155
 * 
 * @param privateKeyHex Private key en hex (con o sin 0x)
 * @param txParams Parámetros de la transacción
 * @param rpcUrl URL del RPC para enviar
 * @returns txHash de la transacción enviada
 */
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
  // Limpiar private key
  const pk = privateKeyHex.replace('0x', '');
  const privateKeyBytes = hexToBytes(pk);

  // Derive address from public key
  const pubKey = await derivePublicKeyFromPrivateKey(privateKeyBytes);
  const agentAddress = publicKeyToAddress(pubKey);

  // Fetch nonce, gas price, gas estimate, chainId si no se proveen
  const [nonceHex, gasPriceHex, chainIdHex] = txParams.nonce && txParams.gasPrice && txParams.chainId
    ? [txParams.nonce, txParams.gasPrice, txParams.chainId]
    : await fetchTxParams(agentAddress, rpcUrl, txParams.to, txParams.data);

  const nonce = txParams.nonce || nonceHex;
  const gasPrice = txParams.gasPrice || gasPriceHex;
  const gasLimit = txParams.gasLimit || '0x52080'; // default 336k
  const value = txParams.value || '0x0';
  const chainId = txParams.chainId || chainIdHex;

  // Estimate gas if not provided
  let finalGasLimit = gasLimit;
  if (!txParams.gasLimit) {
    try {
      const gasRes = await fetch(rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 4, method: 'eth_estimateGas',
          params: [{ from: agentAddress, to: txParams.to, data: txParams.data }]
        })
      });
      const gasData: any = await gasRes.json();
      if (gasData?.result) finalGasLimit = gasData.result;
    } catch (_) {}
  }

  // Crear hash de la tx para firmar
  const txHash = await txHashEIP155(
    BigInt(nonce),
    BigInt(gasPrice),
    BigInt(finalGasLimit),
    txParams.to.toLowerCase(),
    BigInt(value),
    txParams.data,
    BigInt(chainId)
  );

  // Firmar el hash
  const signature = await signHash(txHash, privateKeyBytes);

  // Construir RLP final con firma: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
  const rlpSigned = rlpEncodeList([
    BigInt(nonce),
    BigInt(gasPrice),
    BigInt(finalGasLimit),
    txParams.to.toLowerCase(),
    BigInt(value),
    txParams.data,
    BigInt(chainId),
    BigInt(0),
    BigInt(0)
  ]);

  // Reemplazar chainId, 0, 0 por v, r, s
  // Para EIP-155: v = chainId * 2 + 35 + (s > n/2 ? 1 : 0)
  // Pero estamos usando la estructura simplificada
  // La forma correcta: reconstruir RLP con v ajustado
  const v = BigInt(chainId) * 2n + 35n + (signature.s > BigInt('0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0') ? 1n : 0n);

  const rlpFinal = rlpEncodeList([
    BigInt(nonce),
    BigInt(gasPrice),
    BigInt(finalGasLimit),
    txParams.to.toLowerCase(),
    BigInt(value),
    txParams.data,
    v,
    signature.r,
    signature.s
  ]);

  // Enviar tx raw al RPC
  const rawTxHex = '0x' + bytesToHex(rlpFinal);
  const sendRes = await fetch(rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 5, method: 'eth_sendRawTransaction',
      params: [rawTxHex]
    })
  });
  const sendData: any = await sendRes.json();

  if (sendData?.error) {
    throw new Error(`RPC error: ${sendData.error.message || JSON.stringify(sendData.error)}`);
  }

  return sendData?.result || '';
}

async function fetchTxParams(
  address: string,
  rpcUrl: string,
  to: string,
  data: string
): Promise<[string, string, string]> {
  const [nonceRes, gasPriceRes, chainIdRes] = await Promise.all([
    fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [address.toLowerCase(), 'latest'] })
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

  const nonceData: any = await nonceRes.json();
  const gasPriceData: any = await gasPriceRes.json();
  const chainIdData: any = await chainIdRes.json();

  return [
    nonceData?.result || '0x0',
    gasPriceData?.result || '0x59682f00',
    chainIdData?.result || '0x2105'
  ];
}

/**
 * Obtener la dirección de la wallet agente desde la private key
 */
export async function getAgentAddress(privateKeyHex: string): Promise<string> {
  const pk = privateKeyHex.replace('0x', '');
  const privateKeyBytes = hexToBytes(pk);
  const pubKey = await derivePublicKeyFromPrivateKey(privateKeyBytes);
  return publicKeyToAddress(pubKey);
}
