import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'menu' | 'login';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const label = isInstallable ? 'Instalar App' : 'Instalar en iOS';

  const buttonClass =
    variant === 'header'
      ? 'flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 whitespace-nowrap'
      : variant === 'menu'
        ? 'flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200 text-xs font-bold cursor-pointer'
        : 'w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#22d3ee]/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-[#22d3ee] text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2';

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        className={buttonClass}
        title="Instalar Synapsis ERP en este dispositivo para acceso rápido y uso sin conexión"
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className={variant === 'header' ? 'hidden xl:inline' : ''}>{label}</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Instrucciones de instalación en iPhone o iPad"
        >
          <div className="w-full max-w-sm rounded-2xl border border-cyan-500/35 bg-[#0c1626] p-5 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#22d3ee]" />
                Instalar en iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                aria-label="Cerrar instrucciones"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Para usar <strong className="text-white">Synapsis ERP</strong> incluso en zonas de baja cobertura:
            </p>
            <ol className="mt-3 space-y-2 text-sm text-slate-200 list-decimal list-inside">
              <li>
                Toca el botón <strong className="text-[#22d3ee]">Compartir</strong> en la barra inferior de Safari.
              </li>
              <li>
                Desliza hacia abajo y selecciona{' '}
                <strong className="text-[#22d3ee]">Agregar a pantalla de inicio</strong>.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[42px] rounded-xl bg-[#22d3ee] hover:bg-[#67e8f9] text-slate-950 text-sm font-bold transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallButton;
