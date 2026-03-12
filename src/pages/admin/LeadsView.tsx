import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import QuizNav from '../../components/QuizNav';
import ConfirmModal from '../../components/ConfirmModal';

export default function LeadsView() {
  const { getAuthHeaders } = useAuth();
  const { id } = useParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [error, setError] = useState('');
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, quizRes] = await Promise.all([
        fetch(`/api/quizzes/${id}/leads`, { 
          headers: { ...getAuthHeaders() },
          credentials: 'include' 
        }),
        fetch(`/api/quizzes/${id}`, { 
          headers: { ...getAuthHeaders() },
          credentials: 'include' 
        })
      ]);
      
      if (leadsRes.ok && quizRes.ok) {
        setLeads(await leadsRes.json());
        setQuiz(await quizRes.json());
      } else {
        setError('Error al cargar los datos');
      }
    } catch (error) {
      console.error('Failed to fetch leads', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Nombre,Email,Fecha\n"
      + leads.map((l: any) => `${l.nombre},${l.email},${new Date(l.created_at).toLocaleString()}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_${quiz?.slug || 'quiz'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/quizzes/${id}/leads/${leadToDelete}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (res.ok) {
        setLeads(leads.filter((l: any) => l.id !== leadToDelete));
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Failed to delete lead:', errData);
      }
    } catch (error) {
      console.error('Error deleting lead', error);
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setLeadToDelete(null);
    }
  };

  if (loading) return <div className="p-8">Cargando leads...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-900">Leads Capturados</h1>
            <p className="text-sm text-zinc-500 mt-1">{quiz?.title}</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={leads.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {id && <QuizNav quizId={id} slug={quiz?.slug} />}

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {leads.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                    {lead.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                    {lead.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setLeadToDelete(lead.id);
                        setDeleteModalOpen(true);
                      }}
                      className="text-zinc-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar lead"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No hay leads capturados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onCancel={() => {
          setDeleteModalOpen(false);
          setLeadToDelete(null);
        }}
        onConfirm={handleDeleteLead}
        title="Eliminar Lead"
        message="¿Estás seguro de que deseas eliminar este lead de forma definitiva? Esta acción no se puede deshacer."
        confirmText={deleting ? 'Eliminando...' : 'Eliminar Definitivamente'}
        cancelText="Cancelar"
        isLoading={deleting}
      />
    </motion.div>
  );
}
