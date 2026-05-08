'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { BarChart3, Tag, Settings2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminMarketDashboard = dynamic(() => import('@/components/Admin/AdminMarketDashboard'), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Loading dashboard...</div>,
});
const AdminMarketsPage = dynamic(() => import('@/components/Admin/AdminMarketsTab'), { ssr: false });
const AdminCategoriesPage = dynamic(() => import('@/components/Admin/AdminCategoriesTab'), { ssr: false });

type TabId = 'dashboard' | 'markets' | 'categories';

const tabs: { id: TabId; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'dashboard',
    label: 'Market Dashboard',
    icon: <BarChart3 className="h-4 w-4" />,
    description: 'Live TVL, on-chain stats & per-market analytics',
  },
  {
    id: 'markets',
    label: 'Market Management',
    icon: <Settings2 className="h-4 w-4" />,
    description: 'Create, edit and delete markets',
  },
  {
    id: 'categories',
    label: 'Category Management',
    icon: <Tag className="h-4 w-4" />,
    description: 'Manage market categories',
  },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span>predict.io</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-primary font-medium capitalize">{activeTab.replace('-', ' ')}</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          Admin <span className="text-primary">Console</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Manage your prediction markets, categories, and monitor live on-chain performance.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-stretch gap-3 mb-8 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`admin-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex items-start gap-3 p-4 rounded-2xl border text-left min-w-[200px] flex-1
              transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-primary/10 border-primary/40 shadow-sm'
                : 'bg-card/40 border-border/50 hover:bg-muted/50 hover:border-border'
              }
            `}
          >
            <div
              className={`p-2 rounded-lg flex-shrink-0 mt-0.5 transition-colors ${
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {tab.icon}
            </div>
            <div>
              <p className={`font-semibold text-sm ${activeTab === tab.id ? 'text-primary' : 'text-foreground'}`}>
                {tab.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{tab.description}</p>
            </div>
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'dashboard' && <AdminMarketDashboard />}
          {activeTab === 'markets' && <AdminMarketsPage />}
          {activeTab === 'categories' && <AdminCategoriesPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
