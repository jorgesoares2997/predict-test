'use client';

import React, { useState, useEffect } from 'react';
import { 
  useCategories, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory 
} from '@/hooks/useCategories';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Trash2, Search, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';

type CategoryFormValues = {
  name: string;
};

export default function AdminCategoriesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string, name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const token = useAuthStore((s) => s.token);
  const publicKey = useAuthStore((s) => s.publicKey);
  const { connect, isLoading: isAuthLoading } = useAuth();

  const { data: categories, isLoading: isFetching } = useCategories();
  const { mutate: createCategory, isPending: isCreating } = useCreateCategory();
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateCategory();
  const { mutate: deleteCategory } = useDeleteCategory();

  const filteredCategories = categories?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (data: CategoryFormValues) => {
    if (!token) {
      if (!publicKey) {
        toast.error('Connect wallet/login to create categories');
        return;
      }

      toast.info('Validating wallet session...');
      await connect();
      if (!useAuthStore.getState().token) {
        toast.error('Unable to validate session. Please try connecting again.');
        return;
      }
    }

    createCategory(data, {
      onSuccess: () => setIsCreateOpen(false),
    });
  };

  const handleUpdate = (data: CategoryFormValues) => {
    if (!token) {
      toast.error('Connect wallet/login to update categories');
      return;
    }
    if (!editingCategory) return;
    updateCategory({ id: editingCategory.id, name: data.name }, {
      onSuccess: () => setEditingCategory(null),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Category Management</h1>
          <p className="text-muted-foreground">Organize markets into categories for better discoverability.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create Category
              </Button>
            } 
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
            </DialogHeader>
            <CategoryForm
              key={isCreateOpen ? 'category-create' : 'category-create-closed'}
              onSubmit={handleCreate}
              isLoading={isCreating || isAuthLoading}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Categories</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search categories..." 
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
                  <th className="h-10 px-4 text-left font-medium">Name</th>
                  <th className="h-10 px-4 text-left font-medium">Slug</th>
                  <th className="h-10 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isFetching ? (
                  <tr>
                    <td colSpan={3} className="h-24 text-center">Loading categories...</td>
                  </tr>
                ) : filteredCategories?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="h-24 text-center">No categories found.</td>
                  </tr>
                ) : (
                  filteredCategories?.map((category) => (
                    <tr key={category.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        {category.name}
                      </td>
                      <td className="p-4 text-muted-foreground">{category.slug ?? '-'}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setEditingCategory({ id: category.id, name: category.name })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive"
                            onClick={() => {
                              if (!token) {
                                toast.error('Connect wallet/login to delete categories');
                                return;
                              }
                              if (confirm('Are you sure you want to delete this category? Any markets in this category might become uncategorized.')) {
                                deleteCategory(category.id);
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
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <CategoryForm
              key={editingCategory.id}
              initialData={editingCategory}
              onSubmit={handleUpdate}
              isLoading={isUpdating || isAuthLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({
  initialData,
  onSubmit,
  isLoading,
}: {
  initialData?: { id?: string; name: string };
  onSubmit: (data: CategoryFormValues) => void | Promise<void>;
  isLoading: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    defaultValues: {
      name: initialData?.name || '',
    },
  });

  useEffect(() => {
    reset({ name: initialData?.name || '' });
  }, [initialData?.id, initialData?.name, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Category Name</Label>
        <Input
          id="name"
          {...register('name', {
            required: 'Name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
          })}
          placeholder="e.g. Sports"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : initialData ? 'Update Category' : 'Create Category'}
      </Button>
    </form>
  );
}
