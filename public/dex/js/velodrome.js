
// public/dex/js/velodrome.js

import { getUniversalRouterConfig } from "./velodrome/universalRouter.js";
import { ALEM_TOKEN_BASE, WETH_TOKEN_BASE } from "./velodrome/constants.js";

export function initVelodrome() {
  const ur = getUniversalRouterConfig();

  console.log("[DEX][Velodrome] Universal Router config:", ur);
  console.log("[DEX][Velodrome] ALEM_TOKEN_BASE:", ALEM_TOKEN_BASE || "(TODO)");
  console.log("[DEX][Velodrome] WETH_TOKEN_BASE:", WETH_TOKEN_BASE || "(TODO)");

  // En la siguiente fase:
  // - agregamos ethers/viem
  // - codificamos commands + inputs para swap ALEM->ETH y ETH->ALEM
  // - y hacemos quote/preview
}

