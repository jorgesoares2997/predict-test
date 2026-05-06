'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '@/hooks/useUsers';
import { User } from '@/types';

export default function ProfilePage() {
  const { user: sessionUser, logout } = useAuthStore();
  const { data: users = [], isLoading } = useUsers();
  const { mutateAsync: createUser, isPending: isCreating } = useCreateUser();
  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutateAsync: deleteUser, isPending: isDeleting } = useDeleteUser();

  const currentUser = useMemo(
    () => users.find((u) => u.id === sessionUser?.id) ?? null,
    [users, sessionUser?.id]
  );

  const [createForm, setCreateForm] = useState({
    wallet_address: '',
    didit_id: '',
    kyc_status: 'PENDING' as 'PENDING' | 'VERIFIED' | 'REJECTED',
  });

  const [editForm, setEditForm] = useState({
    wallet_address: '',
    didit_id: '',
    kyc_status: 'PENDING' as 'PENDING' | 'VERIFIED' | 'REJECTED',
  });

  const loadCurrentUserToEdit = (u: User | null) => {
    if (!u) return;
    setEditForm({
      wallet_address: u.publicKey,
      didit_id: u.diditId ?? '',
      kyc_status: (u.kycStatus || 'pending').toUpperCase() as 'PENDING' | 'VERIFIED' | 'REJECTED',
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile & Users</h1>
        <p className="text-muted-foreground">Manage your profile and perform CRUD operations on the user table.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          ) : currentUser ? (
            <>
              <p><span className="text-muted-foreground">User ID:</span> {currentUser.id}</p>
              <p><span className="text-muted-foreground">Wallet:</span> {currentUser.publicKey}</p>
              <p><span className="text-muted-foreground">KYC:</span> {currentUser.kycStatus}</p>
              <p><span className="text-muted-foreground">Didit ID:</span> {currentUser.diditId || '-'}</p>
              <p><span className="text-muted-foreground">Created At:</span> {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleString() : '-'}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => loadCurrentUserToEdit(currentUser)}>Load in edit form</Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Wallet address"
              value={createForm.wallet_address}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, wallet_address: e.target.value }))}
            />
            <Input
              placeholder="Didit ID (optional)"
              value={createForm.didit_id}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, didit_id: e.target.value }))}
            />
            <Input
              placeholder="KYC status: PENDING/VERIFIED/REJECTED"
              value={createForm.kyc_status}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  kyc_status: (e.target.value || 'PENDING').toUpperCase() as 'PENDING' | 'VERIFIED' | 'REJECTED',
                }))
              }
            />
            <Button
              disabled={isCreating || !createForm.wallet_address.trim()}
              onClick={async () => {
                await createUser({
                  wallet_address: createForm.wallet_address.trim(),
                  didit_id: createForm.didit_id.trim() || undefined,
                  kyc_status: createForm.kyc_status,
                });
                setCreateForm({ wallet_address: '', didit_id: '', kyc_status: 'PENDING' });
              }}
            >
              Create
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Current User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Wallet address"
              value={editForm.wallet_address}
              onChange={(e) => setEditForm((prev) => ({ ...prev, wallet_address: e.target.value }))}
            />
            <Input
              placeholder="Didit ID"
              value={editForm.didit_id}
              onChange={(e) => setEditForm((prev) => ({ ...prev, didit_id: e.target.value }))}
            />
            <Input
              placeholder="KYC status: PENDING/VERIFIED/REJECTED"
              value={editForm.kyc_status}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  kyc_status: (e.target.value || 'PENDING').toUpperCase() as 'PENDING' | 'VERIFIED' | 'REJECTED',
                }))
              }
            />
            <Button
              disabled={isUpdating || !currentUser}
              onClick={async () => {
                if (!currentUser) return;
                await updateUser({
                  id: currentUser.id,
                  wallet_address: editForm.wallet_address.trim() || currentUser.publicKey,
                  didit_id: editForm.didit_id.trim() || null,
                  kyc_status: editForm.kyc_status,
                });
              }}
            >
              Update
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">ID</th>
                  <th>Wallet</th>
                  <th>KYC</th>
                  <th>Didit</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="py-2 pr-4">{u.id}</td>
                    <td className="pr-4">{u.publicKey}</td>
                    <td className="pr-4">{u.kycStatus}</td>
                    <td className="pr-4">{u.diditId || '-'}</td>
                    <td className="pr-4">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                    <td>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isDeleting}
                        onClick={async () => {
                          await deleteUser(u.id);
                          if (u.id === sessionUser?.id) logout();
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
