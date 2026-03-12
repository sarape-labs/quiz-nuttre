import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useLeaveConfirmation } from '../../hooks/useLeaveConfirmation';
import ConfirmModal from '../../components/ConfirmModal';

export default function UsersView() {
  const { user, getAuthHeaders } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    email: '',
    password: '',
    rol: 'asistente'
  });

  const nombreRef = useRef<HTMLInputElement>(null);
  const usuarioRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [backModalOpen, setBackModalOpen] = useState(false);

  useEffect(() => {
    if (user?.rol === 'superadmin') {
      fetchUsers();
    }
  }, [user]);

  const blocker = useLeaveConfirmation(isDirty);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', { 
        cache: 'no-store',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Sort users alphabetically by name
        const sortedUsers = data.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
        setUsers(sortedUsers);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
      setError('Error de conexión al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (u: any) => {
    setEditingId(u.id);
    setFormData({
      nombre: u.nombre,
      usuario: u.usuario,
      email: u.email,
      password: '', // Leave empty unless changing
      rol: u.rol
    });
    setShowForm(true);
    setIsDirty(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio.');
      nombreRef.current?.focus();
      return;
    }
    if (!formData.usuario.trim()) {
      setError('El usuario es obligatorio.');
      usuarioRef.current?.focus();
      return;
    }
    if (!formData.email.trim()) {
      setError('El correo electrónico es obligatorio.');
      emailRef.current?.focus();
      return;
    }
    if (!editingId && !formData.password.trim()) {
      setError('La contraseña es obligatoria para nuevos usuarios.');
      passwordRef.current?.focus();
      return;
    }

    try {
      const url = editingId ? `/api/auth/users/${editingId}` : '/api/auth/users';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ nombre: '', usuario: '', email: '', password: '', rol: 'asistente' });
        setIsDirty(false);
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Ocurrió un error al guardar el usuario.');
      }
    } catch (error) {
      console.error('Failed to save user', error);
      setError('Error de conexión.');
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/auth/users/${userToDelete}`, { 
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user', error);
    } finally {
      setDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  if (user?.rol !== 'superadmin') return <div>No tienes permisos para ver esta página.</div>;
  if (loading) return <div>Cargando...</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-900">Usuarios</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestiona los accesos al panel.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ nombre: '', usuario: '', email: '', password: '', rol: 'asistente' });
              setShowForm(true);
              setIsDirty(false);
              setError('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre</label>
                <input ref={nombreRef} type="text" value={formData.nombre} onChange={e => { setFormData({...formData, nombre: e.target.value}); setIsDirty(true); }} className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Usuario</label>
                <input ref={usuarioRef} type="text" value={formData.usuario} onChange={e => { setFormData({...formData, usuario: e.target.value}); setIsDirty(true); }} className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                <input ref={emailRef} type="email" value={formData.email} onChange={e => { setFormData({...formData, email: e.target.value}); setIsDirty(true); }} className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Contraseña {editingId && <span className="text-zinc-400 font-normal">(Dejar en blanco para no cambiar)</span>}
                </label>
                <input ref={passwordRef} type="password" value={formData.password} onChange={e => { setFormData({...formData, password: e.target.value}); setIsDirty(true); }} className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Rol</label>
                <select value={formData.rol} onChange={e => { setFormData({...formData, rol: e.target.value}); setIsDirty(true); }} className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 bg-white">
                  <option value="admin">Admin</option>
                  <option value="asistente">Asistente</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 pt-4">
              {error && (
                <span className="text-sm text-red-500 font-medium">{error}</span>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => { 
                  if (isDirty) {
                    setBackModalOpen(true);
                  } else {
                    setShowForm(false); 
                    setEditingId(null); 
                    setIsDirty(false);
                    setError('');
                  }
                }} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800">
                  {editingId ? 'Actualizar Usuario' : 'Guardar Usuario'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-zinc-200">
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">{u.usuario}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">{u.nombre}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 capitalize">{u.rol}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => handleEdit(u)} className="text-zinc-400 hover:text-zinc-900">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {u.id !== user?.id && (
                      <button onClick={() => {
                        setUserToDelete(u.id);
                        setDeleteModalOpen(true);
                      }} className="text-zinc-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Eliminar Usuario"
        message="¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
      />

      <ConfirmModal
        isOpen={backModalOpen}
        title="Cambios sin guardar"
        message="¿Deseas salir sin guardar los cambios?"
        confirmText="Salir sin guardar"
        onConfirm={() => {
          setShowForm(false);
          setEditingId(null);
          setIsDirty(false);
          setBackModalOpen(false);
        }}
        onCancel={() => setBackModalOpen(false)}
      />
    </motion.div>
  );
}
