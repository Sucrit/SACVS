import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Drawer from '../ui/Drawer';

export type RecordDetailsField = {
  label: string;
  icon?: LucideIcon;
  value: ReactNode;
};

export type RecordDetailsSection = {
  title?: string;
  fields: RecordDetailsField[];
};

interface RecordDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  sections: RecordDetailsSection[];
  width?: string;
  actions?: ReactNode;
  actionsTitle?: string;
}

interface DrawerActionsProps {
  children: ReactNode;
  className?: string;
}

export function DrawerActions({ children, className = '' }: DrawerActionsProps) {
  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`.trim()}>
      {children}
    </div>
  );
}

export default function RecordDetailsDrawer({
  open,
  onClose,
  title,
  description,
  sections,
  width = 'max-w-2xl',
  actions,
  actionsTitle = 'Actions',
}: RecordDetailsDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title={title} description={description} width={width}>
      <div className="space-y-8">
        {sections.map((section, sectionIndex) => (
          <section
            key={`${section.title || 'section'}-${sectionIndex}`}
            className={sectionIndex > 0 ? 'border-t border-neutral-200 pt-6' : ''}
          >
            {section.title && (
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {section.title}
              </h3>
            )}
            <div className="mt-5 space-y-3">
              {section.fields.map(field => {
                const Icon = field.icon;
                return (
                  <div key={field.label} className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
                    <p className="flex items-center gap-2 text-sm font-medium text-neutral-600">
                      {Icon && <Icon size={14} />}
                      {field.label}
                    </p>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 break-words">
                      {field.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {actions ? (
          <section className="border-t border-neutral-200 pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {actionsTitle}
            </h3>
            <div className="mt-5">
              <DrawerActions>{actions}</DrawerActions>
            </div>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
