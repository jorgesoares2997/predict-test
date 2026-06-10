'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Market } from '@/types';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Clock, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';

type OutcomeFormRow = { id?: string; name: string };
type ConditionOperator = 'GREATER_THAN' | 'LESS_THAN' | 'EQUAL';
type DateMode = 'counter' | 'calendar';

type MarketFormValues = {
  id?: string;
  title: string;
  description: string;
  resolutionSource: string;
  categoryId: string;
  status: 'active' | 'locked' | 'resolved';
  contractAddress: string;
  closingDate: string;
  liquidateAt: string;
  outcomes: OutcomeFormRow[];
  marketType: 'standard' | 'oracle';
  oracleAsset?: string;
  targetPrice?: string;
  conditionOperator?: ConditionOperator;
  oracleDecimals?: number;
};

// Offset presets in minutes
const COUNTER_PRESETS = [
  { label: '+5 min',  minutes: 5 },
  { label: '+10 min', minutes: 10 },
  { label: '+1 h',   minutes: 60 },
  { label: '+4 h',   minutes: 240 },
  { label: '+1 day', minutes: 1440 },
];

const REFLECTOR_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REFLECTOR_CONTRACT_ID ||
  'CBNBAFKPT54W4HYECFNLF5RLICUZPNK6LXHM6BKUECN3SWXFHQPB56Y';
const REFLECTOR_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-mainnet.stellar.org';
const REFLECTOR_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
// Dummy source account for read-only Soroban simulation (no real funds needed)
const SIMULATION_SOURCE = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

