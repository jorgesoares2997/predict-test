'use client';

import { MarketDashboard } from '@/components/Markets/MarketDashboard';
import { Wallet, ShieldCheck, TrendingUp, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const steps = [
    { icon: <Wallet className="h-6 w-6" />, title: "Connect Wallet", desc: "Connect your Freighter wallet to get started." },
    { icon: <ShieldCheck className="h-6 w-6" />, title: "Verify Identity", desc: "Complete a quick KYC to enable trading." },
    { icon: <Search className="h-6 w-6" />, title: "Find Markets", desc: "Browse through categories and pick an event." },
    { icon: <TrendingUp className="h-6 w-6" />, title: "Place Trades", desc: "Trade on outcomes and earn rewards." }
  ];

  return (
    <div className="flex flex-col gap-16">
      <section className="relative py-12 px-6 rounded-3xl bg-gradient-to-br from-primary/20 via-background to-background border border-primary/10 overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/10 blur-[100px] rounded-full" />
        <div className="relative z-10 max-w-2xl">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
          >
            The Future is <span className="text-primary">Predictable</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground mb-8"
          >
            Trade on the outcome of sports, politics, and crypto events using USDC on the Stellar network. No intermediaries, just code.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-4"
          >
            <button className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity">
              Start Trading
            </button>
            <button className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-bold hover:bg-secondary/80 transition-colors">
              How it Works
            </button>
          </motion.div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {steps.map((step, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx }}
            className="flex flex-col gap-4 p-6 rounded-2xl border bg-card/50"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {step.icon}
            </div>
            <h3 className="font-bold text-lg">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.desc}</p>
          </motion.div>
        ))}
      </section>

      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 bg-primary rounded-full" />
          <h2 className="text-2xl font-bold">Live Markets</h2>
        </div>
        <MarketDashboard />
      </div>
    </div>
  );
}
