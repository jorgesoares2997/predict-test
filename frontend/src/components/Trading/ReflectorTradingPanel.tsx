'use client';

import React, { useState } from 'react';
import { Market, TransactionRecord } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { Wallet, TrendingUp, TrendingDown, Info, Copy, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useExecuteTrade } from '@/hooks/useExecuteTrade';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import apiClient from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

interface ReflectorTradingPanelProps {
  market: Market;
  openPrice?: string;
}

const CONDITION_LABEL: Record<string, string> = {
  GREATER_THAN: 'maior que (>)',
  LESS_THAN: 'menor que (<)',
  EQUAL: 'igual a (=)',
};

async function fetchReflectorPrice(asset: string): Promise<number | null> {
  try {
    const map: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'XLM': 'stellar',
      'USDC': 'usd-coin'
    };
    const id = map[asset.toUpperCase()] || asset.toLowerCase();
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const data = await res.json();
    return data[id]?.usd || null;
  } catch (error) {
    console.error('[fetchReflectorPrice] Error:', error);
    return null;
  }
}

function formatOraclePrice(raw?: string, decimals = 7): string {
  if (!raw) return '—';
  try {
    const usd = Number(BigInt(raw)) / Math.pow(10, decimals);
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return raw;
  }
}

export function ReflectorTradingPanel({ market, openPrice }: ReflectorTradingPanelProps) {
  const [amount, setAmount] = useState<string>('');
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  
  const { executeTrade, isProcessing } = useExecuteTrade();
  const { executeClaim, isProcessing: isClaiming } = useClaimWinnings();
  const { user } = useAuthStore();

  React.useEffect(() => {
    if (market.oracleAsset && !['resolved', 'settled'].includes(market.status as string)) {
      fetchReflectorPrice(market.oracleAsset).then(price => {
        if (price !== null) setLivePrice(price);
      });
      // Poll every 10 seconds
      const interval = setInterval(() => {
        fetchReflectorPrice(market.oracleAsset!).then(price => {
          if (price !== null) setLivePrice(price);
        });
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [market.oracleAsset, market.status]);

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
  
  const isSettled = market.status === 'resolved' || (market.status as string) === 'settled';

  const simOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'sim');
  const naoOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'não' || o.name.toLowerCase() === 'nao');

  let winningOutcomeId: string | undefined = undefined;
  if (isSettled && market.finalPrice) {
    const currentPrice = BigInt(market.finalPrice);
    const targetP = market.targetPrice ? BigInt(market.targetPrice) : null;
    const refP = targetP ?? (market.initialPrice ? BigInt(market.initialPrice) : null);
    const op = market.conditionOperator ?? 'GREATER_THAN';
    let conditionMet = false;
    if (refP !== null) {
      if (op === 'GREATER_THAN') conditionMet = currentPrice > refP;
      else if (op === 'LESS_THAN') conditionMet = currentPrice < refP;
      else if (op === 'EQUAL') conditionMet = currentPrice === refP;
      else conditionMet = currentPrice > refP;
    }
    winningOutcomeId = conditionMet ? simOutcome?.id : naoOutcome?.id;
  }

  const isWinner = isSettled && existingPrediction && existingPrediction.result_id === winningOutcomeId;

  const handleTrade = async () => {
    if (!selectedOutcomeId) {
      toast.error('Selecione uma opção (Sim ou Não)');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Insira um valor válido');
      return;
    }

    const result = await executeTrade({
      marketId: market.id,
      outcomeId: selectedOutcomeId, 
      amount,
    });

    if (result) {
      setAmount('');
      setSelectedOutcomeId(null);
    }
  };

  if (!user) {
    return (
      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center p-10 text-center">
          <Wallet className="h-12 w-12 text-primary/50 mb-4" />
          <h3 className="text-xl font-bold">Conecte sua Wallet</h3>
          <p className="text-muted-foreground mt-2 max-w-xs text-sm">
            Conecte sua Freighter para participar deste mercado de predição em tempo real.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedOutcomeData = market.outcomes.find(o => o.id === selectedOutcomeId);
  const averagePrice = selectedOutcomeData ? Number(selectedOutcomeData.price) : 0;
  const amountNum = parseFloat(amount) || 0;
  const shares = averagePrice > 0 ? amountNum / averagePrice : 0;
  const profitPerShare = averagePrice > 0 ? 1 - averagePrice : 0;
  const expectedProfit = shares * profitPerShare;

  return (
    <>
      <Card className="sticky top-24 overflow-hidden border-primary/20 bg-card/50 backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-primary to-red-500" />
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            Realizar Predição
          </CardTitle>
          <CardDescription>
            O preço do ativo será maior que o preço de abertura?
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Oracle resolution info panel */}
          {(market.initialPrice || market.targetPrice || market.finalPrice) && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 border border-border/50 text-xs">
              <p className="font-semibold text-muted-foreground flex items-center gap-1 uppercase tracking-widest text-[10px]">
                <Info className="h-3 w-3" /> Condição de Resolução
              </p>
              <div className="space-y-1">
                {market.initialPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço inicial ({market.oracleAsset})</span>
                    <span className="font-mono font-bold">{formatOraclePrice(market.initialPrice, market.oracleDecimals)}</span>
                  </div>
                )}
                {market.targetPrice && market.conditionOperator && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Preço alvo ({CONDITION_LABEL[market.conditionOperator]})
                    </span>
                    <span className="font-mono font-bold text-primary">{formatOraclePrice(market.targetPrice, market.oracleDecimals)}</span>
                  </div>
                )}
                {livePrice !== null && (
                  <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                    <span className="text-muted-foreground">Preço atual (CoinGecko)</span>
                    <span className="font-mono font-bold text-blue-500">${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {market.finalPrice && (
                  <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                    <span className="text-muted-foreground">Preço final (liquidação)</span>
                    <span className="font-mono font-bold text-green-500">{formatOraclePrice(market.finalPrice, market.oracleDecimals)}</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {market.conditionOperator && market.targetPrice
                  ? `"Sim" vence se o preço for ${CONDITION_LABEL[market.conditionOperator]} ${formatOraclePrice(market.targetPrice, market.oracleDecimals)} na liquidação.`
                  : 'Resolução via Oráculo Reflector (SEP-40).'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {simOutcome && (
                <Button
                  variant={selectedOutcomeId === simOutcome.id ? 'default' : 'outline'}
                  className={`h-24 flex flex-col gap-2 transition-all duration-300 ${
                    selectedOutcomeId === simOutcome.id ? 'bg-green-600 hover:bg-green-700 ring-2 ring-green-500/20' : 'hover:border-green-500/50'
                  }`}
                  onClick={() => setSelectedOutcomeId(simOutcome.id)}
                  disabled={isSettled}
                >
                  <TrendingUp className={`h-6 w-6 ${selectedOutcomeId === simOutcome.id ? 'text-white' : 'text-green-500'}`} />
                  <span className="text-lg font-black tracking-tighter uppercase">Sim</span>
                  <span className="text-xs font-bold opacity-90">{(Number(simOutcome.price) * 100).toFixed(2)}¢</span>
                </Button>
              )}

              {naoOutcome && (
                <Button
                  variant={selectedOutcomeId === naoOutcome.id ? 'default' : 'outline'}
                  className={`h-24 flex flex-col gap-2 transition-all duration-300 ${
                    selectedOutcomeId === naoOutcome.id ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-500/20' : 'hover:border-red-500/50'
                  }`}
                  onClick={() => setSelectedOutcomeId(naoOutcome.id)}
                  disabled={isSettled}
                >
                  <TrendingDown className={`h-6 w-6 ${selectedOutcomeId === naoOutcome.id ? 'text-white' : 'text-red-500'}`} />
                  <span className="text-lg font-black tracking-tighter uppercase">Não</span>
                  <span className="text-xs font-bold opacity-90">{(Number(naoOutcome.price) * 100).toFixed(2)}¢</span>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Valor da Aposta</label>
              <span className="text-[10px] text-muted-foreground">Saldo: 0.00 USDC</span>
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSettled}
                className="text-xl h-14 pl-4 pr-12 font-bold bg-muted/30 focus-visible:ring-primary/30"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">USDC</span>
            </div>

            {!isSettled && (
              <div className="flex gap-2 mt-2">
                {[1, 5, 10, 100].map(val => (
                  <Button key={val} variant="outline" size="sm" onClick={() => setAmount((amountNum + val).toString())} className="flex-1">
                    +${val}
                  </Button>
                ))}
              </div>
            )}

            {!isSettled && amountNum > 0 && selectedOutcomeData && averagePrice > 0 && (
              <div className="bg-muted/30 p-3 rounded-md text-sm space-y-1 mt-4 border border-border/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço médio</span>
                  <span>{(averagePrice * 100).toFixed(2)}¢</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ações estimadas</span>
                  <span>{shares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-primary mt-2 border-t pt-2 border-border/50">
                  <span>Lucro Potencial</span>
                  <span>+${expectedProfit.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {isSettled ? (
            existingPrediction ? (
               <div className="space-y-3">
                 <Button onClick={() => executeClaim({ marketId: market.id })} disabled={!isWinner || isClaiming || existingPrediction.tx_hash.startsWith('claim:')} className="w-full h-14 text-lg font-black uppercase tracking-widest bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20">
                   {existingPrediction.tx_hash.startsWith('claim:') ? 'Values Claimed' : isClaiming ? 'Processing...' : 'Claim Winnings / Refund'}
                 </Button>
                 <Button onClick={() => window.location.href = '/'} className="w-full h-14 text-lg font-black uppercase tracking-widest" variant="outline">
                   Make another prediction
                 </Button>
               </div>
            ) : (
               <Button disabled className="w-full h-14 text-lg font-black uppercase tracking-widest">
                 Market Settled
               </Button>
            )
          ) : (
            <Button
              onClick={handleTrade}
              disabled={Boolean(existingPrediction) || isProcessing || !amount || selectedOutcomeId === null}
              className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {existingPrediction ? 'Predição já realizada' : isProcessing ? 'Processando...' : 'Confirmar Predição'}
            </Button>
          )}

          <p className="text-[9px] text-center text-muted-foreground leading-relaxed px-4">
            Ao confirmar, você concorda com a liquidação via Oráculo Reflector (SEP-40) após 5 minutos.
          </p>
        </CardContent>
      </Card>

      {existingPrediction && (
        <Card className="mt-4 border-primary/30 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Sua predição neste mercado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Hash da Transação</p>
              <div className="flex items-start justify-between gap-2">
                <p className="break-all line-clamp-2 font-mono text-xs">{existingPrediction.tx_hash}</p>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={async () => { await navigator.clipboard.writeText(existingPrediction.tx_hash); toast.success('Hash copiada'); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <a href={`https://stellar.expert/explorer/testnet/tx/${existingPrediction.tx_hash}`} target="_blank" rel="noreferrer">
                    <Button type="button" size="icon" variant="ghost">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
            <p><span className="text-muted-foreground">Valor:</span> {existingPrediction.amount} USDC</p>
            <p><span className="text-muted-foreground">Predição:</span> {selectedPredictionName}</p>
            <p><span className="text-muted-foreground">Data:</span> {new Date(existingPrediction.created_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
