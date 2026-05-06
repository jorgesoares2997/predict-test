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
      description: '',
      resolutionSource: '',
      categoryId: '',
      status: 'active',
      contractAddress: '',
      closingDate: toDatetimeLocal(in24h.toISOString()),
      liquidateAt: toDatetimeLocal(in24h.toISOString()),
      outcomes: [{ name: 'Yes' }, { name: 'No' }],
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

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Provide more context about the market and resolution criteria..."
          {...register('description', {
            required: 'Description is required',
            minLength: { value: 10, message: 'Description must be at least 10 characters' },
          })}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="resolutionSource">Resolution Source (URL)</Label>
        <Input
          id="resolutionSource"
          type="url"
          placeholder="https://example.com/how-this-market-resolves"
          {...register('resolutionSource', {
            required: 'Resolution URL is required',
            pattern: {
              value: /^https?:\/\/.+/i,
              message: 'Enter a valid http(s) URL',
            },
          })}
        />
        {errors.resolutionSource && (
          <p className="text-xs text-destructive">{errors.resolutionSource.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <input type="hidden" {...register('categoryId', { required: 'Category is required' })} />
          <Select
            value={selectedCategoryId?.trim() ? selectedCategoryId : undefined}
            onValueChange={(value) => setValue('categoryId', value ?? '')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category" />
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

      <div className="space-y-2">
        <Label htmlFor="contractAddress">Contract Address</Label>
        <Input
          id="contractAddress"
          placeholder="Optional contract address"
          {...register('contractAddress')}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Outcomes</Label>
          <Button type="button" variant="outline" size="sm" onClick={addOutcome}>
            <Plus className="mr-2 h-4 w-4" /> Add Outcome
          </Button>
        </div>

        <div className="space-y-3">
          {outcomes.map((outcome, index) => (
            <div key={`${outcome.id ?? 'new'}-${index}`} className="flex gap-2">
              <Input
                placeholder={`Outcome ${index + 1}`}
                {...register(`outcomes.${index}.name` as const, {
                  required: 'Outcome name is required',
                })}
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
