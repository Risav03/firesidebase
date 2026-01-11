'use client';

import { useState } from 'react';
import { useTipEvent } from '@/utils/events';
import { motion, AnimatePresence } from 'framer-motion';

interface TipNotification {
  id: string;
  tipper: {
    username: string;
    pfp_url: string;
  };
  recipients: Array<{
    username?: string;
    role?: string;
  }>;
  amount: {
    usd: number;
    currency: string;
    native: number;
  };
  timestamp: string;
}

interface Particle {
  id: number;
  x: number;
  delay: number;
  duration: number;
}

export default function TipOverlay() {
  const [notifications, setNotifications] = useState<TipNotification[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  useTipEvent((data: any) => {
    const notification: TipNotification = {
      id: `${Date.now()}-${Math.random()}`,
      tipper: data.tipper,
      recipients: data.recipients,
      amount: data.amount,
      timestamp: data.timestamp,
    };

    setNotifications((prev) => [...prev, notification]);

    // Create particles based on currency
    if (data.amount.currency === 'ETH' || data.amount.currency === 'USDC' || data.amount.currency === 'FIRE') {
      // Calculate particle count based on tip amount (min 5 for $0.10, max 100)
      const particleCount = Math.min(100, Math.max(5, Math.floor(data.amount.usd * 10)));
      
      const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 3 + Math.random() * 2,
      }));
      setParticles((prev) => [...prev, ...newParticles]);

      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
      }, 5000);
    }

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    }, 5000);
  });

  const getRecipientText = (recipients: TipNotification['recipients']) => {
    if (recipients.length === 0) return 'someone';
    if (recipients[0].username) {
      return recipients.map((r) => r.username).join(', ');
    }
    if (recipients[0].role) {
      return recipients.map((r) => r.role === 'host' ? r.role : `${r.role}s`).join(', ');
    }
    return 'someone';
  };

  const getCurrencyIcon = (currency: string) => {
    switch (currency) {
      case 'FIRE':
        return '🔥';
      default:
        return '💵';
    }
  };

  const getCurrencyGradient = (currency: string) => {
    switch (currency) {
      case 'ETH':
        return 'gradient-indigo-bg border-fireside-indigo/30';
      case 'USDC':
        return 'gradient-blue-bg border-fireside-blue/30';
      case 'FIRE':
        return 'gradient-orange-bg border-fireside-orange/30';
      default:
        return 'gradient-green-bg border-fireside-green/30';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Particles */}
      <AnimatePresence>
        {particles.map((particle) => {
          const currency = notifications[notifications.length - 1]?.amount.currency || 'ETH';
          const icon = getCurrencyIcon(currency);
          
          return (
            <motion.div
              key={particle.id}
              className="absolute text-2xl"
              initial={{ y: -50, opacity: 0.7, rotate: 0 }}
              animate={{ y: '100vh', opacity: 0, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: 'easeIn',
              }}
              style={{
                left: `${particle.x}%`,
              }}
            >
              {icon}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Notifications */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center">
        <AnimatePresence>
          {notifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              className={`${getCurrencyGradient(notification.amount.currency)} border-[1px] rounded-full px-4 py-2 shadow-lg backdrop-blur-sm`}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
                ease: 'easeInOut',
              }}
            >
              <p className="text-white text-xs font-medium whitespace-nowrap">
                {notification.tipper.username} tipped {getRecipientText(notification.recipients)} ${notification.amount.usd.toFixed(2)} in {notification.amount.currency}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}