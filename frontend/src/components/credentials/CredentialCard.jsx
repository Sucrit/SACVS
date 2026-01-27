import React from 'react';
import { GraduationCap, Building2, Calendar, Hash, ExternalLink, Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import StatusIndicator from '@/components/ui/StatusIndicator';
import BlockchainIndicator from '@/components/dashboard/BlockchainIndicator';
import { Button } from '@/components/ui/button';

const typeIcons = {
  diploma: GraduationCap,
  certificate: Shield,
  transcript: Hash,
  degree: GraduationCap,
  license: Shield,
};

const typeColors = {
  diploma: 'from-blue-500 to-indigo-600',
  certificate: 'from-emerald-500 to-teal-600',
  transcript: 'from-indigo-500 to-violet-600',
  degree: 'from-violet-500 to-purple-600',
  license: 'from-cyan-500 to-blue-600',
};

export default function CredentialCard({ credential, showBlockchain = false, onView, onVerify, compact = false, className }) {
  const TypeIcon = typeIcons[credential.type] || GraduationCap;
  const gradientColor = typeColors[credential.type] || 'from-slate-500 to-slate-600';

  if (compact) {
    return (
      <div
        className={cn('bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all cursor-pointer hover:border-primary/50', className)}
        onClick={() => onView?.(credential)}
      >
        <div className="flex items-center gap-4">
          <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-lg', gradientColor)}>
            <TypeIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">{credential.title}</h4>
            <p className="text-sm text-muted-foreground truncate">{credential.institution_name}</p>
          </div>
          <StatusIndicator status={credential.status} size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all group duration-300', className)}>
      <div className="p-6 relative">
        <div className="flex items-start justify-between mb-4">
           <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', gradientColor)}>
              <TypeIcon className="w-6 h-6 text-white" />
           </div>
           <StatusIndicator status={credential.status} size="sm" />
        </div>

        <div className="mb-4">
           <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-1 block">{credential.type}</span>
           <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{credential.title}</h3>
           <p className="text-sm text-muted-foreground flex items-center gap-1">
             <Building2 className="w-3 h-3" />
             {credential.institution_name}
           </p>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-muted-foreground border-t border-border/60 pt-4 mb-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground/70">Issued To</span>
              <span className="font-medium text-foreground">{credential.student_name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground/70">Issue Date</span>
              <span className="font-medium text-foreground">
                {credential.issue_date ? format(new Date(credential.issue_date), 'MMM d, yyyy') : 'N/A'}
              </span>
            </div>
        </div>

        {showBlockchain && credential.blockchain_hash && (
          <div className="mb-4">
             <BlockchainIndicator hash={credential.blockchain_hash} timestamp={credential.blockchain_timestamp} verified={credential.status === 'issued'} />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 hover:bg-muted font-medium" onClick={() => onView?.(credential)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View
          </Button>
          {onVerify && (
            <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onVerify?.(credential)}>
              Verify
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
