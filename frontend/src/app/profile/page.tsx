'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { useDeleteUser, useUpdateUser } from '@/hooks/useUsers';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { toast } from '@/lib/toast';
import { User } from '@/types';

export default function ProfilePage() {
  const { user: sessionUser, logout, updateUser: updateSessionUser } = useAuthStore();
  const { mutateAsync: updateUserProfile, isPending: isUpdating } = useUpdateUser();
  const { mutateAsync: deleteUser, isPending: isDeleting } = useDeleteUser();
  const { data: currentUser, isLoading, refetch } = useQuery<User | null>({
    queryKey: ['user-profile', sessionUser?.id],
    queryFn: async () => {
      if (!sessionUser?.id) return null;
      const { data } = await apiClient.get(`/users/${sessionUser.id}`);
      return data;
    },
    enabled: Boolean(sessionUser?.id),
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    if (!currentUser) return;
    setEditForm({
      name: currentUser.name ?? '',
      email: currentUser.email ?? '',
    });
  }, [currentUser]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Manage your account data and update your name and email.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logged User Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          ) : currentUser ? (
            <>
              <p><span className="text-muted-foreground">User ID:</span> {currentUser.id}</p>
              <p><span className="text-muted-foreground">Wallet:</span> {currentUser.publicKey}</p>
              <p><span className="text-muted-foreground">Name:</span> {currentUser.name || '-'}</p>
              <p><span className="text-muted-foreground">Email:</span> {currentUser.email || '-'}</p>
              <p><span className="text-muted-foreground">KYC:</span> {currentUser.kycStatus}</p>
              <p><span className="text-muted-foreground">Created At:</span> {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleString() : '-'}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
                <Button
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={async () => {
                    await deleteUser(currentUser.id);
                    logout();
                  }}
                >
                  Delete my user
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No profile found for current session.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Name and Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Your name"
            value={editForm.name}
            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="your@email.com"
            value={editForm.email}
            onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Button
            disabled={isUpdating || !currentUser}
            onClick={async () => {
              if (!currentUser) return;
              const updated = await updateUserProfile({
                id: currentUser.id,
                name: editForm.name.trim() || null,
                email: editForm.email.trim() || null,
              });
              updateSessionUser(updated as User);
              toast.success('Profile updated');
            }}
          >
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
