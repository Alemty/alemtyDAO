
// public/dex/js/velodrome/constants.js

// Red objetivo (Base)
export const CHAIN_ID_BASE = 8453;

// Contrato Universal Router (Velodrome) en Base
export const VELO_UNIVERSAL_ROUTER_BASE =
  "0x01d40099fcd87c018969b0e8d4ab1633fb34763c"; // BaseScan 【1-601875】

// ⚠️ TODO (tú los llenas):
// - Dirección del token $ALEM en Base
// - Dirección WETH en Base (la versión "wrapped" de ETH en Base)
// - Dirección del pool ALEM/ETH (si ya existe) o factory para descubrirlo
export const ALEM_TOKEN_BASE = ""; // TODO: pega aquí el address
export const WETH_TOKEN_BASE = ""; // TODO: pega aquí el address

// Comandos (según documentación del Universal Router)
export const UR_COMMANDS = {
  V2_SWAP_EXACT_IN: 0x08,  // swaps tipo V2 (Velodrome V2 / Uniswap V2 style) 【3-604c8b】
  WRAP_ETH: 0x0b,          // wrap ETH->WETH 【3-604c8b】
  UNWRAP_WETH: 0x0c        // unwrap WETH->ETH 【3-604c8b】
};
