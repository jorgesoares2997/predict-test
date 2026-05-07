'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useMarket } from '@/hooks/useMarkets';
import { TradingPanel } from '@/components/Trading/TradingPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, TrendingUp, ShieldCheck, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { marketCategoryLabel } from '@/lib/marketDisplay';

export default function MarketPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: market, isLoading, error } = useMarket(id);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="lg:col-span-1">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Market not found</h2>
        <Link href="/" className="text-primary hover:underline mt-4 inline-block">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const totalShares = market.outcomes.reduce((acc, outcome) => acc + Number(outcome.totalShares || 0), 0);
  const outcomePercent = (outcome: { price: string; totalShares?: string }) => {
    const priceRatio = Number(outcome.price);
    if (Number.isFinite(priceRatio) && priceRatio > 0) {
      return Math.max(0, Math.min(100, priceRatio * 100));
    }
    if (totalShares > 0) {
      return (Number(outcome.totalShares || 0) / totalShares) * 100;
    }
    return 0;
  };

  return (
    <div className="space-y-8">
      <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Market Info & Chart */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline">{marketCategoryLabel(market)}</Badge>
              <Badge variant="secondary">{market.status}</Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">{market.title}</h1>
            <p className="text-xl text-muted-foreground">{market.description}</p>
          </div>

          {/* Simple Price Visualization (Placeholder for a real chart) */}
          <Card className="bg-card/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="h-[300px] w-full bg-gradient-to-t from-primary/5 to-transparent flex items-end p-8">
                <div className="flex-1 flex gap-4 items-end">
                  {market.outcomes.map((outcome, idx) => {
                    const percent = outcomePercent(outcome);
                    return (
                    <div key={outcome.id} className="flex-1 flex flex-col items-center gap-4">
                      <div 
                        className={`w-full rounded-t-lg ${idx === 0 ? 'bg-primary' : 'bg-muted'}`}
                        style={{ height: `${percent}%`, minHeight: '10%' }}
                      />
                      <span className="text-sm font-medium">{outcome.name} ({percent.toFixed(2)}%)</span>
                    </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-card/30 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Allocated</p>
                <p className="font-bold">${market.totalLockedValue} USDC</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-card/30 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Ends At</p>
                <p className="font-bold">{new Date(market.endsAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-card/30 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Verified</p>
                <p className="font-bold">Stellar Soroban</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Trading Panel */}
        <div className="lg:col-span-1">
          <TradingPanel market={market} />
        </div>
      </div>
    </div>
  );
}
