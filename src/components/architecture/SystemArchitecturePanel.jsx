import React from 'react';
import { cn } from '@/lib/utils';
import { Monitor, Server, Database, Brain, Box, Lock, ArrowDown, Shield, Globe, Users, FileCheck } from 'lucide-react';

const layers = [
  {
    id: 'frontend',
    label: 'Frontend Layer',
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    icon: Monitor,
    componentBg: 'bg-blue-500/5',
    componentBorder: 'border-blue-500/20',
    components: [
      { label: 'Web UI (Responsive)', icon: Monitor },
      { label: 'Role-based Dashboards', icon: Users },
      { label: 'Credential Cards & Tables', icon: FileCheck },
      { label: 'Security Status Panels', icon: Shield },
    ],
  },
  {
    id: 'backend',
    label: 'Backend Services (Conceptual)',
    color: 'from-indigo-500 to-violet-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    icon: Server,
    componentBg: 'bg-indigo-500/5',
    componentBorder: 'border-indigo-500/20',
    components: [
      { label: 'Authentication Service', icon: Lock },
      { label: 'Authorization Service', icon: Shield },
      { label: 'Verification Logic', icon: FileCheck },
      { label: 'Audit Logging', icon: Database },
    ],
  },
  {
    id: 'ai',
    label: 'AI Component (Conceptual)',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    icon: Brain,
    componentBg: 'bg-violet-500/5',
    componentBorder: 'border-violet-500/20',
    components: [
      { label: 'Document Validation Module', icon: FileCheck },
      { label: 'Fraud Detection Engine', icon: Shield },
      { label: 'Risk Scoring Module', icon: Brain },
    ],
  },
  {
    id: 'blockchain',
    label: 'Blockchain Component (Conceptual)',
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    icon: Box,
    componentBg: 'bg-cyan-500/5',
    componentBorder: 'border-cyan-500/20',
    components: [
      { label: 'Credential Ledger', icon: Database },
      { label: 'Smart Contract Interface', icon: FileCheck },
      { label: 'Immutable Storage Layer', icon: Lock },
    ],
  },
  {
    id: 'database',
    label: 'Database Component (Conceptual)',
    color: 'from-slate-500 to-slate-600',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    icon: Database,
    componentBg: 'bg-slate-500/5',
    componentBorder: 'border-slate-500/20',
    components: [
      { label: 'User Profile Store', icon: Users },
      { label: 'Credential Metadata Store', icon: FileCheck },
      { label: 'Access Logs Store', icon: Database },
      { label: 'System Configuration Store', icon: Server },
    ],
  },
];

export default function SystemArchitecturePanel({ className }) {
  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      <div className="px-6 py-4 border-b border-border bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">System Architecture</h3>
            <p className="text-xs text-muted-foreground">Conceptual component visualization</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {layers.map((layer, index) => (
          <React.Fragment key={layer.id}>
            <div className={cn('rounded-xl border p-4', layer.bgColor, layer.borderColor)}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center', layer.color)}>
                  <layer.icon className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-semibold text-foreground/90">{layer.label}</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {layer.components.map((comp, idx) => (
                  <div key={idx} className={cn('rounded-lg px-3 py-2 border flex items-center gap-2', layer.componentBg, layer.componentBorder)}>
                    <comp.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground/80">{comp.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {index < layers.length - 1 && (
              <div className="flex justify-center">
                <ArrowDown className="w-5 h-5 text-slate-300" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-4 h-4" />
          <span>All layers protected by HTTPS, encryption, and access controls</span>
        </div>
      </div>
    </div>
  );
}
