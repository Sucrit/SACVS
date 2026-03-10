import { useMemo, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import Modal from '../ui/Modal';

export interface SearchFilterOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchFilterOptionsGroup {
  id: string;
  label: string;
  description?: string;
  type?: 'options';
  value: string;
  defaultValue: string;
  options: SearchFilterOption[];
  onChange: (value: string) => void;
}

interface SearchFilterBooleanGroup {
  id: string;
  label: string;
  description?: string;
  type: 'boolean';
  value: boolean;
  defaultValue: boolean;
  onChange: (value: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
}

export type SearchFilterGroup = SearchFilterOptionsGroup | SearchFilterBooleanGroup;

interface SearchFilterModalProps {
  groups: SearchFilterGroup[];
  buttonLabel?: string;
  title?: string;
  description?: string;
  emptyLabel?: string;
  className?: string;
}

const getIsGroupActive = (group: SearchFilterGroup) => group.value !== group.defaultValue;

export default function SearchFilterModal({
  groups,
  buttonLabel = 'Filters',
  title = 'Search filters',
  description = 'Refine results across the current view.',
  emptyLabel = 'No filters available for this view.',
  className,
}: SearchFilterModalProps) {
  const [open, setOpen] = useState(false);

  const activeFilterCount = useMemo(
    () => groups.reduce((count, group) => count + (getIsGroupActive(group) ? 1 : 0), 0),
    [groups],
  );

  const hasGroups = groups.length > 0;

  const handleReset = () => {
    groups.forEach(group => {
      group.onChange(group.defaultValue as never);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
      >
        <SlidersHorizontal size={15} />
        {buttonLabel}
        {activeFilterCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size="lg"
        className={className || 'max-w-3xl'}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <p className="text-sm text-neutral-500">
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`
                : 'Choose filters to narrow the results.'}
            </p>
            <button
              type="button"
              onClick={handleReset}
              disabled={activeFilterCount === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={13} />
              Reset all
            </button>
          </div>

          {!hasGroups && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-neutral-500">
              {emptyLabel}
            </div>
          )}

          {hasGroups && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(group => (
                <section key={group.id} className="min-w-0 border-t border-neutral-200 pt-3">
                  <div className="mb-3 space-y-1">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      {group.label}
                    </h3>
                    {group.description && <p className="text-[11px] leading-relaxed text-neutral-400">{group.description}</p>}
                  </div>

                  {group.type === 'boolean' ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => group.onChange(true)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          group.value
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <p className="text-sm font-semibold">{group.trueLabel || 'Enabled'}</p>
                        <p className={`mt-0.5 text-[11px] ${group.value ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          Restrict results to this condition.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => group.onChange(false)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          !group.value
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <p className="text-sm font-semibold">{group.falseLabel || 'Disabled'}</p>
                        <p className={`mt-0.5 text-[11px] ${!group.value ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          Show the broader result set.
                        </p>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {group.options.map(option => {
                        const isActive = group.value === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => group.onChange(option.value)}
                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              isActive
                                ? 'border-neutral-900 bg-neutral-900 text-white'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <p className="text-sm font-semibold">{option.label}</p>
                            {option.description && (
                              <p className={`mt-0.5 text-[11px] ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`}>
                                {option.description}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}