
// public/dex/js/velodrome/universalRouter.js

import { VELO_UNIVERSAL_ROUTER_BASE } from "./constants.js";

export const UNIVERSAL_ROUTER_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" }
    ],
    outputs: []
  }
];

export async function getEip1193Provider() {
  if (!window.ethereum) throw new Error("No se detectó wallet (window.ethereum).");
  return window.ethereum;
}

export function getUniversalRouterAddress() {
  return VELO_UNIVERSAL_ROUTER_BASE;
}

export function getUniversalRouterConfig() {
  return {
    address: getUniversalRouterAddress(),
    abi: UNIVERSAL_ROUTER_ABI
  };
}
