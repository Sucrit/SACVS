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
    <div className={cn('bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all group', className)}>
      <div className={cn('p-6 bg-gradient-to-br text-white relative overflow-hidden', gradientColor)}>
        <div className="absolute top-0 right-0 p-3 opacity-10 transform translate-x-1/3 -translate-y-1/3">
           <TypeIcon className="w-32 h-32" />
        </div>
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-inner border border-white/10">
              <TypeIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-medium text-white/80 uppercase tracking-wider">{credential.type}</span>
              <h3 className="text-lg font-bold shadow-black/10 drop-shadow-md">{credential.title}</h3>
            </div>
          </div>
          <StatusIndicator status={credential.status} size="sm" />
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Institution</p>
              <p className="text-sm font-medium text-foreground">{credential.institution_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Holder</p>
              <p className="text-sm font-medium text-foreground">{credential.student_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Issue Date</p>
              <p className="text-sm font-medium text-foreground">
                {credential.issue_date ? format(new Date(credential.issue_date), 'PP') : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm font-medium text-foreground">
                {credential.expiry_date ? format(new Date(credential.expiry_date), 'PP') : 'No Expiry'}
              </p>
            </div>
          </div>
        </div>

        {showBlockchain && credential.blockchain_hash && (
          <BlockchainIndicator hash={credential.blockchain_hash} timestamp={credential.blockchain_timestamp} verified={credential.status === 'issued'} />
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onView?.(credential)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View Details
          </Button>
          {onVerify && (
            <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => onVerify?.(credential)}>
              <Shield className="w-4 h-4 mr-2" />
              Verify
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
