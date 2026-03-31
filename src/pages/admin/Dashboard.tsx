import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, BarChart2, Users, ExternalLink, Copy, Trash2, ArchiveRestore, ArchiveX, Folder, Trash, ArrowUpDown, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';

type SortOption = 'newest' | 'oldest' | 'name' | 'slug';

export default function AdminDashboard() {
  const { user, getAuthHeaders } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: '', title: '', permanent: false });
  const [restoreModal, setRestoreModal] = useState({ isOpen: false, id: '', title: '' });

  useEffect(() => {
    fetchQuizzes();
  }, [viewMode]);

  const fetchQuizzes = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = viewMode === 'trash' ? '/api/quizzes/trash' : '/api/quizzes';
      const res = await fetch(endpoint, { 
        headers: { ...getAuthHeaders() },
        credentials: 'include' 
      });
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al cargar quizzes');
        console.error('Fetch quizzes error:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch quizzes', error);
      setError('Error de conexión al cargar quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const { id, permanent } = deleteModal;
    try {
      const endpoint = permanent ? `/api/quizzes/${id}/permanent` : `/api/quizzes/${id}`;
      const res = await fetch(endpoint, { 
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (res.ok) {
        fetchQuizzes();
      }
    } catch (error) {
      console.error('Error deleting quiz', error);
    } finally {
      setDeleteModal({ isOpen: false, id: '', title: '', permanent: false });
    }
  };

  const handleRestore = async () => {
    const { id } = restoreModal;
    try {
      const res = await fetch(`/api/quizzes/${id}/restore`, { 
        method: 'PUT',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (res.ok) {
        fetchQuizzes();
      }
    } catch (error) {
      console.error('Error restoring quiz', error);
    } finally {
      setRestoreModal({ isOpen: false, id: '', title: '' });
    }
  };

  const sortedQuizzes = [...quizzes].sort((a: any, b: any) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'name':
        return a.title.localeCompare(b.title);
      case 'slug':
        return (a.slug || '').localeCompare(b.slug || '');
      default:
        return 0;
    }
  });

  if (loading) {
    return <div className="animate-pulse flex space-x-4">Cargando quizzes...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={fetchQuizzes}
          className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-zinc-900">Cuestionarios</h1>
          <p className="text-zinc-500 mt-1">Gestiona tus campañas y cuestionarios.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-white border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer shadow-sm"
            >
              <option value="newest">Más nuevos</option>
              <option value="oldest">Más antiguos</option>
              <option value="name">Nombre (A-Z)</option>
              <option value="slug">Slug (A-Z)</option>
            </select>
            <ArrowUpDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex bg-zinc-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('active')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === 'active' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              <Folder className="w-4 h-4" />
              Escritorio
            </button>
            <button
              onClick={() => setViewMode('trash')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === 'trash' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              title="Basurero"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
          <Link
            to="/admin/quizzes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Quiz
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedQuizzes.map((quiz: any) => {
          const canEdit = user?.rol === 'superadmin' || user?.rol === 'admin' || quiz.created_by === user?.id;
          
          return (
          <div key={quiz.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md relative group">
            {quiz.cover_image ? (
              <div className="w-full aspect-video relative bg-zinc-100 border-b border-zinc-100">
                <img src={quiz.cover_image} alt={quiz.title} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="w-full aspect-video bg-zinc-50 border-b border-zinc-100 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-zinc-300" />
              </div>
            )}
            
            <div className="p-5 flex-1 pr-12">
              <h3 className="text-lg font-semibold text-zinc-900 line-clamp-2 leading-tight">{quiz.title}</h3>
              <p className="text-xs text-zinc-500 mt-1.5 font-mono truncate">/{quiz.slug}</p>
            </div>
            
            {canEdit && (
              <button
                onClick={() => setDeleteModal({ isOpen: true, id: quiz.id, title: quiz.title, permanent: viewMode === 'trash' })}
                className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                title={viewMode === 'trash' ? "Borrar Permanentemente" : "Mover a Basurero"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            <div className={`border-t border-zinc-100 bg-zinc-50/50 p-3 grid gap-1 ${viewMode === 'trash' ? 'grid-cols-2' : 'grid-cols-4'}`}>
              {viewMode === 'trash' ? (
                <>
                  {canEdit ? (
                    <>
                      <button
                        onClick={() => setRestoreModal({ isOpen: true, id: quiz.id, title: quiz.title })}
                        className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                        title="Restaurar"
                      >
                        <ArchiveRestore className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Restaurar</span>
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, id: quiz.id, title: quiz.title, permanent: true })}
                        className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        title="Borrar Definitivo"
                      >
                        <ArchiveX className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Borrar Definitivo</span>
                      </button>
                    </>
                  ) : (
                    <div className="col-span-2 text-center text-xs text-zinc-400 py-2">
                      No tienes permisos para restaurar o borrar este quiz
                    </div>
                  )}
                </>
              ) : (
                <>
                  {canEdit ? (
                    <Link
                      to={`/admin/quizzes/${quiz.id}`}
                      className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-zinc-200/50 text-zinc-600 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4 mb-1" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Editar</span>
                    </Link>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center p-2 rounded-lg text-zinc-300 cursor-not-allowed"
                      title="No tienes permisos para editar"
                    >
                      <Edit2 className="w-4 h-4 mb-1" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Editar</span>
                    </div>
                  )}
                  <Link
                    to={`/admin/quizzes/${quiz.id}/leads`}
                    className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-zinc-200/50 text-zinc-600 transition-colors"
                    title="Leads"
                  >
                    <Users className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Leads</span>
                  </Link>
                  <Link
                    to={`/admin/quizzes/${quiz.id}/analytics`}
                    className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-zinc-200/50 text-zinc-600 transition-colors"
                    title="Analítica"
                  >
                    <BarChart2 className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Data</span>
                  </Link>
                  <Link
                    to={`/?quiz=${quiz.slug}`}
                    className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-zinc-200/50 text-zinc-600 transition-colors"
                    title="Ver Quiz"
                  >
                    <ExternalLink className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Ver</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )})}

        {quizzes.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-200 rounded-2xl">
            <p className="text-zinc-500 mb-4">{viewMode === 'trash' ? 'El basurero está vacío.' : 'No hay quizzes creados todavía.'}</p>
            {viewMode === 'active' && (
              <Link
                to="/admin/quizzes/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear el primero
              </Link>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.permanent ? "Eliminar Quiz Permanentemente" : "Mover a Basurero"}
        message={deleteModal.permanent 
          ? `¿Estás seguro de que quieres borrar el quiz "${deleteModal.title}" permanentemente? Esta acción no se puede deshacer y borrará todos los leads y analíticas asociados.`
          : `¿Estás seguro de que quieres mover el quiz "${deleteModal.title}" al basurero? Podrás restaurarlo más tarde.`}
        confirmText={deleteModal.permanent ? "Eliminar Permanentemente" : "Mover a Basurero"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: '', title: '', permanent: false })}
      />

      <ConfirmModal
        isOpen={restoreModal.isOpen}
        title="Restaurar Quiz"
        message={`¿Deseas restaurar el quiz "${restoreModal.title}"? Volverá a estar activo y visible.`}
        confirmText="Restaurar"
        onConfirm={handleRestore}
        onCancel={() => setRestoreModal({ isOpen: false, id: '', title: '' })}
      />
    </motion.div>
  );
}
