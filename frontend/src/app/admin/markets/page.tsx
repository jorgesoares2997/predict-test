'use client';

import React, { useState } from 'react';
import { 
  useMarkets, 
  useCreateMarket, 
  useUpdateMarket, 
  useDeleteMarket 
} from '@/hooks/useMarkets';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MarketForm } from '@/components/Markets/MarketForm';
import { Market } from '@/types';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { marketCategoryLabel } from '@/lib/marketDisplay';

export default function AdminMarketsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: markets, isLoading: isFetching } = useMarkets();
  const { mutate: createMarket, isPending: isCreating } = useCreateMarket();
  const { mutate: updateMarket, isPending: isUpdating } = useUpdateMarket();
  const { mutate: deleteMarket } = useDeleteMarket();

  const filteredMarkets = markets?.filter((m) => {
    const q = searchTerm.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) || marketCategoryLabel(m).toLowerCase().includes(q)
    );
  });

  const handleCreate = (data: any) => {
    createMarket(data, {
      onSuccess: () => setIsCreateOpen(false),
    });
  };

  const handleUpdate = (data: any) => {
    if (!editingMarket) return;
    updateMarket({ id: editingMarket.id, ...data }, {
      onSuccess: () => setEditingMarket(null),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Management</h1>
          <p className="text-muted-foreground">Create and manage prediction markets for the platform.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create Market
              </Button>
            } 
          />
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Market</DialogTitle>
            </DialogHeader>
            <MarketForm
              key={isCreateOpen ? 'create-open' : 'create-closed'}
              onSubmit={handleCreate}
              isLoading={isCreating}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Markets</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search markets..." 
                className="pl-8" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="h-10 px-4 text-left font-medium">Title</th>
                  <th className="h-10 px-4 text-left font-medium">Category</th>
                  <th className="h-10 px-4 text-left font-medium">Status</th>
                  <th className="h-10 px-4 text-left font-medium">Ends At</th>
                  <th className="h-10 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isFetching ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center">Loading markets...</td>
                  </tr>
                ) : filteredMarkets?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center">No markets found.</td>
                  </tr>
                ) : (
                  filteredMarkets?.map((market) => (
                    <tr key={market.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{market.title}</td>
                      <td className="p-4">{marketCategoryLabel(market)}</td>
                      <td className="p-4">
                        <Badge variant={market.status === 'active' ? 'default' : 'secondary'}>
                          {market.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(market.endsAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setEditingMarket(market)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this market?')) {
                                deleteMarket(market.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editingMarket} onOpenChange={(open) => !open && setEditingMarket(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Market</DialogTitle>
          </DialogHeader>
          {editingMarket && (
            <MarketForm
              key={editingMarket.id}
              initialData={editingMarket}
              onSubmit={handleUpdate}
              isLoading={isUpdating}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
