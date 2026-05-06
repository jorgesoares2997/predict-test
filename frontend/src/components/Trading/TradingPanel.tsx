'use client';

import React, { useState } from 'react';
import { Market, Outcome } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useExecuteTrade } from '@/hooks/useExecuteTrade';
import { useAuthStore } from '@/store/useAuthStore';
import { Wallet } from 'lucide-react';
import { toast } from '@/lib/toast';

export function TradingPanel({ market }: { market: Market }) {
  const [amount, setAmount] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const { executeTrade, isProcessing } = useExecuteTrade();
  const { user } = useAuthStore();

  const handleTrade = async () => {
    if (!selectedOutcome) {
      toast.error('Please select an outcome');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    await executeTrade({
      marketId: market.id,
      outcomeId: selectedOutcome,
      amount,
    });
  };

  if (!user) {
    return (
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Connect Wallet to Trade</h3>
          <p className="text-muted-foreground mb-4">You need to connect your Freighter wallet to participate in this market.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Trade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">Select Outcome</label>
          <div className="grid grid-cols-2 gap-3">
            {market.outcomes.map((outcome) => (
              <Button
                key={outcome.id}
                variant={selectedOutcome === outcome.id ? 'default' : 'outline'}
                className="h-16 flex flex-col items-center justify-center gap-1"
                onClick={() => setSelectedOutcome(outcome.id)}
              >
                <span className="font-bold">{outcome.name}</span>
                <span className="text-xs opacity-70">${outcome.price} USDC</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Amount (USDC)</label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg h-12"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Balance: 0.00 USDC</span>
            <span className="cursor-pointer text-primary">Max</span>
          </div>
        </div>

        <Button
          onClick={handleTrade}
          disabled={isProcessing || !amount || !selectedOutcome}
          className="w-full h-12 text-lg font-bold"
        >
          {isProcessing ? 'Processing...' : 'Execute Trade'}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          By clicking Execute Trade, you agree to the Terms of Service.
        </p>
      </CardContent>
    </Card>
  );
}
