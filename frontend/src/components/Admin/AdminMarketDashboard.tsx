'use client';

import React, { useState } from 'react';
import { useMarkets } from '@/hooks/useMarkets';
import { useContractStats, useMarketOnChainPool, stroopsToUsdc } from '@/hooks/useContractStats';
import { useTransactions } from '@/hooks/useTransactions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  BarChart3,
  Activity,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Database,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { marketCategoryLabel } from '@/lib/marketDisplay';
import { Market } from '@/types';
import { motion } from 'framer-motion';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet/contract';

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'ACTIVE' || status === 'active') return 'default';
  if (status === 'LOCKED' || status === 'locked') return 'secondary';
  return 'outline';
}

function statusIcon(status: string) {
  if (status === 'ACTIVE' || status === 'active') return <Activity className="h-3 w-3" />;
  if (status === 'LOCKED' || status === 'locked') return <Lock className="h-3 w-3" />;
  return <CheckCircle2 className="h-3 w-3" />;
}

function shortAddress(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card/50 backdrop-blur-sm">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${accent ?? 'hsl(var(--primary))'}, transparent 70%)` }}
      />
      <CardContent className="p-5 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-28 mt-1" />
          ) : (
            <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
          )}
          {sub && !loading && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Market Row (with live on-chain pool) ─────────────────────────────────────

function MarketDashboardRow({ market, index }: { market: Market; index: number }) {
  const { data: onChain, isLoading: poolLoading } = useMarketOnChainPool(market.id);

  const dbValue = Number(market.totalLockedValue ?? 0);
  const onChainValue = onChain ? Number(onChain.onChainPoolUsdc) : null;

  const totalShares = market.outcomes.reduce((sum, o) => sum + Number(o.totalShares ?? 0), 0);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0"
    >
      {/* Market */}
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-sm leading-tight">{market.title}</span>
            <span className="text-xs text-muted-foreground">{marketCategoryLabel(market)}</span>
          </div>
          <Link
            href={`/markets/${market.id}`}
            target="_blank"
            className="p-1.5 rounded-lg bg-muted/50 hover:bg-primary/20 hover:text-primary transition-all group/link"
            title="View Market Page"
          >
            <ArrowUpRight className="h-3.5 w-3.5 group-hover/link:scale-110 transition-transform" />
          </Link>
        </div>
      </td>

      {/* Status */}
      <td className="p-4">
        <Badge variant={statusVariant(market.status)} className="gap-1 text-xs">
          {statusIcon(market.status)}
          {market.status.toUpperCase()}
        </Badge>
      </td>

      {/* Outcomes */}
      <td className="p-4">
        <div className="flex flex-wrap gap-1">
          {market.outcomes.map((o) => {
            const pct = totalShares > 0 ? ((Number(o.totalShares ?? 0) / totalShares) * 100).toFixed(1) : '0.0';
            return (
              <span
                key={o.id}
                className="text-xs bg-muted/60 px-2 py-0.5 rounded-full border border-border/40"
                title={`${pct}%`}
              >
                {o.name} <span className="text-muted-foreground">{pct}%</span>
              </span>
            );
          })}
        </div>
      </td>

      {/* DB Locked Value */}
      <td className="p-4">
        <span className="font-mono text-sm font-semibold">{dbValue.toFixed(2)}</span>
        <span className="text-xs text-muted-foreground ml-1">USDC</span>
      </td>

      {/* On-Chain Pool */}
      <td className="p-4">
        {poolLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : onChainValue !== null ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-semibold text-emerald-400">{onChainValue.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">USDC</span>
            {onChainValue > 0 && <ShieldCheck className="h-3 w-3 text-emerald-400" />}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Closes At */}
      <td className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {format(new Date(market.endsAt), 'MMM dd, yyyy')}
        </div>
      </td>

      {/* Contract link */}
      <td className="p-4 text-right">
        {market.contractAddress ? (
          <a
            href={`${EXPLORER_BASE}/${market.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {shortAddress(market.contractAddress)}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Not deployed</span>
        )}
      </td>
    </motion.tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminMarketDashboard() {
  const { data: markets, isLoading: marketsLoading, refetch } = useMarkets();
  const { data: contractStats, isLoading: statsLoading, refetch: refetchStats } = useContractStats();
  const { data: transactions, isLoading: txsLoading, refetch: refetchTxs } = useTransactions();
  const [refreshing, setRefreshing] = useState(false);

  const MARKET_CONTRACT_ID = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID || '';
  const USDC_CONTRACT_ID =
    process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ||
    process.env.NEXT_PUBLIC_USDC_ASSET_ID ||
    'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetch(), refetchStats(), refetchTxs()]);
    setRefreshing(false);
  }

  // Compute aggregate stats from DB
  const totalMarkets = markets?.length ?? 0;
  const activeMarkets = markets?.filter((m) => m.status.toLowerCase() === 'active').length ?? 0;
  const resolvedMarkets = markets?.filter((m) => m.status.toLowerCase() === 'resolved').length ?? 0;
  const totalDbTvl = markets?.reduce((sum, m) => sum + Number(m.totalLockedValue ?? 0), 0) ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Live analytics and on-chain stats for all prediction markets.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Contract Overview Cards ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-1 w-6 bg-primary rounded-full" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contract Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Wallet className="h-5 w-5" />}
            label="Total Value Locked (On-Chain)"
            value={`${contractStats?.totalTvlUsdc ?? '0'} USDC`}
            sub="Live from Soroban RPC"
            loading={statsLoading}
            accent="hsl(142, 71%, 45%)"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Total Value Locked (Database)"
            value={`${totalDbTvl.toFixed(2)} USDC`}
            sub="Aggregated from all markets"
            loading={marketsLoading}
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="Active Markets"
            value={`${activeMarkets} / ${totalMarkets}`}
            sub={`${resolvedMarkets} resolved`}
            loading={marketsLoading}
          />
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Resolved Markets"
            value={String(resolvedMarkets)}
            sub="Fully settled on-chain"
            loading={marketsLoading}
          />
        </div>
      </div>

      {/* ── Contract Addresses ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border/60 bg-card/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Market Contract
            </CardTitle>
            <CardDescription className="text-xs">Soroban PredictionMarket contract</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                {MARKET_CONTRACT_ID || 'Not configured'}
              </code>
              {MARKET_CONTRACT_ID && (
                <a
                  href={`${EXPLORER_BASE}/${MARKET_CONTRACT_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              USDC Token (Official Testnet)
            </CardTitle>
            <CardDescription className="text-xs">
              Circle's USDC SAC — USDC:GBBD47IF…LFLA5
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                {USDC_CONTRACT_ID}
              </code>
              <a
                href={`${EXPLORER_BASE}/${USDC_CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Per-Market Table ────────────────────────────────────────────── */}
      <Card className="border border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Per-Market Breakdown
              </CardTitle>
              <CardDescription className="mt-1">
                DB values vs live on-chain pool per market. On-chain data fetched via Soroban RPC simulation.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-y border-border/50">
                <tr>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Market</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Status</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Outcomes</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">DB Value</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">On-Chain Pool</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Closes At</th>
                  <th className="h-10 px-4 text-right font-medium text-muted-foreground">Contract</th>
                </tr>
              </thead>
              <tbody>
                {marketsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="p-4">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !markets || markets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-32 text-center text-muted-foreground">
                      No markets found. Create your first market in the Market Management tab.
                    </td>
                  </tr>
                ) : (
                  markets.map((market, idx) => (
                    <MarketDashboardRow key={market.id} market={market} index={idx} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── TVL by Market Bar Chart ─────────────────────────────────────── */}
      {markets && markets.length > 0 && (
        <Card className="border border-border/60">
          <CardHeader>
            <CardTitle className="text-base">TVL Distribution by Market</CardTitle>
            <CardDescription>Relative share of total locked value per market (from database)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {markets.map((market) => {
              const val = Number(market.totalLockedValue ?? 0);
              const pct = totalDbTvl > 0 ? (val / totalDbTvl) * 100 : 0;
              return (
                <div key={market.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-xs">{market.title}</span>
                    <span className="text-muted-foreground ml-4 flex-shrink-0">
                      {val.toFixed(2)} USDC ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-primary/70 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      {/* ── Recent Platform Transactions ─────────────────────────────────── */}
      <Card className="border border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Recent Platform Predictions
              </CardTitle>
              <CardDescription>
                Live stream of all predictions across all markets.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-y border-border/50">
                <tr>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">User ID</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Market ID</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Hash</th>
                  <th className="h-10 px-4 text-right font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {txsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="p-4"><Skeleton className="h-5 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : !transactions || transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-32 text-center text-muted-foreground">
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-mono text-[10px] text-muted-foreground">
                        {tx.user_id.slice(0, 8)}...
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium truncate max-w-[150px]">
                            {tx.market?.title || 'Market'}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {tx.result?.name || 'Outcome'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold">
                        {tx.amount} <span className="text-[10px] text-muted-foreground ml-0.5">USDC</span>
                      </td>
                      <td className="p-4">
                        <a 
                          href={`https://stellar.expert/explorer/testnet/tx/${tx.tx_hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline font-mono"
                        >
                          {tx.tx_hash.slice(0, 6)}...{tx.tx_hash.slice(-6)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="p-4 text-right text-xs text-muted-foreground">
                        {tx.created_at ? format(new Date(tx.created_at), 'MMM dd HH:mm') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
