'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/useAuthStore';
import { useTransactions } from '@/hooks/useTransactions';
import { Wallet, ListChecks, ExternalLink, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function ActivityPage() {
  const { isAuthenticated, user } = useAuthStore();
  const { data: transactions, isLoading } = useTransactions(user?.id ? { user_id: user.id } : undefined);

  const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet/tx';

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold">Connect your wallet</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Please connect your Freighter wallet to view your transaction activity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recent Activity</h1>
        <p className="text-muted-foreground">Detailed history of your transactions and market interactions.</p>
      </div>

      <Card className="bg-card/50">
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Market ID</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Transaction Hash</th>
                  <th className="px-6 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                    </tr>
                  ))
                ) : !transactions || transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <ListChecks className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground italic">No recent activity found on-chain.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">Prediction</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-foreground font-medium">
                              {tx.result?.name || 'Unknown Outcome'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[200px]">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm truncate" title={tx.market?.title}>
                            {tx.market?.title || 'Market'}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            {tx.market_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold">{tx.amount}</span> <span className="text-xs text-muted-foreground">USDC</span>
                      </td>
                      <td className="px-6 py-4">
                        <a 
                          href={`${EXPLORER_BASE}/${tx.tx_hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline font-mono"
                        >
                          {tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-8)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {tx.created_at ? format(new Date(tx.created_at), 'MMM dd, HH:mm') : '—'}
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
