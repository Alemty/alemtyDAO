/**
 * Ethereum Transaction Signer para Cloudflare Workers
 * Usa viem (soporta Workers nativamente)
 */
import {
  createWalletClient,
  http,
  parseEther,
  encodeFunctionData,
  type Hex
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export async function signAndSendTransaction(
  privateKeyHex: string,
  txParams: {
    to: string;
    data: string;
    value?: string;
  },
  rpcUrl: string
): Promise<string> {
  const account = privateKeyToAccount(privateKeyHex as Hex);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  const hash = await walletClient.sendTransaction({
    account,
    to: txParams.to as Hex,
    data: txParams.data as Hex,
    value: txParams.value ? parseEther(txParams.value) : 0n,
    chain: base,
  });

  return hash;
}
