'use client';

import React, { useState } from 'react';
import { Market, TransactionRecord } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useExecuteTrade } from '@/hooks/useExecuteTrade';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import { useAuthStore } from '@/store/useAuthStore';
import { Wallet, Copy, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import apiClient from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

export function TradingPanel({ market }: { market: Market }) {
  const [amount, setAmount] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const { executeTrade, isProcessing } = useExecuteTrade();
  const { executeClaim, isProcessing: isClaiming } = useClaimWinnings();
  const { user } = useAuthStore();
  const { data: userTransactions } = useQuery<TransactionRecord[]>({
    queryKey: ['user-market-transactions', user?.id, market.id],
    queryFn: async () => {
      const { data } = await apiClient.get('/transactions', {
        params: {
          user_id: user?.id,
          market_id: market.id,
        },
      });
      return data;
    },
    enabled: Boolean(user?.id),
  });
  const existingPrediction = userTransactions?.find((tx) => !tx.tx_hash.startsWith('pending:'));
  const selectedPredictionName = market.outcomes.find((o) => o.id === existingPrediction?.result_id)?.name ?? existingPrediction?.result_id;
  
  const isSettled = market.status === 'resolved' || market.status === 'settled';
  const isWinner = isSettled && existingPrediction && existingPrediction.result_id === market.resolvedOutcomeId;

  const handleTrade = async () => {
    if (!selectedOutcome) {
      toast.error('Please select an outcome');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const result = await executeTrade({
      marketId: market.id,
      outcomeId: selectedOutcome,
      amount,
    });

    if (result) {
      setAmount('');
      setSelectedOutcome(null);
    }
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

  const selectedOutcomeData = market.outcomes.find(o => o.id === selectedOutcome);
  const averagePrice = selectedOutcomeData ? Number(selectedOutcomeData.price) : 0;
  const amountNum = parseFloat(amount) || 0;
  const shares = averagePrice > 0 ? amountNum / averagePrice : 0;
  const profitPerShare = averagePrice > 0 ? 1 - averagePrice : 0;
  const expectedProfit = shares * profitPerShare;

  return (
    <>
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
                disabled={isSettled}
              >
                <span className="font-bold">{outcome.name}</span>
                <span className="text-xs opacity-70">{(Number(outcome.price) * 100).toFixed(2)}¢</span>
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
            disabled={isSettled}
          />
          {!isSettled && (
            <div className="flex gap-2 mt-2">
              {[1, 5, 10, 100].map(val => (
                <Button key={val} variant="outline" size="sm" onClick={() => setAmount((amountNum + val).toString())} className="flex-1">
                  +${val}
                </Button>
              ))}
            </div>
          )}
          
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Balance: 0.00 USDC</span>
            <span className="cursor-pointer text-primary">Max</span>
          </div>

          {!isSettled && amountNum > 0 && selectedOutcomeData && averagePrice > 0 && (
            <div className="bg-muted/30 p-3 rounded-md text-sm space-y-1 mt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço médio</span>
                <span>{(averagePrice * 100).toFixed(2)}¢</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ações estimadas</span>
                <span>{shares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-green-500 mt-2 border-t pt-2 border-border/50">
                <span>Lucro Potencial</span>
                <span>+${expectedProfit.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {isSettled ? (
          existingPrediction ? (
            isWinner ? (
               <Button onClick={() => executeClaim({ marketId: market.id })} disabled={isClaiming || existingPrediction.tx_hash.startsWith('claim:')} className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700">
                 {existingPrediction.tx_hash.startsWith('claim:') ? 'Valores Recebidos' : isClaiming ? 'Processando...' : 'Receber Valores'}
               </Button>
            ) : (
               <Button onClick={() => window.location.href = '/'} className="w-full h-12 text-lg font-bold" variant="outline">
                 Fazer outra predição
               </Button>
            )
          ) : (
             <Button disabled className="w-full h-12 text-lg font-bold">
               Mercado Finalizado
             </Button>
          )
        ) : (
          <Button
            onClick={handleTrade}
            disabled={Boolean(existingPrediction) || isProcessing || !amount || !selectedOutcome}
            className="w-full h-12 text-lg font-bold"
          >
            {existingPrediction ? 'Prediction already submitted' : isProcessing ? 'Processing...' : 'Execute Trade'}
          </Button>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          By clicking Execute Trade, you agree to the Terms of Service.
        </p>
      </CardContent>
      </Card>
      {existingPrediction && (
        <Card className="mt-4 border-primary/30 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Your prediction for this market</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Transaction hash</p>
            <div className="flex items-start justify-between gap-2">
              <p className="break-all line-clamp-2 font-mono text-xs">{existingPrediction.tx_hash}</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(existingPrediction.tx_hash);
                    toast.success('Transaction hash copied');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${existingPrediction.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button type="button" size="icon" variant="ghost">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
          <p><span className="text-muted-foreground">Amount:</span> {existingPrediction.amount} USDC</p>
          <p><span className="text-muted-foreground">Prediction:</span> {selectedPredictionName}</p>
          <p><span className="text-muted-foreground">Created at:</span> {new Date(existingPrediction.created_at).toLocaleString()}</p>
        </CardContent>
        </Card>
      )}
    </>
  );
}
