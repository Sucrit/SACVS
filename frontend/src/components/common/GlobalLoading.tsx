import { Loader2 } from 'lucide-react';
import logo from '../../assets/logo2.png';

export default function GlobalLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-6">
        <img src={logo} alt="SACVS Logo" className="h-10 w-auto opacity-80" />
        <div className="flex items-center gap-3 text-sm font-medium text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          Loading...
        </div>
      </div>
    </div>
  );
}
