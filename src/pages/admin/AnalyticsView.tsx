import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import QuizNav from '../../components/QuizNav';

export default function AnalyticsView() {
  const { getAuthHeaders } = useAuth();
  const { id } = useParams();
  const [analytics, setAnalytics] = useState([]);
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [analyticsRes, quizRes] = await Promise.all([
        fetch(`/api/quizzes/${id}/stats`, { 
          headers: { ...getAuthHeaders() },
          credentials: 'include' 
        }),
        fetch(`/api/quizzes/${id}`, { 
          headers: { ...getAuthHeaders() },
          credentials: 'include' 
        })
      ]);
      
      if (analyticsRes.ok && quizRes.ok) {
        setAnalytics(await analyticsRes.json());
        setQuiz(await quizRes.json());
      } else {
        setErrorMsg('Error al cargar los datos de analítica');
      }
    } catch (error) {
      console.error('Failed to fetch analytics', error);
      setErrorMsg('Error de conexión al cargar analítica');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    setAnalyzing(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/quizzes/${id}/ai-analysis`, { 
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        
        if (data.aiInterpretation) {
          console.log('AI analysis successful');
          setAiAnalysis(data.aiInterpretation || '');
        } else {
          console.warn('Missing aiInterpretation');
          setErrorMsg('API key no configurada o error en el prompt');
        }
      } else {
        setErrorMsg('Error al generar análisis');
      }
    } catch (error) {
      console.error('AI Analysis error', error);
      setErrorMsg('Error de conexión');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  const totalOpens = analytics.filter((a: any) => a.event_type === 'quiz_open').length;
  const totalStarts = analytics.filter((a: any) => a.event_type === 'quiz_start').length;
  const totalCompletes = analytics.filter((a: any) => a.event_type === 'quiz_completed').length;
  const totalLeads = analytics.filter((a: any) => a.event_type === 'lead_submitted').length;

  const completionRate = totalStarts > 0 ? Math.round((totalCompletes / totalStarts) * 100) : 0;
  const leadConversionRate = totalCompletes > 0 ? Math.round((totalLeads / totalCompletes) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4">
        <Link to="/admin" className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-900">Analítica</h1>
          <p className="text-sm text-zinc-500 mt-1">{quiz?.title}</p>
        </div>
      </div>

      {id && <QuizNav quizId={id} slug={quiz?.slug} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Aperturas</p>
          <p className="text-3xl font-semibold text-zinc-900">{totalOpens}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Inicios</p>
          <p className="text-3xl font-semibold text-zinc-900">{totalStarts}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Completados</p>
          <p className="text-3xl font-semibold text-zinc-900">{totalCompletes}</p>
          <p className="text-xs text-zinc-400 mt-2">{completionRate}% de los inicios</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Leads Generados</p>
          <p className="text-3xl font-semibold text-zinc-900">{totalLeads}</p>
          <p className="text-xs text-zinc-400 mt-2">{leadConversionRate}% de completados</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-zinc-600" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Análisis con Inteligencia Artificial</h2>
          </div>
          <div className="flex items-center gap-3">
            {errorMsg && <span className="text-sm text-red-500">{errorMsg}</span>}
            <button
              onClick={handleGenerateAnalysis}
              disabled={analyzing || totalStarts === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generar Análisis
                </>
              )}
            </button>
          </div>
        </div>

        {aiAnalysis && (
          <div className="prose prose-zinc max-w-none">
            <Markdown>{aiAnalysis}</Markdown>
          </div>
        )}
        {!aiAnalysis && !analyzing && (
          <p className="text-sm text-zinc-500 italic">Haz clic en generar análisis para obtener insights sobre el comportamiento de los usuarios.</p>
        )}
      </div>

      <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
          <div className="p-2 bg-zinc-100 rounded-lg">
            <BarChart2 className="w-5 h-5 text-zinc-600" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">Análisis de Abandono</h2>
        </div>
        
        <div className="space-y-4">
          {quiz?.questions?.map((q: any, index: number) => {
            const answered = analytics.filter((a: any) => a.event_type === 'question_answered' && a.question_number === q.order_number).length;
            const percentage = totalStarts > 0 ? Math.round((answered / totalStarts) * 100) : 0;
            
            return (
              <div key={q.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-zinc-700">Pregunta {q.order_number}</span>
                  <span className="text-zinc-500">{answered} respuestas ({percentage}%)</span>
                </div>
                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