async function fetchReflectorPrice(asset: string): Promise<number | null> {
  try {
    const res = await fetch(`http://127.0.0.1:8080/api/oracle/price/${encodeURIComponent(asset)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.raw) return null;
    const decimals = data.decimals ?? 7;
    return Number(BigInt(data.raw)) / Math.pow(10, decimals);
  } catch (error) {
    console.error('[fetchReflectorPrice] Error:', error);
    return null;
  }
}

function toDatetimeLocal(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(base: Date, minutes: number): string {
  return toDatetimeLocal(new Date(base.getTime() + minutes * 60_000).toISOString());
}

function buildDefaultValues(initialData?: Market): MarketFormValues {
  if (!initialData) {
    const now = new Date();
    return {
      title: '',
      description: 'Market created via Admin UI',
      resolutionSource: '',
      categoryId: '',
      status: 'active',
      contractAddress: '',
      closingDate: addMinutes(now, 5),
      liquidateAt: addMinutes(now, 6),
      outcomes: [{ name: 'Yes' }, { name: 'No' }],
      marketType: 'standard',
      oracleDecimals: 7,
      targetPrice: '',
      conditionOperator: 'GREATER_THAN',
    };
  }

  return {
    id: initialData.id,
    title: initialData.title ?? '',
    description: initialData.description ?? '',
    resolutionSource: initialData.resolutionSource ?? '',
    categoryId: initialData.categoryId ?? initialData.category?.id ?? '',
    status: initialData.status ?? 'active',
    contractAddress: initialData.contractAddress ?? '',
    closingDate: toDatetimeLocal(initialData.endsAt),
    liquidateAt: toDatetimeLocal(initialData.liquidateAt ?? initialData.endsAt),
    outcomes:
      initialData.outcomes?.length > 0
        ? initialData.outcomes.map((o) => ({ id: o.id, name: o.name }))
        : [{ name: 'Yes' }, { name: 'No' }],
    marketType: initialData.oracleAsset ? 'oracle' : 'standard',
    oracleAsset: initialData.oracleAsset ?? '',
    targetPrice: (initialData as any).targetPrice 
      ? String(Number((initialData as any).targetPrice) / Math.pow(10, (initialData as any).oracleDecimals ?? 7))
      : '',
    conditionOperator: (initialData as any).conditionOperator ?? 'GREATER_THAN',
    oracleDecimals: (initialData as any).oracleDecimals ?? 7,
  };
}

interface MarketFormProps {
  initialData?: Market;
  onSubmit: (data: MarketFormValues) => void;
  isLoading?: boolean;
}

export function MarketForm({ initialData, onSubmit, isLoading }: MarketFormProps) {
  const { data: categories } = useCategories();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MarketFormValues>({ defaultValues: buildDefaultValues(initialData) });

  useEffect(() => { reset(buildDefaultValues(initialData)); }, [initialData, reset]);

  // Local UI state
  const [dateMode, setDateMode] = useState<DateMode>('counter');
  const [selectedPreset, setSelectedPreset] = useState<number>(5); // minutes
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceFetching, setPriceFetching] = useState(false);

  const outcomes        = watch('outcomes');
  const selectedCategoryId = watch('categoryId');
  const status          = watch('status');
  const marketType      = watch('marketType');
  const conditionOperator = watch('conditionOperator');
  const oracleAsset     = watch('oracleAsset');

  // Auto-set oracle mode when Cripto category selected
  useEffect(() => {
    const cat = categories?.find(c => c.id === selectedCategoryId);
    if (cat?.name.toLowerCase() === 'cripto') setValue('marketType', 'oracle');
  }, [selectedCategoryId, categories, setValue]);

  // Reset outcomes to Yes/No in oracle mode
  useEffect(() => {
    if (marketType === 'oracle') setValue('outcomes', [{ name: 'Yes' }, { name: 'No' }]);
  }, [marketType, setValue]);

  // Fetch live price from Reflector mainnet when oracleAsset changes
  const fetchLivePrice = useCallback(async (asset: string) => {
    if (!asset || asset.length < 2) { setLivePrice(null); return; }
    setPriceFetching(true);
    try {
      const price = await fetchReflectorPrice(asset);
      setLivePrice(price);
      if (price !== null) {
        setValue('targetPrice', String(price));
      }
    } finally {
      setPriceFetching(false);
    }
  }, [setValue]);

  useEffect(() => {
    if (marketType === 'oracle' && oracleAsset && oracleAsset.length >= 2) {
      const upperAsset = oracleAsset.toUpperCase();
      let decimals = 7;
      if (upperAsset === 'BTC') decimals = 6;
      else if (upperAsset === 'ETH') decimals = 10;
      setValue('oracleDecimals', decimals);

      const timer = setTimeout(() => fetchLivePrice(oracleAsset), 500);
      return () => clearTimeout(timer);
    } else {
      setLivePrice(null);
    }
  }, [oracleAsset, marketType, fetchLivePrice, setValue]);

  // Apply counter preset — closing = now + preset, liquidate = closing + 1 min
  const applyPreset = useCallback((minutes: number) => {
    setSelectedPreset(minutes);
    const now = new Date();
    const closing = addMinutes(now, minutes);
    const liquidate = addMinutes(now, minutes + 1);
    setValue('closingDate', closing);
    setValue('liquidateAt', liquidate);
  }, [setValue]);

  // Whenever closing date changes in calendar mode, auto-set liquidate = closing + 1 min
  const handleClosingDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue('closingDate', val);
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) setValue('liquidateAt', addMinutes(d, 1));
    }
  };

  // Initialize counter preset on mount
  useEffect(() => {
    if (!initialData && dateMode === 'counter') applyPreset(5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addOutcome    = () => setValue('outcomes', [...outcomes, { name: '' }]);
  const removeOutcome = (i: number) => setValue('outcomes', outcomes.filter((_, idx) => idx !== i));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {initialData?.id && (
        <div className="space-y-2">
          <Label>Market ID</Label>
          <Input value={initialData.id} readOnly className="font-mono text-xs" />
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Market Title</Label>
        <Input
          id="title"
          placeholder="Will Bitcoin reach $100k by end of month?"
          {...register('title', {
            required: 'Title is required',
            minLength: { value: 5, message: 'Title must be at least 5 characters' },
          })}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <input type="hidden" {...register('description', { required: true })} />

      {/* Market type + oracle fields */}
      <div className="grid grid-cols-2 gap-4 border-y py-4 bg-muted/20 px-4 -mx-4">
        <div className="space-y-2">
          <Label>Market Type</Label>
          <input type="hidden" {...register('marketType', { required: true })} />
          <Select value={marketType} onValueChange={(v) => setValue('marketType', v as 'standard' | 'oracle')}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard (Manual)</SelectItem>
              <SelectItem value="oracle">Oracle (Reflector)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {marketType === 'oracle' && (
          <div className="col-span-2 space-y-4">

            {/* Asset input + live price badge */}
            <div className="space-y-2">
              <Label htmlFor="oracleAsset">Asset</Label>
              <div className="relative">
                <Input
                  id="oracleAsset"
                  placeholder="BTC, ETH, SOL…"
                  {...register('oracleAsset', { required: marketType === 'oracle' })}
                  className="bg-background font-bold uppercase pr-32"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {priceFetching ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> fetching…
                    </span>
                  ) : livePrice !== null ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/30 px-2 py-0.5 text-xs font-bold text-green-500">
                      <TrendingUp className="h-3 w-3" />
                      ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <input type="hidden" {...register('oracleDecimals', { valueAsNumber: true })} />

            {/* Target price + condition */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetPrice">
                  Target Price (USD)
                  {livePrice !== null && (
                    <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                      current: ${livePrice.toLocaleString()}
                    </span>
                  )}
                </Label>
                <Input
                  id="targetPrice"
                  placeholder={livePrice ? String(livePrice) : 'e.g. 73000'}
                  {...register('targetPrice')}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <input type="hidden" {...register('conditionOperator')} />
                <Select
                  value={conditionOperator}
                  onValueChange={(v) => setValue('conditionOperator', v as ConditionOperator)}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GREATER_THAN">Greater than (&gt;)</SelectItem>
                    <SelectItem value="LESS_THAN">Less than (&lt;)</SelectItem>
                    <SelectItem value="EQUAL">Equal to (=)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Category + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <input type="hidden" {...register('categoryId', { required: 'Category is required' })} />
          <Select value={selectedCategoryId || ''} onValueChange={(v) => setValue('categoryId', v ?? '')}>
            <SelectTrigger className="w-full">
              <span className="truncate">
                {selectedCategoryId
                  ? categories?.find(c => c.id === selectedCategoryId)?.name || selectedCategoryId
                  : 'Select a category'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {categories?.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <input type="hidden" {...register('status', { required: true })} />
          <Select value={status} onValueChange={(v) => setValue('status', v as MarketFormValues['status'])}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="locked">locked</SelectItem>
              <SelectItem value="resolved">resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Closing date — counter or calendar */}
      <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Market Duration</Label>
          {/* Mode toggle */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => { setDateMode('counter'); applyPreset(selectedPreset); }}
              className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${
                dateMode === 'counter'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Clock className="h-3 w-3" /> Quick
            </button>
            <button
              type="button"
              onClick={() => setDateMode('calendar')}
              className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${
                dateMode === 'calendar'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Calendar className="h-3 w-3" /> Custom
            </button>
          </div>
        </div>

        {dateMode === 'counter' ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Market closes in… (liquidation auto-set to 1 min after close)
            </p>
            <div className="flex gap-2 flex-wrap">
              {COUNTER_PRESETS.map(({ label, minutes }) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => applyPreset(minutes)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
                    selectedPreset === minutes
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                      : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Show computed values as read-only */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Closes at</p>
                <Input
                  readOnly
                  value={watch('closingDate')}
                  className="bg-muted text-xs font-mono cursor-default"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Liquidates at</p>
                <Input
                  readOnly
                  value={watch('liquidateAt')}
                  className="bg-muted text-xs font-mono cursor-default"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="closingDate">Closing Date</Label>
              <Input
                id="closingDate"
                type="datetime-local"
                value={watch('closingDate')}
                onChange={handleClosingDateChange}
              />
              {errors.closingDate && <p className="text-xs text-destructive">{errors.closingDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="liquidateAt">
                Liquidate At
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(auto: close + 1 min)</span>
              </Label>
              <Input
                id="liquidateAt"
                type="datetime-local"
                {...register('liquidateAt', { required: 'Liquidation date is required' })}
              />
            </div>
          </div>
        )}

        {/* Hidden fields always registered */}
        <input type="hidden" {...register('closingDate',  { required: 'Closing date is required' })} />
        <input type="hidden" {...register('liquidateAt',  { required: 'Liquidation date is required' })} />
      </div>

      {/* Outcomes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Outcomes</Label>
          {marketType === 'standard' && (
            <Button type="button" variant="outline" size="sm" onClick={addOutcome}>
              <Plus className="mr-2 h-4 w-4" /> Add Outcome
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {outcomes.map((outcome, index) => (
            <div key={`${outcome.id ?? 'new'}-${index}`} className="flex gap-2">
              <Input
                placeholder={`Outcome ${index + 1}`}
                {...register(`outcomes.${index}.name` as const, { required: 'Outcome name is required' })}
                readOnly={marketType === 'oracle'}
                className={marketType === 'oracle' ? 'bg-muted font-semibold' : ''}
              />
              {outcomes.length > 2 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeOutcome(index)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {errors.outcomes && <p className="text-xs text-destructive">{errors.outcomes.message as string}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : initialData ? 'Update Market' : 'Create Market'}
      </Button>
    </form>
  );
}
