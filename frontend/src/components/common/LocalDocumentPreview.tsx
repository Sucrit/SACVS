import { useEffect, useState } from 'react';
import { Eye, FileText, Image as ImageIcon } from 'lucide-react';

interface LocalDocumentPreviewProps {
  file: File | null;
  title?: string;
}

export default function LocalDocumentPreview({
  file,
  title = 'Document Preview',
}: LocalDocumentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) return null;

  const mimeType = file.type || '';
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Review the selected file before continuing.
          </p>
        </div>
        <div className="max-w-[60%] truncate rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
          {file.name}
        </div>
      </div>

      <div className="p-4">
        {previewUrl && isPdf && (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            <iframe
              title="Selected credential preview"
              src={previewUrl}
              className="h-[340px] w-full bg-white md:h-[420px]"
            />
          </div>
        )}

        {previewUrl && isImage && (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <img
              src={previewUrl}
              alt={file.name}
              className="mx-auto max-h-[420px] w-auto max-w-full rounded-md object-contain"
            />
          </div>
        )}

        {!isPdf && !isImage && (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-500 shadow-sm ring-1 ring-neutral-200">
              <FileText size={20} />
            </div>
            <p className="text-sm font-semibold text-neutral-800">Preview unavailable for this file type.</p>
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              You can still upload this file and continue issuing the credential.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2.5 py-1 ring-1 ring-neutral-200">
            <Eye size={12} />
            Local preview
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2.5 py-1 ring-1 ring-neutral-200">
            {isPdf ? <FileText size={12} /> : <ImageIcon size={12} />}
            {mimeType || 'Unknown type'}
          </span>
        </div>
      </div>
    </div>
  );
}
