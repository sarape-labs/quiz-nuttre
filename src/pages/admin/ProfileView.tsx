import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';

export default function ProfileView() {
  const { user, login, getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || '',
        usuario: user.usuario || '',
        email: user.email || '',
        password: ''
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(true);
        setFormData(prev => ({ ...prev, password: '' })); // Clear password field
        // Update user context
        if (data.user) {
          login(data.user, data.token || localStorage.getItem('auth_token') || '');
        }
      } else {
        setErrorMsg(data.error || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Failed to update profile', error);
      setErrorMsg('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-900">Mi Perfil</h1>
        <p className="text-sm text-zinc-500 mt-1">Actualiza tu información personal y credenciales de acceso.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100">
            Perfil actualizado exitosamente.
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Nombre</label>
              <input 
                required 
                type="text" 
                value={formData.nombre} 
                onChange={e => setFormData({...formData, nombre: e.target.value})} 
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Usuario</label>
              <input 
                required 
                type="text" 
                value={formData.usuario} 
                onChange={e => setFormData({...formData, usuario: e.target.value})} 
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
              <input 
                required 
                type="email" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" 
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100">
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Nueva Contraseña
            </label>
            <input 
              type="password" 
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
              placeholder="Dejar en blanco para no cambiar"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" 
            />
            <p className="text-xs text-zinc-500 mt-2">
              Si escribes una contraseña aquí, tu contraseña actual será reemplazada.
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
