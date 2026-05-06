'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, History, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PortfolioPage() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold">Connect your wallet</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Please connect your Freighter wallet to view your positions and trading history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Portfolio</h1>
        <p className="text-muted-foreground">Manage your positions and track your performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00 USDC</div>
            <p className="text-xs text-muted-foreground mt-1">
              +0% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across 0 markets
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KYC Status</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={user?.kycStatus === 'verified' ? 'default' : 'secondary'}>
                {user?.kycStatus || 'None'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {user?.kycStatus === 'verified' ? 'Verified to trade' : 'Action required'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Positions</h2>
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium">No active positions</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              You haven't placed any trades yet. Explore the markets to get started.
            </p>
            <a href="/">
              <Button>Browse Markets</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
