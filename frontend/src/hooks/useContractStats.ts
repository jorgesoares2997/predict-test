'use client';

import { useQuery } from '@tanstack/react-query';
import * as StellarSdk from '@stellar/stellar-sdk';

const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const MARKET_CONTRACT_ID = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID || '';
// Official Stellar Testnet USDC SAC (USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5)
const USDC_CONTRACT_ID =
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ||
  process.env.NEXT_PUBLIC_USDC_ASSET_ID ||
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

/** Returns stroops balance as a bigint from a Soroban i128 ScVal */
function scValToI128(scVal: StellarSdk.xdr.ScVal): bigint {
  try {
    const native = StellarSdk.scValToNative(scVal);
    return BigInt(native.toString());
  } catch {
    return 0n;
  }
}

/** Convert stroops (7 decimals) to a human-readable USDC string */
export function stroopsToUsdc(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = stroops % 10_000_000n;
  const fracStr = frac.toString().padStart(7, '0').replace(/0+$/, '');
  return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
}

async function fetchContractUsdcBalance(): Promise<bigint> {
  if (!MARKET_CONTRACT_ID || !USDC_CONTRACT_ID) return 0n;

  const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  const usdcContract = new StellarSdk.Contract(USDC_CONTRACT_ID);

  const dummySource = new StellarSdk.Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0'
  );

  const op = usdcContract.call(
    'balance',
    new StellarSdk.Address(MARKET_CONTRACT_ID).toScVal()
  );

  const tx = new StellarSdk.TransactionBuilder(dummySource, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: 'Test SDF Network ; September 2015',
  })
    .addOperation(op)
    .setTimeout(10)
    .build();

  try {
    const sim = await server.simulateTransaction(tx);
    if (!StellarSdk.rpc.Api.isSimulationSuccess(sim)) return 0n;
    const result = (sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse).result;
    if (!result?.retval) return 0n;
    return scValToI128(result.retval);
  } catch {
    return 0n;
  }
}

/** Fetch the on-chain total_pool for one market (stored in contract persistent storage) */
async function fetchMarketOnChainPool(marketId: string): Promise<bigint> {
  if (!MARKET_CONTRACT_ID) return 0n;

  const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  const contract = new StellarSdk.Contract(MARKET_CONTRACT_ID);

  const dummySource = new StellarSdk.Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0'
  );

  // Convert UUID to 32-byte hex buffer (same as backend marketIdToBytes32)
  const cleanUuid = marketId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(cleanUuid)) return 0n;
  const marketIdHex = cleanUuid.padEnd(64, '0'); // 32 bytes hex
  const marketIdBytes = Buffer.from(marketIdHex, 'hex');

  const op = contract.call(
    'get_market',
    StellarSdk.nativeToScVal(marketIdBytes)
  );

  const tx = new StellarSdk.TransactionBuilder(dummySource, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: 'Test SDF Network ; September 2015',
  })
    .addOperation(op)
    .setTimeout(10)
    .build();

  try {
    const sim = await server.simulateTransaction(tx);
    if (!StellarSdk.rpc.Api.isSimulationSuccess(sim)) return 0n;
    const result = (sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse).result;
    if (!result?.retval) return 0n;

    // The retval is Option<Market>, unwrap and extract total_pool field
    const native = StellarSdk.scValToNative(result.retval);
    if (!native || typeof native !== 'object') return 0n;
    const pool = native.total_pool ?? native.totalPool ?? 0;
    return BigInt(pool.toString());
  } catch {
    return 0n;
  }
}

export interface ContractStats {
  totalTvlStroops: bigint;
  totalTvlUsdc: string;
  contractId: string;
  usdcContractId: string;
  isLive: boolean;
}

export function useContractStats() {
  return useQuery<ContractStats>({
    queryKey: ['contract-stats'],
    queryFn: async () => {
      const balance = await fetchContractUsdcBalance();
      return {
        totalTvlStroops: balance,
        totalTvlUsdc: stroopsToUsdc(balance),
        contractId: MARKET_CONTRACT_ID,
        usdcContractId: USDC_CONTRACT_ID,
        isLive: balance > 0n || MARKET_CONTRACT_ID.length > 0,
      };
    },
    refetchInterval: 30_000, // refresh every 30s
    staleTime: 15_000,
  });
}

export interface MarketOnChainData {
  marketId: string;
  onChainPoolStroops: bigint;
  onChainPoolUsdc: string;
}

export function useMarketOnChainPool(marketId: string) {
  return useQuery<MarketOnChainData>({
    queryKey: ['market-on-chain-pool', marketId],
    queryFn: async () => {
      const pool = await fetchMarketOnChainPool(marketId);
      return {
        marketId,
        onChainPoolStroops: pool,
        onChainPoolUsdc: stroopsToUsdc(pool),
      };
    },
    enabled: !!marketId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
