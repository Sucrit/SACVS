import type { ReactNode } from 'react';
import Drawer from '../ui/Drawer';

type RecordDetailsField = {
  label: string;
  value: ReactNode;
};

type RecordDetailsSection = {
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
}

export default function RecordDetailsDrawer({
  open,
  onClose,
  title,
  description,
  sections,
  width = 'max-w-xl',
}: RecordDetailsDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title={title} description={description} width={width}>
      <div className="space-y-6">
        {sections.map((section, sectionIndex) => (
          <section key={`${section.title || 'section'}-${sectionIndex}`} className="space-y-3">
            {section.title && (
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                {section.title}
              </h3>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {section.fields.map(field => (
                <div key={field.label} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    {field.label}
                  </p>
                  <div className="mt-1 text-sm text-neutral-800 break-words">{field.value}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Drawer>
  );
}