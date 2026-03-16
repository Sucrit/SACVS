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
  footer?: ReactNode;
}

export default function RecordDetailsDrawer({
  open,
  onClose,
  title,
  description,
  sections,
  width = 'max-w-2xl',
  footer,
}: RecordDetailsDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title={title} description={description} width={width} footer={footer}>
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
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              {section.fields.map(field => (
                <div key={field.label}>
                  <p className="text-xs font-semibold text-neutral-500">
                    {field.label}
                  </p>
                  <div className="mt-2 text-sm text-neutral-700 break-words">{field.value}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Drawer>
  );
}