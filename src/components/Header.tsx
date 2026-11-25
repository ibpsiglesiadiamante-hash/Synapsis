/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Volume2,
  VolumeX,
  Sparkles,
  QrCode,
  RefreshCw,
  LayoutGrid,
  ArrowLeft,
  Trash2,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { User } from '../types';
import { avatarColor, avatarLetter } from '../lib/db';
import { bioCosmicSynth } from '../lib/audioEngine';

interface HeaderProps {
  currentUser: User;
  theme: string;
  onThemeChange: (newTheme: string) => void;
  onLogout: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenShareModal?: () => void;
  onSyncFirebase?: () => void;
  isSyncing?: boolean;
  onNavigate?: (pageId: string) => void;
  activeTab?: string;
  categoryName?: string;
  recycleCount?: number;
}

export default function Header({
  currentUser,
  theme,
  onThemeChange,
  onLogout,
  onOpenShareModal,
  onSyncFirebase,
  isSyncing = false,
  onNavigate,
  activeTab = 'dashboard',
  recycleCount = 0
}: HeaderProps) {
  const roleLabel =
    (currentUser?.rol &&
      {
        admin: 'Administrador',
        docente: 'Docente',
        estudiante: 'Estudiante',
      }[currentUser.rol]) ||
    'Usuario';

  const canAccessTrash = currentUser?.rol === 'admin' || currentUser?.rol === 'docente';

  const [isMusicPlaying, setIsMusicPlaying] = useState(() => {
    try {
      return bioCosmicSynth.getIsPlaying();
    } catch {
      return false;
    }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  const handleToggleMusic = () => {
    const newState = bioCosmicSynth.togglePlay();
    setIsMusicPlaying(newState);
  };

  return (
    <>
      <header className="header fixed top-0 left-0 right-0 h-[60px] w-full max-w-full bg-white dark:bg-[#071322] border-b border-slate-200 dark:border-cyan-500/30 flex items-center justify-between px-2.5 sm:px-4 gap-2 z-50 shadow-sm theme-bg-surface theme-border">
        {/* ZONA IZQUIERDA: Botón Menú + Marca */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigate && onNavigate('dashboard');
            }}
            className={`flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs select-none active:scale-95 shrink-0 whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 border-slate-200'
                : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 border-teal-400 shadow-teal-500/20'
            }`}
            title="Volver al Menú Principal"
          >
            {activeTab === 'dashboard' ? (
              <LayoutGrid className="w-4 h-4 text-teal-600 shrink-0" />
            ) : (
              <ArrowLeft className="w-4 h-4 shrink-0" />
            )}
            <span className="lg:hidden">Menú</span>
            <span className="hidden lg:inline">{activeTab === 'dashboard' ? 'Menú' : 'Volver a Menú'}</span>
          </button>

          <div
            onClick={() => {
              if (activeTab === 'dashboard') {
                setMobileMenuOpen(false);
                onNavigate && onNavigate('dashboard');
              }
            }}
            className={`header-logo flex items-center gap-2 min-w-0 select-none ${
              activeTab === 'dashboard' ? 'cursor-pointer' : 'cursor-default'
            }`}
            title={activeTab === 'dashboard' ? 'Menú Principal' : 'Synapsis ERP'}
          >
            <div
              className="logo-icon w-8 h-8 sm:w-[34px] sm:h-[34px] rounded-lg flex items-center justify-center text-white text-base sm:text-lg font-bold shadow-xs shrink-0"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              S
            </div>
            <div className="min-w-0">
              <div
                className="logo-text text-[15px] sm:text-[17px] font-bold tracking-tight flex items-center gap-1.5 whitespace-nowrap"
                style={{ color: 'var(--gray-900)' }}
              >
                <span className="truncate">Synapsis</span>
                <span className="hidden sm:inline-flex text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white tracking-wider shrink-0">
                  ERP
                </span>
              </div>
              <div
                className="logo-sub hidden xl:block text-[11px] font-medium truncate"
                style={{ color: 'var(--gray-400)' }}
              >
                Gestión Institucional
              </div>
            </div>
          </div>
        </div>

        {/* ZONA DERECHA MÓVIL (< 768px): Opciones + Cerrar sesión siempre visible */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`relative flex items-center justify-center gap-1.5 min-h-[38px] min-w-[38px] px-2.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              mobileMenuOpen
                ? 'bg-indigo-50 dark:bg-cyan-950/60 border-indigo-300 dark:border-cyan-400 text-indigo-700 dark:text-cyan-300'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-cyan-500/30 text-slate-700 dark:text-slate-100 hover:bg-slate-200'
            }`}
            aria-expanded={mobileMenuOpen}
            aria-label="Opciones, tema y sincronización"
            title="Opciones, tema y perfil"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4 shrink-0" />
            ) : isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-cyan-400 shrink-0" />
            ) : (
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
            )}
            <span className="hidden min-[460px]:inline">Opciones</span>
            {canAccessTrash && recycleCount > 0 && !mobileMenuOpen && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-extrabold px-1.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-xs tabular-nums">
                {recycleCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onLogout();
            }}
            className="flex items-center justify-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 rounded-lg border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="min-[390px]:hidden">Salir</span>
            <span className="hidden min-[390px]:inline">Cerrar sesión</span>
          </button>
        </div>

        {/* ZONA DERECHA TABLET & PC (>= 768px) */}
        <div className="hidden md:flex items-center gap-2 lg:gap-2.5 shrink-0">
          {/* Sintonía Cyber */}
          {theme === 'theme-cyber' && (
            <button
              type="button"
              onClick={handleToggleMusic}
              className={`flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold select-none transition-all duration-300 shadow-sm cursor-pointer shrink-0 whitespace-nowrap ${
                isMusicPlaying
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
              style={{
                boxShadow: isMusicPlaying ? '0 0 8px rgba(16, 185, 129, 0.25)' : 'none',
              }}
              title={isMusicPlaying ? 'Silenciar sintonía cyber' : 'Activar sintonía cyber matrix'}
            >
              {isMusicPlaying ? (
                <Volume2 className="w-3.5 h-3.5 animate-bounce shrink-0" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden xl:flex items-center gap-1 font-medium font-sans">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Sintonía Cyber</span>
              </span>
            </button>
          )}

          {/* Enlace & QR */}
          {onOpenShareModal && (
            <button
              type="button"
              onClick={onOpenShareModal}
              className="flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-cyan-500/30 bg-indigo-50/80 dark:bg-cyan-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-cyan-300 text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 whitespace-nowrap"
              title="Ver enlace oficial synapsis-ec.web.app y código QR"
            >
              <QrCode className="w-4 h-4 text-indigo-600 dark:text-cyan-400 shrink-0" />
              <span className="hidden xl:inline">Enlace &amp; QR</span>
            </button>
          )}

          {/* Sincronizar Nube */}
          {onSyncFirebase && (
            <button
              type="button"
              onClick={onSyncFirebase}
              disabled={isSyncing}
              className="flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-60 shrink-0 whitespace-nowrap"
              title="Sincronizar datos con Supabase PostgreSQL"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden xl:inline">
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Nube'}
              </span>
            </button>
          )}

          {/* Papelera de Reciclaje */}
          {canAccessTrash && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('papelera')}
              className={`flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 whitespace-nowrap ${
                activeTab === 'papelera'
                  ? 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-500/50 text-rose-800 dark:text-rose-200'
                  : 'bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/90 border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300'
              }`}
              title="Abrir Papelera de Reciclaje para restaurar o purgar elementos eliminados"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="hidden lg:inline">Papelera</span>
              {recycleCount > 0 && (
                <span className="bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums leading-none">
                  {recycleCount}
                </span>
              )}
            </button>
          )}

          {/* Selector de Tema (ancho acotado para evitar desbordamiento) */}
          <div className="relative shrink-0">
            <select
              id="themeSelector"
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              aria-label="Seleccionar tema visual"
              className="form-control w-[138px] lg:w-[154px] xl:w-[190px] min-h-[36px] text-xs lg:text-[13px] pr-6 pl-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-cyan-500/35 outline-none cursor-pointer text-slate-800 dark:text-slate-100 bg-white dark:bg-[#030a14] font-medium truncate"
              style={{
                borderColor: 'var(--gray-200)',
                color: 'var(--gray-700)',
              }}
            >
              <option value="theme-academia">🏛 Academia Clásica</option>
              <option value="theme-cyber">⚡ Cyber Matrix</option>
            </select>
          </div>

          {/* Usuario + Botón independiente Cerrar sesión */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-cyan-500/30 shrink-0">
            <div
              className="flex items-center gap-2 min-w-0"
              title={`${currentUser?.nombre || 'Usuario'} · ${roleLabel}`}
            >
              <div
                className="user-avatar w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm shrink-0"
                style={{ backgroundColor: avatarColor(currentUser?.nombre || 'Usuario') }}
              >
                {avatarLetter(currentUser?.nombre || 'U')}
              </div>
              <div className="user-info text-left hidden lg:block min-w-0 max-w-[115px] xl:max-w-[165px]">
                <div className="user-name text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100 truncate">
                  {currentUser?.nombre || 'Usuario'}
                </div>
                <div className="user-role text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {roleLabel}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 min-h-[36px] px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
              title="Cerrar sesión y volver al Portal de Acceso"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* PANEL DESPLEGABLE MÓVIL (< 768px) PARA ANDROID E iOS */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 top-[60px] bg-slate-950/45 backdrop-blur-[1px] z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed top-[60px] left-0 right-0 z-50 md:hidden bg-white dark:bg-[#071322] border-b border-slate-200 dark:border-cyan-500/35 shadow-xl p-3.5 space-y-3 max-h-[calc(100dvh-60px)] overflow-y-auto theme-bg-surface theme-border"
            role="dialog"
            aria-label="Opciones rápidas de usuario y sistema"
          >
            {/* Tarjeta de usuario conectado */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-cyan-500/25">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0"
                  style={{ backgroundColor: avatarColor(currentUser?.nombre || 'Usuario') }}
                >
                  {avatarLetter(currentUser?.nombre || 'U')}
                </div>
                <div className="min-w-0">
                  <div className="user-name text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.nombre || 'Usuario'}
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    {roleLabel}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-600 text-white tracking-wider shrink-0">
                ERP
              </span>
            </div>

            {/* Selector de Tema en móvil */}
            <div className="space-y-1">
              <label
                htmlFor="mobileThemeSelector"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-cyan-300"
              >
                Apariencia / Tema visual
              </label>
              <select
                id="mobileThemeSelector"
                value={theme}
                onChange={(e) => onThemeChange(e.target.value)}
                className="form-control w-full min-h-[42px] text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-cyan-500/35 text-slate-800 dark:text-slate-100 bg-white dark:bg-[#030a14] font-medium"
              >
                <option value="theme-academia">🏛 Academia Clásica</option>
                <option value="theme-cyber">⚡ Cyber Matrix</option>
              </select>
            </div>

            {/* Acciones rápidas en cuadrícula de fácil toque */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
              {onOpenShareModal && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenShareModal();
                  }}
                  className="flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border border-indigo-200 dark:border-cyan-500/35 bg-indigo-50/90 dark:bg-cyan-950/40 text-indigo-700 dark:text-cyan-300 text-xs font-bold cursor-pointer"
                >
                  <QrCode className="w-4 h-4 shrink-0" />
                  <span>Enlace &amp; QR</span>
                </button>
              )}

              {onSyncFirebase && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncFirebase();
                  }}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Nube'}</span>
                </button>
              )}

              {canAccessTrash && onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNavigate('papelera');
                  }}
                  className="flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Papelera</span>
                  {recycleCount > 0 && (
                    <span className="bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums leading-none">
                      {recycleCount}
                    </span>
                  )}
                </button>
              )}

              {theme === 'theme-cyber' && (
                <button
                  type="button"
                  onClick={handleToggleMusic}
                  className={`flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                    isMusicPlaying
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700 text-slate-200'
                  }`}
                >
                  {isMusicPlaying ? (
                    <Volume2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <VolumeX className="w-4 h-4 shrink-0" />
                  )}
                  <span>{isMusicPlaying ? 'Silenciar Sintonía' : 'Sintonía Cyber'}</span>
                </button>
              )}
            </div>

            {/* Botón destacado de Cerrar sesión */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-500/50 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors cursor-pointer shadow-xs"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
