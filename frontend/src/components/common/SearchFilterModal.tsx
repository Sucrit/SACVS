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
  hideLabel?: boolean;
  title?: string;
  description?: string;
  emptyLabel?: string;
  className?: string;
}

const getIsGroupActive = (group: SearchFilterGroup) => group.value !== group.defaultValue;

export default function SearchFilterModal({
  groups,
  buttonLabel = 'Filters',
  hideLabel = false,
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
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
        title={buttonLabel}
      >
        <span className="relative inline-flex h-5 w-5 items-center justify-center">
          <SlidersHorizontal size={15} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-3.5 items-center justify-center rounded-full bg-neutral-900 px-[3px] py-px text-[9px] font-semibold leading-none text-white">
              {activeFilterCount}
            </span>
          )}
        </span>
        {!hideLabel && buttonLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size="xl"
        className={className || 'max-w-5xl md:max-w-4xl'}
      >
        <div className="flex min-h-0 flex-col">
          <div className="shrink-0 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
              <p className="text-sm text-neutral-500">
                {activeFilterCount > 0
                  ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`
                  : 'Choose filters to narrow the results.'}
              </p>
              <button
                type="button"
                onClick={handleReset}
                disabled={activeFilterCount === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={13} />
                Reset all
              </button>
            </div>
          </div>

          {!hasGroups && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-neutral-500">
              {emptyLabel}
            </div>
          )}

          {hasGroups && (
            <div className="-mr-1 mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
                {groups.map(group => (
                  <section key={group.id} className="min-w-0">
                    <div className="mb-4 space-y-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-900">
                        {group.label}
                      </h3>
                      <div className="h-px w-full bg-neutral-200" />
                    </div>

                    {group.type === 'boolean' ? (
                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => group.onChange(true)}
                          className={`text-left text-[13px] transition-colors ${
                            group.value
                              ? 'font-medium text-neutral-900'
                              : 'text-neutral-500 hover:text-neutral-900'
                          }`}
                        >
                          {group.trueLabel || 'Enabled'}
                        </button>
                        <button
                          type="button"
                          onClick={() => group.onChange(false)}
                          className={`text-left text-[13px] transition-colors ${
                            !group.value
                              ? 'font-medium text-neutral-900'
                              : 'text-neutral-500 hover:text-neutral-900'
                          }`}
                        >
                          {group.falseLabel || 'Disabled'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {group.options.map(option => {
                          const isActive = group.value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => group.onChange(option.value)}
                              className={`block text-left text-[13px] transition-colors ${
                                isActive
                                  ? 'font-medium text-neutral-900'
                                  : 'text-neutral-500 hover:text-neutral-900'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
