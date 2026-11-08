/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  X, 
  Search, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Lock, 
  User as UserIcon, 
  IdCard, 
  Sparkles,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { User } from '../types';
import { fetchUserByCredentials, resetUserPasswordInCloud } from '../lib/firebase';

interface RecuperarPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onPasswordResetSuccess: (user: User) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  prefillIdentifier?: string;
}

export default function RecuperarPasswordModal({
  isOpen,
  onClose,
  users,
  onPasswordResetSuccess,
  toast,
  prefillIdentifier = ''
}: RecuperarPasswordModalProps) {
  const [activeTab, setActiveTab] = useState<'reset' | 'lookup'>('reset');

  // Step state: 1 = Buscar, 2 = Desafío de Seguridad, 3 = Nueva Contraseña, 4 = Éxito
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [identifier, setIdentifier] = useState(prefillIdentifier);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Security challenge state
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeError, setChallengeError] = useState('');

  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lookup state
  const [lookupCedula, setLookupCedula] = useState('');
  const [lookupResult, setLookupResult] = useState<User | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast(`Copiado al portapapeles: ${text}`, 'info');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const maskName = (name: string) => {
    if (!name) return 'Estudiante';
    const parts = name.trim().split(/\s+/);
    return parts.map(p => p[0] + '*'.repeat(Math.max(1, p.length - 1))).join(' ');
  };

  const maskEmail = (email: string) => {
    if (!email) return 'c****@synapsis.edu';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const maskedUser = user.length > 2 ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1] : user[0] + '*';
    return `${maskedUser}@${domain}`;
  };

  // STEP 1: Search user by email, code, cedula, or ID
  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      toast('Ingresa tu correo, cédula o código institucional', 'warning');
      return;
    }

    setIsSearching(true);
    setChallengeError('');

    try {
      // 1. Search in local memory
      const cleanLower = cleanId.toLowerCase();
      let user = users.find(u => {
        const uEmail = (u.email || '').trim().toLowerCase();
        const uCode = (u.codigo || '').trim().toLowerCase();
        const uCedula = (u.cedula || '').trim().toLowerCase();
        const uId = (u.id || '').trim().toLowerCase();
        return uEmail === cleanLower || uCode === cleanLower || uCedula === cleanLower || uId === cleanLower;
      });

      // 2. Fallback to Cloud Firestore live search
      if (!user) {
        user = await fetchUserByCredentials(cleanId) || undefined;
      }

      if (!user) {
        toast('No se encontró ninguna cuenta asociada a estos datos. Verifica o consulta con tu cédula.', 'error');
        setIsSearching(false);
        return;
      }

      setFoundUser(user);
      setStep(2);
      toast(`Cuenta identificada: ${user.nombre}`, 'info');
    } catch (err) {
      toast('Error al consultar el servidor. Intenta nuevamente.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // STEP 2: Verify security challenge
  const handleVerifyChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundUser) return;

    const answer = challengeAnswer.trim().toLowerCase();
    if (!answer) {
      setChallengeError('Por favor responde al dato de seguridad para continuar.');
      return;
    }

    const regCedula = (foundUser.cedula || '').trim().toLowerCase();
    const regCode = (foundUser.codigo || '').trim().toLowerCase();
    const regEmail = (foundUser.email || '').trim().toLowerCase();
    const regPhone = (foundUser.celular || (foundUser as any).telefono || '').trim().toLowerCase();
    const regFirstName = (foundUser.nombre || '').trim().toLowerCase().split(' ')[0];

    // Acceptance condition: matches cedula, or student code, or phone, or email, or first name
    const isCedulaMatch = regCedula && (answer === regCedula || regCedula.includes(answer));
    const isCodeMatch = regCode && answer === regCode;
    const isEmailMatch = regEmail && answer === regEmail;
    const isPhoneMatch = regPhone && (answer === regPhone || regPhone.endsWith(answer));
    const isNameMatch = regFirstName && (answer === regFirstName || answer === foundUser.nombre.trim().toLowerCase());

    if (isCedulaMatch || isCodeMatch || isEmailMatch || isPhoneMatch || isNameMatch) {
      setChallengeError('');
      setStep(3);
      toast('Identidad confirmada exitosamente. Ahora define tu nueva contraseña.', 'success');
    } else {
      setChallengeError('El dato ingresado no coincide con los registros del estudiante. Intenta con tu número de cédula, código institucional o celular registrado.');
    }
  };

  // STEP 3: Save new password
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundUser) return;

    const cleanPass = newPassword.trim();
    if (cleanPass.length < 4) {
      toast('La nueva contraseña debe tener al menos 4 caracteres', 'warning');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      toast('Las contraseñas no coinciden. Escríbelas exactamente iguales.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await resetUserPasswordInCloud(foundUser, cleanPass);
      onPasswordResetSuccess(updated);
      setStep(4);
      toast('¡Contraseña actualizada con éxito!', 'success');
    } catch (err) {
      console.error('Error resetting password:', err);
      toast('Hubo un error al guardar la contraseña en la nube. Intenta nuevamente.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // LOOKUP BY CEDULA
  const handleLookupByCedula = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCedula = lookupCedula.trim();
    if (!cleanCedula) {
      toast('Ingresa tu número de cédula o documento', 'warning');
      return;
    }

    setIsLookingUp(true);
    setLookupResult(null);

    try {
      // 1. Search locally
      let user = users.find(u => (u.cedula || '').trim() === cleanCedula);

      // 2. Search cloud
      if (!user) {
        user = await fetchUserByCredentials(cleanCedula) || undefined;
      }

      if (!user) {
        toast('No se encontró ningún estudiante con esa cédula registrada.', 'error');
        setIsLookingUp(false);
        return;
      }

      setLookupResult(user);
      toast(`Ficha encontrada: ${user.nombre}`, 'success');
    } catch (err) {
      toast('Error al consultar datos.', 'error');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleResetWorkflow = () => {
    setStep(1);
    setIdentifier('');
    setFoundUser(null);
    setChallengeAnswer('');
    setChallengeError('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#0b1e24] border border-cyan-500/40 rounded-3xl w-full max-w-lg shadow-2xl shadow-cyan-950/60 overflow-hidden text-left relative my-8">
        {/* Glow header bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-300"></div>

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-start justify-between gap-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-300 shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Seguridad y Acceso de Estudiantes</span>
              </h3>
              <p className="text-xs text-teal-200/90 font-medium">
                Restablece tu contraseña o consulta tus credenciales institucionales
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/70 border-b border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('reset');
              handleResetWorkflow();
            }}
            className={`py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'reset'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Restablecer Contraseña</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lookup')}
            className={`py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'lookup'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <IdCard className="w-3.5 h-3.5" />
            <span>Consultar mis Credenciales</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {activeTab === 'reset' ? (
            <div>
              {/* STEP 1: Search Account */}
              {step === 1 && (
                <form onSubmit={handleSearchUser} className="space-y-4">
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
                      <span>🔍</span>
                      <span>Paso 1: Localiza tu cuenta de estudiante</span>
                    </p>
                    <p className="text-teal-100/80">
                      Ingresa tu correo institucional, tu número de cédula o tu código de estudiante de 4 caracteres (ej: <span className="font-mono text-cyan-300 font-bold">X9B2</span>).
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                      Correo, Cédula o Código Institucional
                    </label>
                    <div className="bg-slate-900 border border-slate-700 focus-within:border-cyan-400 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        placeholder="ej: carlos.perez@synapsis.edu, 10203040 o X9B2"
                        className="bg-transparent w-full text-sm text-white placeholder-slate-500 outline-none font-medium"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                    >
                      {isSearching ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Buscando cuenta...</span>
                        </>
                      ) : (
                        <>
                          <span>Buscar mi cuenta</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Identity Security Challenge */}
              {step === 2 && foundUser && (
                <form onSubmit={handleVerifyChallenge} className="space-y-4">
                  {/* Account Found Banner */}
                  <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                        Cuenta localizada
                      </span>
                      <h4 className="text-sm font-black text-white">
                        {maskName(foundUser.nombre)}
                      </h4>
                      <p className="text-xs text-teal-200/80 font-mono">
                        {maskEmail(foundUser.email)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <span>🛡️</span>
                      <span>Paso 2: Validación de Seguridad</span>
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Para garantizar que eres el titular de la cuenta, introduce tu <strong>número de cédula</strong>, tu <strong>código de 4 caracteres</strong>, o tu <strong>celular registrado</strong>:
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                      Dato de validación (Cédula, Código o Celular)
                    </label>
                    <div className="bg-slate-900 border border-slate-700 focus-within:border-cyan-400 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <IdCard className="w-4 h-4 text-cyan-400 shrink-0" />
                      <input
                        type="text"
                        required
                        value={challengeAnswer}
                        onChange={e => {
                          setChallengeAnswer(e.target.value);
                          setChallengeError('');
                        }}
                        placeholder="Ingresa tu cédula, código o celular registrado"
                        className="bg-transparent w-full text-sm text-white placeholder-slate-500 outline-none font-medium"
                        autoFocus
                      />
                    </div>
                    {challengeError && (
                      <p className="text-xs text-rose-400 font-medium mt-1.5 flex items-start gap-1">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{challengeError}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      ← Cambiar cuenta
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-600/20"
                    >
                      <span>Validar identidad</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Define New Password */}
              {step === 3 && foundUser && (
                <form onSubmit={handleSaveNewPassword} className="space-y-4">
                  <div className="bg-cyan-950/40 border border-cyan-500/40 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 mb-1">
                      <span>🔑</span>
                      <span>Paso 3: Establece tu nueva contraseña</span>
                    </p>
                    <p className="text-xs text-teal-100/90 leading-relaxed">
                      Actualizando clave para: <strong className="text-white">{foundUser.nombre}</strong> ({foundUser.email})
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                      Nueva Contraseña
                    </label>
                    <div className="bg-slate-900 border border-slate-700 focus-within:border-cyan-400 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="bg-transparent w-full text-sm text-white placeholder-slate-500 outline-none font-medium"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="text-slate-400 hover:text-slate-200 transition p-1"
                        title={showPass ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                      Confirmar Nueva Contraseña
                    </label>
                    <div className="bg-slate-900 border border-slate-700 focus-within:border-cyan-400 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                        className="bg-transparent w-full text-sm text-white placeholder-slate-500 outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      ← Volver
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Guardando en la nube...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Guardar y Actualizar Contraseña</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 4: Success Message */}
              {step === 4 && foundUser && (
                <div className="text-center py-4 space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white">
                      ¡Contraseña restablecida con éxito!
                    </h4>
                    <p className="text-xs text-teal-200/90 max-w-sm mx-auto mt-1 leading-relaxed">
                      La nueva contraseña de <strong>{foundUser.nombre}</strong> ha sido sincronizada en Cloud Firestore y la base de datos.
                    </p>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl text-left space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Usuario / Correo:</span>
                      <span className="font-mono font-bold text-cyan-300">{foundUser.email}</span>
                    </div>
                    {foundUser.codigo && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Código de Estudiante:</span>
                        <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {foundUser.codigo}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-3 px-5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-sm transition cursor-pointer shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-2"
                    >
                      <span>Iniciar Sesión Ahora</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: LOOKUP CREDENTIALS BY CEDULA */
            <div className="space-y-4">
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
                  <span>🪪</span>
                  <span>Consulta de Ficha y Credenciales con Cédula</span>
                </p>
                <p className="text-teal-100/80">
                  Si no recuerdas qué correo o código te asignó la institución, escribe tu número de cédula o documento de identidad registrado.
                </p>
              </div>

              <form onSubmit={handleLookupByCedula} className="space-y-3">
                <div>
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                    Número de Cédula / Documento de Identidad
                  </label>
                  <div className="bg-slate-900 border border-slate-700 focus-within:border-cyan-400 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                    <IdCard className="w-4 h-4 text-cyan-400 shrink-0" />
                    <input
                      type="text"
                      required
                      value={lookupCedula}
                      onChange={e => setLookupCedula(e.target.value)}
                      placeholder="ej: 10203040 o tu documento sin puntos"
                      className="bg-transparent w-full text-sm text-white placeholder-slate-500 outline-none font-medium"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLookingUp}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  {isLookingUp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Consultando sistema...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Consultar mis datos oficiales</span>
                    </>
                  )}
                </button>
              </form>

              {lookupResult && (
                <div className="bg-slate-900/90 border border-cyan-500/40 p-4 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">
                      Ficha Oficial Encontrada
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                      {lookupResult.rol === 'estudiante' ? '🎓 Estudiante Activo' : lookupResult.rol}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Nombre Completo:</span>
                      <strong className="text-white text-sm block">{lookupResult.nombre}</strong>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Correo Institucional:</span>
                        <span className="text-cyan-300 font-mono font-bold text-xs">{lookupResult.email}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(lookupResult.email, 'email')}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        title="Copiar correo"
                      >
                        {copiedField === 'email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {lookupResult.codigo && (
                      <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Código de Acceso:</span>
                          <span className="text-white font-mono font-black text-sm tracking-wider">{lookupResult.codigo}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(lookupResult.codigo || '', 'codigo')}
                          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                          title="Copiar código"
                        >
                          {copiedField === 'codigo' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reset');
                        setFoundUser(lookupResult);
                        setStep(3);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs transition border border-cyan-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Cambiar contraseña de esta cuenta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
