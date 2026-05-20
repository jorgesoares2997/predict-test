'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Market } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

import { useCategories } from '@/hooks/useCategories';

type OutcomeFormRow = { id?: string; name: string };

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
  initialPrice?: string;
  oracleContractAddress?: string;
  oracleDecimals?: number;
};

function toDatetimeLocal(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function buildDefaultValues(initialData?: Market): MarketFormValues {
  if (!initialData) {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return {
      title: '',
      description: 'Market created via Admin UI',
      resolutionSource: '',
      categoryId: '',
      status: 'active',
      contractAddress: '',
      closingDate: toDatetimeLocal(in24h.toISOString()),
      liquidateAt: toDatetimeLocal(in24h.toISOString()),
      outcomes: [{ name: 'Sim' }, { name: 'Não' }],
      marketType: 'standard',
      oracleContractAddress: process.env.NEXT_PUBLIC_REFLECTOR_CONTRACT_ID || '',
      oracleDecimals: 14,
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
        : [{ name: 'Sim' }, { name: 'Não' }],
    marketType: initialData.oracleAsset ? 'oracle' : 'standard',
    oracleAsset: initialData.oracleAsset ?? '',
    initialPrice: (initialData as any).initialPrice ?? '',
    oracleContractAddress: (initialData as any).oracleContractAddress ?? process.env.NEXT_PUBLIC_REFLECTOR_CONTRACT_ID ?? '',
    oracleDecimals: (initialData as any).oracleDecimals ?? 14,
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
  } = useForm<MarketFormValues>({
    defaultValues: buildDefaultValues(initialData),
  });

  useEffect(() => {
    reset(buildDefaultValues(initialData));
  }, [initialData, reset]);

  const outcomes = watch('outcomes');
  const selectedCategoryId = watch('categoryId');
  const status = watch('status');
  const marketType = watch('marketType');

  // Lógica automática: Categoria "Cripto" ativa o modo Oracle
  useEffect(() => {
    const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
    if (selectedCategory?.name.toLowerCase() === 'cripto') {
      setValue('marketType', 'oracle');
    }
  }, [selectedCategoryId, categories, setValue]);

  // Ao trocar para Oracle, forçamos os outcomes e o contrato padrão
  useEffect(() => {
    if (marketType === 'oracle') {
      setValue('outcomes', [{ name: 'Sim' }, { name: 'Não' }]);
      setValue('contractAddress', process.env.NEXT_PUBLIC_REFLECTOR_CONTRACT_ID || '');
    }
  }, [marketType, setValue]);

  const addOutcome = () => {
    setValue('outcomes', [...outcomes, { name: '' }]);
  };

  const removeOutcome = (index: number) => {
    setValue('outcomes', outcomes.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {initialData?.id && (
        <div className="space-y-2">
          <Label htmlFor="marketId">Market ID</Label>
          <Input id="marketId" value={initialData.id} readOnly className="font-mono text-xs" />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Market Title</Label>
        <Input
          id="title"
          placeholder="Will Bitcoin reach $100k by 2025?"
          {...register('title', {
            required: 'Title is required',
            minLength: { value: 5, message: 'Title must be at least 5 characters' },
          })}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <input type="hidden" {...register('description', { required: true })} />


      <div className="grid grid-cols-2 gap-4 border-y py-4 bg-muted/20 px-4 -mx-4">
        <div className="space-y-2">
          <Label htmlFor="marketType">Market Type</Label>
          <input type="hidden" {...register('marketType', { required: true })} />
          <Select value={marketType} onValueChange={(value) => setValue('marketType', value as 'standard' | 'oracle')}>
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
            <div className="space-y-2">
              <Label htmlFor="oracleAsset">Oracle Asset (Reflector Symbol)</Label>
              <Input
                id="oracleAsset"
                placeholder="Ex: BTC, ETH, SOL"
                {...register('oracleAsset', { required: marketType === 'oracle' })}
                className="bg-background font-bold"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="oracleDecimals">Decimals</Label>
                <Input
                  id="oracleDecimals"
                  type="number"
                  placeholder="14"
                  {...register('oracleDecimals', { valueAsNumber: true })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oracleContractAddress">Contract Address</Label>
                <Input
                  id="oracleContractAddress"
                  placeholder="Contract ID (C...)"
                  {...register('oracleContractAddress')}
                  className="bg-background font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <input type="hidden" {...register('categoryId', { required: 'Category is required' })} />
          <Select
            value={selectedCategoryId || null}
            onValueChange={(value) => setValue('categoryId', value ?? '')}
          >
            <SelectTrigger className="w-full">
              <span className="truncate">
                {selectedCategoryId 
                  ? categories?.find((c) => c.id === selectedCategoryId)?.name || selectedCategoryId 
                  : "Select a category"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <input type="hidden" {...register('status', { required: true })} />
          <Select value={status} onValueChange={(value) => setValue('status', value as MarketFormValues['status'])}>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="closingDate">Closing Date</Label>
          <Input
            id="closingDate"
            type="datetime-local"
            {...register('closingDate', { required: 'Closing date is required' })}
          />
          {errors.closingDate && <p className="text-xs text-destructive">{errors.closingDate.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="liquidateAt">Liquidate At</Label>
          <Input
            id="liquidateAt"
            type="datetime-local"
            {...register('liquidateAt', { required: 'Liquidation date is required' })}
          />
          {errors.liquidateAt && <p className="text-xs text-destructive">{errors.liquidateAt.message}</p>}
        </div>
      </div>


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
                {...register(`outcomes.${index}.name` as const, {
                  required: 'Outcome name is required',
                })}
                readOnly={marketType === 'oracle'}
                className={marketType === 'oracle' ? 'bg-muted font-semibold' : ''}
              />
              {outcomes.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOutcome(index)}
                  className="text-destructive"
                >
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
