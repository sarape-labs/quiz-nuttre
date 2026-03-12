import { Link, useLocation } from 'react-router-dom';
import { Edit2, Users, BarChart2, ExternalLink } from 'lucide-react';

export default function QuizNav({ quizId, slug, isNew }: { quizId?: string, slug?: string, isNew?: boolean }) {
  const location = useLocation();
  const path = location.pathname;

  const isActive = (route: string) => {
    if (!quizId) return false;
    if (route === '') return path.endsWith(quizId) || path.endsWith(`${quizId}/`);
    return path.endsWith(route) || path.endsWith(`${route}/`);
  };

  return (
    <div className="flex items-center gap-2 mb-8 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
      {isNew ? (
        <span className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap bg-zinc-900 text-white">
          <Edit2 className="w-4 h-4" />
          Editar
        </span>
      ) : (
        <Link
          to={`/admin/quizzes/${quizId}`}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${isActive('') ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          <Edit2 className="w-4 h-4" />
          Editar
        </Link>
      )}
      
      {isNew ? (
        <span className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap text-zinc-400 cursor-not-allowed" title="Guarda el quiz primero para ver los leads">
          <Users className="w-4 h-4" />
          Leads
        </span>
      ) : (
        <Link
          to={`/admin/quizzes/${quizId}/leads`}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${isActive('leads') ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          <Users className="w-4 h-4" />
          Leads
        </Link>
      )}

      {isNew ? (
        <span className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap text-zinc-400 cursor-not-allowed" title="Guarda el quiz primero para ver la data">
          <BarChart2 className="w-4 h-4" />
          Data
        </span>
      ) : (
        <Link
          to={`/admin/quizzes/${quizId}/analytics`}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${isActive('analytics') ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
        >
          <BarChart2 className="w-4 h-4" />
          Data
        </Link>
      )}

      {slug && !isNew && (
        <Link
          to={`/?quiz=${slug}`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors whitespace-nowrap ml-auto"
        >
          <ExternalLink className="w-4 h-4" />
          Ver Quiz
        </Link>
      )}
    </div>
  );
}
