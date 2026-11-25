import React from 'react';
import { motion } from 'framer-motion';
import { Database } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface DatabaseLoaderProps {
  message?: string;
  subtext?: string;
}

export const DatabaseLoader: React.FC<DatabaseLoaderProps> = ({
  message = 'Please wait, syncing live data...',
  subtext = 'Fetching latest records from cloud database',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="w-full py-16 px-6 flex flex-col items-center justify-center text-center bg-white/80 backdrop-blur-md border border-border rounded-3xl shadow-subtle"
    >
      <div className="relative flex items-center justify-center mb-5">
        <BrandLogo size="lg" animated />
        <span className="absolute -inset-2 rounded-3xl border-2 border-brand-400/40 animate-ping pointer-events-none" />
      </div>

      <h3 className="text-base font-heading font-bold text-content flex items-center gap-2">
        <Database className="w-4 h-4 text-brand-600 animate-bounce" />
        {message}
      </h3>
      <p className="text-xs text-content-secondary mt-1 max-w-xs">{subtext}</p>

      <div className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-5">
        <motion.div
          className="h-full w-1/2 bg-brand-gradient rounded-full"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
};
