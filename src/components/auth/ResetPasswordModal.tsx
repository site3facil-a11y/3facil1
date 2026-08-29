import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { apiService } from '../../services/apiService';

interface ResetPasswordModalProps {
  token: string;
  onDone: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ token, onDone }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'As senhas não coincidem. Digite a mesma senha nos dois campos.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiService.resetPassword(token, newPassword);
      if (res.success) {
        setStatus({ type: 'success', message: res.message || 'Senha redefinida com sucesso!' });
      } else {
        setStatus({ type: 'error', message: res.message || 'Não foi possível redefinir a senha.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden bg-slate-900 border-slate-800 text-white">
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/60 flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-purple-600/10 text-purple-400 border border-purple-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold">Criar Nova Senha</h3>
            <p className="text-xs text-slate-400">Painel de controle SaaS 3fácil.com</p>
          </div>
        </div>

        <div className="p-6">
          {status?.type === 'success' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{status.message}</span>
              </div>
              <button
                onClick={onDone}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/30 transition"
              >
                Ir para o Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-400">
                Digite a nova senha para acessar o Painel Master. Use pelo menos 6 caracteres.
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-300">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-sm pl-3.5 pr-10 py-2.5 rounded-xl border focus:outline-none focus:border-purple-500 transition bg-slate-950 border-slate-800 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-300">Confirmar Nova Senha</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-purple-500 transition bg-slate-950 border-slate-800 text-white"
                />
              </div>

              {status?.type === 'error' && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{status.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center space-x-2 shadow-lg transition disabled:opacity-60 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30"
              >
                <KeyRound className="h-4 w-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar Nova Senha'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
