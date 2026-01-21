import React from 'react';
import { Link2, CheckCircle2, Clock, Hash, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function BlockchainIndicator({ hash, timestamp, verified = false, className }) {
  const displayHash =
    hash ||
    '0x' +
      Array(64)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');

  const truncatedHash = `${displayHash.slice(0, 10)}...${displayHash.slice(-8)}`;

  return (
    <div className={cn('bg-indigo-950/10 rounded-xl border border-indigo-500/20 p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-indigo-500/10 rounded-lg">
          <Box className="w-4 h-4 text-indigo-400" />
        </div>
        <span className="text-sm font-semibold text-indigo-100">Blockchain Record</span>
        {verified && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Immutable
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Transaction Hash:</span>
          <code className="text-xs font-mono text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-500/20">
            {truncatedHash}
          </code>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Recorded:</span>
          <span className="text-xs font-medium text-foreground">
            {timestamp ? format(new Date(timestamp), 'PPpp') : 'Pending confirmation'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Network:</span>
          <span className="text-xs font-medium text-foreground">Academic Chain (Conceptual)</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_theme('colors.emerald.500')]" />
          <span className="text-xs text-muted-foreground">
            {verified ? 'Record permanently stored on distributed ledger' : 'Awaiting blockchain confirmation'}
          </span>
        </div>
      </div>
    </div>
  );
}
