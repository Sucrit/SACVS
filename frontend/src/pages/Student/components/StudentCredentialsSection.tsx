import { useMemo, useState } from 'react';
import { Download, Eye, Plus, Search } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import { Credential, CredentialType } from '../../../services/credential.service';
import { formatDate, getCredentialFileUrl } from '../utils';

type CredentialTypeFilter = 'ALL' | CredentialType;

interface StudentCredentialsSectionProps {
  credentials: Credential[];
  isLoadingCredentials: boolean;
  selectedCredentialId: string | null;
  onSelectCredential: (credentialId: string) => void;
  onRefresh: () => void;
}

const typeFilters: CredentialTypeFilter[] = ['ALL', 'TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];

const cardAccentByType: Record<CredentialType, string> = {
  TRANSCRIPT: 'from-sky-500 via-sky-400 to-sky-500',
  DIPLOMA: 'from-amber-500 via-amber-400 to-amber-500',
  CERTIFICATE: 'from-violet-500 via-violet-400 to-violet-500',
  DEGREE: 'from-emerald-500 via-emerald-400 to-emerald-500',
  LICENSE: 'from-rose-500 via-rose-400 to-rose-500',
};

export default function StudentCredentialsSection({
  credentials,
  isLoadingCredentials,
  selectedCredentialId,
  onSelectCredential,
  onRefresh,
}: StudentCredentialsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<CredentialTypeFilter>('ALL');

  const filteredCredentials = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return credentials.filter(credential => {
      if (typeFilter !== 'ALL' && credential.type !== typeFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }

      const searchable = [
        credential.title,
        credential.type,
        credential.description || '',
        credential.issuedById,
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [credentials, searchTerm, typeFilter]);

  return (
    <Card
      title="My Credentials"
      action={
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          <Plus size={14} />
          Reload
        </button>
      }
    >
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
          <div className="flex flex-wrap gap-2">
            {typeFilters.map(filter => {
              const isActive = filter === typeFilter;
              return (
                <button
                  key={filter}
                  onClick={() => setTypeFilter(filter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {filter === 'ALL' ? 'All' : filter}
                </button>
              );
            })}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredCredentials.map(credential => {
              const fileUrl = getCredentialFileUrl(credential.storageKey);
              const isSelected = credential.id === selectedCredentialId;

              return (
                <article
                  key={credential.id}
                  onClick={() => onSelectCredential(credential.id)}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${cardAccentByType[credential.type]}`}></div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{credential.title}</h3>
                      <Badge status={credential.status} />
                    </div>

                    <p className="text-xs text-slate-500">{credential.type}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">{credential.description || 'No description provided.'}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <div>
                        <p className="uppercase tracking-[0.08em] text-slate-400">Issued</p>
                        <p className="mt-1 text-slate-700">{formatDate(credential.issuedDate || credential.createdAt)}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.08em] text-slate-400">Expires</p>
                        <p className="mt-1 text-slate-700">{formatDate(credential.expiryDate)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {credential.fileHash ? 'File Attached' : 'No File'}
                    </span>
                    {fileUrl ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            window.open(fileUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <a
                          href={fileUrl}
                          download={credential.filename || `${credential.title}.pdf`}
                          onClick={event => event.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Download size={12} />
                          Download
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Pending upload</span>
                    )}
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

