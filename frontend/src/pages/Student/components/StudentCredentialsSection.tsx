import { MouseEvent, useMemo, useState } from 'react';
import { Download, FileText, MoreHorizontal, Plus, Search, Share2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import { Credential, CredentialType } from '../../../services/credential.service';
import { getCredentialFileUrl } from '../utils';

type CredentialTypeFilter = 'ALL' | CredentialType;
type DateRangeFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

interface StudentCredentialsSectionProps {
  credentials: Credential[];
  isLoadingCredentials: boolean;
  selectedCredentialId: string | null;
  onSelectCredential: (credentialId: string) => void;
  onOpenDetails: (credentialId: string) => void;
  onRefresh: () => void;
}

const typeFilters: CredentialTypeFilter[] = ['ALL', 'TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const dateRangeFilters: Array<{ value: DateRangeFilter; label: string }> = [
  { value: 'ALL', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This week' },
  { value: 'THIS_MONTH', label: 'This month' },
];

const paperTextureStyle = {
  backgroundColor: '#ffffff',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg width='90' height='90' viewBox='0 0 90 90' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%230f172a' fill-opacity='0.04'%3E%3Ccircle cx='10' cy='10' r='1.3'/%3E%3Ccircle cx='45' cy='25' r='1.3'/%3E%3Ccircle cx='75' cy='52' r='1.3'/%3E%3Ccircle cx='20' cy='70' r='1.3'/%3E%3C/g%3E%3C/svg%3E\")",
};

const isImageFile = (credential: Credential) => {
  if (credential.mimeType?.startsWith('image/')) return true;
  const source = `${credential.filename || ''} ${credential.storageKey || ''}`.toLowerCase();
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/.test(source);
};

const isPdfFile = (credential: Credential) => {
  if (credential.mimeType === 'application/pdf') return true;
  const source = `${credential.filename || ''} ${credential.storageKey || ''}`.toLowerCase();
  return /\.pdf$/.test(source);
};

export default function StudentCredentialsSection({
  credentials,
  isLoadingCredentials,
  selectedCredentialId,
  onSelectCredential,
  onOpenDetails,
  onRefresh,
}: StudentCredentialsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<CredentialTypeFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');

  const matchesDateRange = (value: string | null | undefined, range: DateRangeFilter) => {
    if (range === 'ALL') return true;
    if (!value) return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();

    if (range === 'TODAY') {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    }

    if (range === 'THIS_WEEK') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = startOfToday.getDay();
      const diffToMonday = (day + 6) % 7;
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - diffToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return date >= startOfWeek && date < endOfWeek;
    }

    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  };

  const handleShare = async (url: string | null, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!url) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ url });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Ignore share/copy errors in unsupported contexts.
    }
  };

  const filteredCredentials = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return credentials.filter(credential => {
      if (typeFilter !== 'ALL' && credential.type !== typeFilter) {
        return false;
      }
      if (!matchesDateRange(credential.issuedDate || credential.createdAt, dateFilter)) {
        return false;
      }
      if (!keyword) {
        return true;
      }

      const searchable = [
        credential.title,
        credential.type,
        credential.description || '',
        credential.issuedBy?.institution?.institutionName || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [credentials, dateFilter, searchTerm, typeFilter]);

  return (
    <Card>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search credentials..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value as CredentialTypeFilter)}
              className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300"
              aria-label="Filter credentials by type"
            >
              <option value="ALL">All types</option>
              {typeFilters
                .filter(filter => filter !== 'ALL')
                .map(filter => (
                  <option key={filter} value={filter}>
                    {filter}
                  </option>
                ))}
            </select>
            <select
              value={dateFilter}
              onChange={event => setDateFilter(event.target.value as DateRangeFilter)}
              className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300"
              aria-label="Filter credentials by date"
            >
              {dateRangeFilters.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Plus size={14} />
              Reload
            </button>
          </div>
        </div>

        {isLoadingCredentials && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(key => (
              <div key={key} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-slate-100"></div>
            ))}
          </div>
        )}

        {!isLoadingCredentials && filteredCredentials.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No credentials match your current filter.</p>
            <p className="mt-1 text-xs text-slate-500">Try another search keyword or type filter.</p>
          </div>
        )}

        {!isLoadingCredentials && filteredCredentials.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCredentials.map(credential => {
              const fileUrl = getCredentialFileUrl(credential.storageKey);
              const isSelected = credential.id === selectedCredentialId;
              const showImagePreview = Boolean(fileUrl) && isImageFile(credential);
              const showPdfPreview = Boolean(fileUrl) && isPdfFile(credential);

              return (
                <article
                  key={credential.id}
                  onClick={() => onSelectCredential(credential.id)}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
                >
                  <div className="flex flex-1 flex-col p-3" style={paperTextureStyle}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
                        {credential.type}
                      </p>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onSelectCredential(credential.id);
                            onOpenDetails(credential.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          title="More"
                          aria-label="More"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={event => void handleShare(fileUrl, event)}
                          disabled={!fileUrl}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Share"
                          aria-label="Share"
                        >
                          <Share2 size={14} />
                        </button>
                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            download={credential.filename || `${credential.title}.pdf`}
                            onClick={event => event.stopPropagation()}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            title="Download"
                            aria-label="Download"
                          >
                            <Download size={14} />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 opacity-40"
                            title="Download"
                            aria-label="Download"
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mb-3 overflow-hidden rounded-xl bg-slate-50">
                      {showImagePreview ? (
                        <img
                          src={fileUrl as string}
                          alt={credential.title}
                          className="h-36 w-full bg-white object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
                          <FileText size={24} />
                          <p className="text-xs font-medium">{showPdfPreview ? 'PDF Document' : 'No Preview Available'}</p>
                        </div>
                      )}
                    </div>

                    <h3 className="line-clamp-2 text-center text-xl font-semibold leading-tight text-slate-900">{credential.title}</h3>
                  </div>

                </article>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

