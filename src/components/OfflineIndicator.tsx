import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, X, HardDrive, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getPendingSubmissionIds } from '../lib/db';
import { getQueuedSubmissionCount } from '../lib/offlineSyncQueue';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(!isOnline);
  const [dismissedOffline, setDismissedOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [bgSyncNotice, setBgSyncNotice] = useState<{ count: number; titles?: string[] } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;

    const syncPendingCount = async () => {
      try {
        const localCount = getPendingSubmissionIds().length;
        const idbCount = await getQueuedSubmissionCount();
        if (active) {
          setPendingCount(Math.max(localCount, idbCount));
        }
      } catch {
        if (active) setPendingCount(0);
      }
    };

    syncPendingCount();

    const handleBgSyncComplete = (event: Event) => {
      const custom = event as CustomEvent<{ count?: number; titles?: string[] }>;
      const count = custom.detail?.count ?? 0;
      syncPendingCount();
      if (count > 0) {
        setShowReconnected(false);
        setBgSyncNotice({ count, titles: custom.detail?.titles });
        setTimeout(() => {
          setBgSyncNotice(null);
        }, 5500);
      }
    };

    window.addEventListener('synapsis:bg-sync-complete', handleBgSyncComplete);

    if (!isOnline) {
      wasOfflineRef.current = true;
      setDismissedOffline(false);
      setShowReconnected(false);
      const interval = setInterval(syncPendingCount, 3000);
      return () => {
        active = false;
        clearInterval(interval);
        window.removeEventListener('synapsis:bg-sync-complete', handleBgSyncComplete);
      };
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4200);
      return () => {
        active = false;
        clearTimeout(timer);
        window.removeEventListener('synapsis:bg-sync-complete', handleBgSyncComplete);
      };
    }

    return () => {
      active = false;
      window.removeEventListener('synapsis:bg-sync-complete', handleBgSyncComplete);
    };
  }, [isOnline]);

  if (!isOnline && !dismissedOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-3 left-3 right-3 sm:right-auto sm:bottom-4 sm:left-4 z-50 max-w-md flex items-start sm:items-center gap-2.5 rounded-xl border border-amber-400/50 bg-[#0b172a]/95 backdrop-blur-md px-3.5 py-2.5 text-xs text-amber-100 shadow-2xl"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30">
          <WifiOff className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 leading-snug">
          <div className="flex items-center gap-1.5 font-bold text-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>Modo sin conexión activo</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-300 flex items-center gap-1 flex-wrap">
            <HardDrive className="h-3 w-3 text-cyan-400 shrink-0" />
            <span>
              Usando datos locales en cache.
              {pendingCount > 0
                ? ` (${pendingCount} ${pendingCount === 1 ? 'entrega en cola de Background Sync' : 'entregas en cola de Background Sync'})`
                : ' Tus cambios se guardarán en este dispositivo.'}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissedOffline(true)}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          aria-label="Ocultar aviso de modo sin conexión"
          title="Ocultar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (bgSyncNotice) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-3 left-3 right-3 sm:right-auto sm:bottom-4 sm:left-4 z-50 max-w-md flex items-center gap-2.5 rounded-xl border border-emerald-400/60 bg-emerald-950/95 backdrop-blur-md px-3.5 py-2.5 text-xs font-semibold text-emerald-100 shadow-2xl"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        <span>
          Background Sync completado: {bgSyncNotice.count}{' '}
          {bgSyncNotice.count === 1 ? 'entrega de examen enviada' : 'entregas de examen enviadas'} a la nube.
        </span>
      </div>
    );
  }

  if (isOnline && showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-950/95 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-emerald-100 shadow-xl"
      >
        <Wifi className="h-4 w-4 text-emerald-400 shrink-0" />
        <span>Conexión restablecida · Sincronizando cambios guardados...</span>
      </div>
    );
  }

  return null;
};

export default OfflineIndicator;
