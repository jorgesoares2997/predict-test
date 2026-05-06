'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/useAuthStore';
import { Wallet, ListChecks } from 'lucide-react';

export default function ActivityPage() {
  const { isAuthenticated } = useAuthStore();

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
                  <th className="px-6 py-4">Market</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/50">
                {/* Placeholder for empty state */}
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <ListChecks className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground italic">No recent activity found on-chain.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
