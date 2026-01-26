import React from 'react';
import { Brain, Eye, AlertTriangle, CheckCircle2, FileSearch, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AIValidationPanel({ confidenceScore = 0, fraudFlags = [], status = 'pending', className }) {
  const getConfidenceColor = (score) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    return 'text-red-400';
  };

  const getProgressColor = (score) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const statusConfig = {
    pending: { icon: FileSearch, label: 'Awaiting Review', color: 'text-muted-foreground' },
    processing: { icon: Brain, label: 'AI Processing', color: 'text-purple-400' },
    completed: { icon: CheckCircle2, label: 'Validation Complete', color: 'text-emerald-400' },
    flagged: { icon: AlertTriangle, label: 'Requires Attention', color: 'text-amber-400' },
  };

  const currentStatus = statusConfig[status] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;

  return (
    <div className={cn('bg-purple-950/10 rounded-xl border border-purple-500/20 p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-purple-500/10 rounded-lg">
          <Brain className="w-4 h-4 text-purple-400" />
        </div>
        <span className="text-sm font-semibold text-purple-100">AI Document Validation</span>
        <div className={cn('ml-auto flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-purple-950/30 border border-purple-500/20', currentStatus.color)}>
          <StatusIcon className="w-3.5 h-3.5" />
          {currentStatus.label}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Confidence Score</span>
            <span className={cn('text-lg font-bold', getConfidenceColor(confidenceScore))}>{confidenceScore}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500 shadow-[0_0_10px_currentColor]', getProgressColor(confidenceScore))} style={{ width: `${confidenceScore}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-foreground">Document Analysis</span>
            </div>
            <span className="text-xs text-muted-foreground">Format, structure, metadata verified</span>
          </div>
          <div className="bg-card rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-foreground">Fraud Detection</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {fraudFlags.length === 0 ? 'No anomalies detected' : `${fraudFlags.length} flag(s) found`}
            </span>
          </div>
        </div>

        {fraudFlags.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-500">Attention Required</span>
            </div>
            <ul className="space-y-1">
              {fraudFlags.map((flag, index) => (
                <li key={index} className="text-xs text-amber-400/90 flex items-center gap-2">
                  <span className="w-1 h-1 bg-amber-500 rounded-full" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground italic">
            AI validation is a pre-blockchain verification stage. Final authenticity is confirmed upon blockchain recording.
          </p>
        </div>
      </div>
    </div>
  );
}
