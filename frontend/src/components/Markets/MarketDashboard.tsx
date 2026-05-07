'use client';

import React, { useState } from 'react';
import { useMarkets } from '@/hooks/useMarkets';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Market } from '@/types';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp } from 'lucide-react';

import { useCategories } from '@/hooks/useCategories';
import { marketCategoryLabel } from '@/lib/marketDisplay';

export function MarketDashboard() {
  const [category, setCategory] = useState<string>('all');
  const { data: categories } = useCategories();
  const { data: markets, isLoading } = useMarkets({ 
    category: category === 'all' ? undefined : category 
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="bg-card/50 border-muted">
            <CardHeader>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Dashboard</h1>
          <p className="text-muted-foreground">Predict the future and earn rewards on Stellar.</p>
        </div>
        
        <Tabs defaultValue="all" onValueChange={setCategory} className="w-full md:w-auto">
          <TabsList className="bg-muted/50 overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories?.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.name}>
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <motion.div 
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {markets?.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </motion.div>
    </div>
  );
}

function MarketCard({ market }: { market: Market }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={`/markets/${market.id}`}>
        <Card className="h-full hover:border-primary/50 transition-all cursor-pointer group bg-card hover:bg-accent/5 overflow-hidden">
          <CardHeader>
            <div className="flex justify-between items-start mb-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {marketCategoryLabel(market)}
              </Badge>
              <Badge variant={market.status === 'active' ? 'default' : 'secondary'}>
                {market.status}
              </Badge>
            </div>
            <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
              {market.title}
            </CardTitle>
            <CardDescription className="line-clamp-2 mt-2">
              {market.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center pt-4 border-t border-muted/50">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Locked: ${market.totalLockedValue} USDC</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{new Date(market.endsAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
