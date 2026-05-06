'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function Navbar() {
  const { connect, isLoading, logout } = useAuth();
  const { user, publicKey, token, isAuthenticated } = useAuthStore();
  const { isLogoutModalOpen, setLogoutModalOpen } = useUiStore();
  const kycStatus = user?.kycStatus ?? 'pending';

  const truncateKey = (key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`;

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">P</span>
            </div>
            <span className="text-xl font-bold tracking-tight">predict.io</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-primary transition-colors">Markets</Link>
            <Link href="/portfolio" className="hover:text-primary transition-colors">Portfolio</Link>
            <Link href="/activity" className="hover:text-primary transition-colors">Activity</Link>
            
            <DropdownMenu>
              <DropdownMenuTrigger 
                render={
                  <button className="hover:text-primary transition-colors text-sm font-medium">Admin</button>
                }
              />
              <DropdownMenuContent>
                <DropdownMenuItem 
                  render={
                    <Link href="/admin/markets">Manage Markets</Link>
                  }
                />
                <DropdownMenuItem 
                  render={
                    <Link href="/admin/categories">Manage Categories</Link>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated && publicKey && token ? (
            <>
              <Link href="/profile">
                <Button variant="outline" size="sm" className="hidden md:flex">
                  Profile
                </Button>
              </Link>

              <Button
                variant="secondary"
                className="flex items-center gap-2"
                onClick={() => setLogoutModalOpen(true)}
              >
                <Wallet className="h-4 w-4" />
                <span>{truncateKey(publicKey)}</span>
                <Badge variant={kycStatus === 'verified' ? 'default' : 'outline'} className="ml-1 text-[10px] px-1 py-0 h-4">
                  {kycStatus}
                </Badge>
              </Button>
            </>
          ) : (
            <Button onClick={connect} disabled={isLoading}>
              {isLoading ? 'Connecting...' : (
                <>
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Wallet
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <Dialog open={isLogoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect wallet</DialogTitle>
            <DialogDescription>
              Do you really want to disconnect your wallet and clear the current authenticated session?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutModalOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await logout();
                setLogoutModalOpen(false);
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
