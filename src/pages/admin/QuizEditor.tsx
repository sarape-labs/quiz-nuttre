import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useLeaveConfirmation } from '../../hooks/useLeaveConfirmation';
import QuizNav from '../../components/QuizNav';
import ConfirmModal from '../../components/ConfirmModal';
import ImageUpload from '../../components/ImageUpload';
import MultiImageUpload from '../../components/MultiImageUpload';

const THEMES = [
  { id: 'classic', name: 'Clásico', primary: '#18181b', secondary: '#f4f4f5' },
  { id: 'orange', name: 'Orange', primary: '#ff6600', secondary: '#fff0e6' },
  { id: 'ocean', name: 'Ocean', primary: '#0ea5e9', secondary: '#e0f2fe' },
  { id: 'emerald', name: 'Emerald', primary: '#10b981', secondary: '#d1fae5' },
  { id: 'violet', name: 'Violet', primary: '#8b5cf6', secondary: '#ede9fe' },
  { id: 'custom', name: 'Personalizado', primary: '#000000', secondary: '#f4f4f5' },
];

export default function QuizEditor() {
  const { user, getAuthHeaders } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const questionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const positiveRefs = useRef<(HTMLInputElement | null)[]>([]);
  const negativeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  const blocker = useLeaveConfirmation(isDirty && !saving && !deleting);
  
  const [quiz, setQuiz] = useState({
    title: '',
    subtitle: '',
    cover_image: '',
    slug: '',
    number_of_questions: 5,
    ai_prompt: 'Interpreta las respuestas del usuario y genera una lectura motivadora, invitándolo a seguir adelante.',
    ai_max_words: 50,
    redirect_potential: '',
    redirect_not_interested: '',
    result_closing_text: 'Solo algunas personas tienen el perfil adecuado para aprovechar esta oportunidad al máximo. Descubre si tienes lo necesario para dar el siguiente paso.',
    result_button_text: 'Descubrir más',
    lead_title: 'Te preparé una guía para que comiences a aplicar tu resultado hoy mismo.',
    lead_description: 'Déjame tu nombre y correo para enviarte el acceso inmediato a la guía.',
    lead_button_text: 'DESCARGAR GUÍA',
    theme: { preset: 'classic', primaryColor: '#18181b' },
    result_images: [] as any[],
    quiz_type: 'binary',
    created_by: '',
  });

  const [questions, setQuestions] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (initialLoadDone) {
      setIsDirty(true);
    }
  }, [quiz, questions, results]);

  useEffect(() => {
    setInitialLoadDone(false);
    setIsDirty(false);
    if (!isNew) {
      fetchQuiz();
    } else {
      // Initialize default questions
      const defaultQuestions = Array.from({ length: 1 }, (_, i) => ({
        question_text: '',
        positive_text: '',
        negative_text: '',
        order_number: i + 1,
        question_type: 'binary',
        options: [{ text: '', profile: '' }, { text: '', profile: '' }]
      }));
      setQuestions(defaultQuestions);
      setTimeout(() => setInitialLoadDone(true), 100);
    }
  }, [id]);

  const fetchQuiz = async () => {
    try {
      const res = await fetch(`/api/quizzes/${id}`, { 
        headers: { ...getAuthHeaders() },
        credentials: 'include' 
      });
      if (res.ok) {
        const data = await res.json();
        
        // Check permissions
        if (user?.rol === 'asistente' && data.created_by !== user?.id) {
          navigate('/admin');
          return;
        }

        let parsedTheme = { preset: 'classic', primaryColor: '#18181b' };
        try {
          if (data.theme) {
            const t = typeof data.theme === 'string' ? JSON.parse(data.theme) : data.theme;
            if (t && t.preset) parsedTheme = t;
          }
        } catch(e) { console.error('Error parsing theme', e); }

        setQuiz({
          title: data.title,
          subtitle: data.subtitle,
          cover_image: data.cover_image || '',
          slug: data.slug,
          number_of_questions: data.number_of_questions,
          ai_prompt: data.ai_prompt,
          ai_max_words: data.ai_max_words || 50,
          redirect_potential: data.redirect_potential,
          redirect_not_interested: data.redirect_not_interested,
          result_closing_text: data.result_closing_text || 'Solo algunas personas tienen el perfil adecuado para aprovechar esta oportunidad al máximo. Descubre si tienes lo necesario para dar el siguiente paso.',
          result_button_text: data.result_button_text || 'Descubrir más',
          lead_title: data.lead_title || 'Te preparé una guía para que comiences a aplicar tu resultado hoy mismo.',
          lead_description: data.lead_description || 'Déjame tu nombre y correo para enviarte el acceso inmediato a la guía.',
          lead_button_text: data.lead_button_text || 'DESCARGAR GUÍA',
          theme: parsedTheme,
          result_images: data.result_images || [],
          quiz_type: data.quiz_type || 'binary',
          created_by: data.created_by || '',
        });
        setQuestions(data.questions?.map((q: any) => ({
          ...q,
          options: q.options ? q.options.map((opt: any) => typeof opt === 'string' ? { text: opt, profile: '' } : opt) : []
        })) || []);
        setResults(data.results || []);
        setTimeout(() => setInitialLoadDone(true), 100);
      }
    } catch (error) {
      console.error('Failed to fetch quiz', error);
    } finally {
      setLoading(false);
    }
  };

  const [validationError, setValidationError] = useState('');

  const handleSave = async () => {
    setValidationError('');
    if (!quiz.title.trim()) {
      setValidationError('El título del quiz es obligatorio.');
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!quiz.slug.trim()) {
      setValidationError('El slug del quiz es obligatorio.');
      slugRef.current?.focus();
      slugRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setValidationError(`La pregunta ${i + 1} no puede estar vacía.`);
        questionRefs.current[i]?.focus();
        questionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (q.question_type === 'multiple_choice') {
        if (!q.options || q.options.length < 2) {
          setValidationError(`La pregunta ${i + 1} debe tener al menos 2 opciones.`);
          questionRefs.current[i]?.focus();
          questionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (q.options.some((opt: any) => !opt.text?.trim())) {
          setValidationError(`Todas las opciones de la pregunta ${i + 1} deben tener texto.`);
          questionRefs.current[i]?.focus();
          questionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      } else {
        if (!q.positive_text.trim()) {
          setValidationError(`La respuesta positiva de la pregunta ${i + 1} no puede estar vacía.`);
          positiveRefs.current[i]?.focus();
          positiveRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (!q.negative_text.trim()) {
          setValidationError(`La respuesta negativa de la pregunta ${i + 1} no puede estar vacía.`);
          negativeRefs.current[i]?.focus();
          negativeRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }

    setSaving(true);
    try {
      let quizId = id;
      
      // Save Quiz Settings
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/quizzes' : `/api/quizzes/${id}`;
      
      const quizDataToSave = {
        ...quiz,
        number_of_questions: questions.length
      };

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(quizDataToSave),
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.');
        }
        throw new Error(data.error || 'Error desconocido al guardar');
      }
      
      if (isNew) {
        quizId = data.id;
      }

      // Save Questions and Results in parallel
      const [questionsRes, resultsRes] = await Promise.all([
        fetch(`/api/quizzes/${quizId}/questions`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ questions }),
          credentials: 'include'
        }),
        fetch(`/api/quizzes/${quizId}/results`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ results }),
          credentials: 'include'
        })
      ]);

      if (!questionsRes.ok) {
        const err = await questionsRes.json();
        throw new Error(err.error || 'Error al guardar las preguntas');
      }
      if (!resultsRes.ok) {
        const err = await resultsRes.json();
        throw new Error(err.error || 'Error al guardar los resultados');
      }

      if (isNew) {
        setIsDirty(false);
        navigate(`/admin/quizzes/${quizId}`);
      } else {
        setIsDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error: any) {
      console.error('Save error', error);
      setValidationError(error.message || 'Error al guardar el quiz. Verifica tu conexión.');
      alert(`Error: ${error.message || 'No se pudo guardar el quiz'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/quizzes/${id}`, { 
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (res.ok) {
        setIsDirty(false);
        navigate('/admin');
      }
    } catch (error) {
      console.error('Error deleting quiz', error);
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 pb-20"
    >
      <div className="flex items-center justify-between sticky top-0 bg-zinc-50/80 backdrop-blur-md py-4 z-10 border-b border-zinc-200/50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-900">
            {isNew ? 'Nuevo Quiz' : 'Editar Quiz'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {validationError && (
            <span className="text-sm text-red-500 font-medium">{validationError}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50 ${saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-900 hover:bg-zinc-800'}`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <QuizNav quizId={id} slug={quiz.slug} isNew={isNew} />

      {/* Configuración General */}
      <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 border-b border-zinc-100 pb-4">Configuración General</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Título</label>
            <input
              ref={titleRef}
              type="text"
              value={quiz.title}
              onChange={e => setQuiz({...quiz, title: e.target.value})}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
              placeholder="Título de tu quiz"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Slug (URL)</label>
            <input
              ref={slugRef}
              type="text"
              value={quiz.slug}
              onChange={e => setQuiz({...quiz, slug: e.target.value})}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
              placeholder="SlugDeTuQuiz"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tipo de Quiz</label>
            <select
              value={quiz.quiz_type}
              onChange={e => {
                const newType = e.target.value;
                setQuiz({...quiz, quiz_type: newType});
                setQuestions(questions.map(q => ({ ...q, question_type: newType, options: q.options && q.options.length > 0 ? q.options : [{ text: '', profile: '' }, { text: '', profile: '' }] })));
              }}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
            >
              <option value="binary">Sí / No (Binario)</option>
              <option value="multiple_choice">Opción Múltiple</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Subtítulo</label>
            <input
              type="text"
              value={quiz.subtitle}
              onChange={e => setQuiz({...quiz, subtitle: e.target.value})}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
              placeholder="Responde estas preguntas para..."
            />
          </div>
          <div className="md:col-span-2">
            <ImageUpload
              label="Imagen de Portada (Hero)"
              recommendedSize="1920x1080 (16:9)"
              value={quiz.cover_image}
              onChange={(url) => setQuiz({ ...quiz, cover_image: url })}
            />
          </div>
        </div>
      </section>

      {/* Diseño y Apariencia */}
      <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 border-b border-zinc-100 pb-4">Diseño y Apariencia</h2>
        
        <div className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700">Paleta de Colores</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setQuiz({
                  ...quiz, 
                  theme: { 
                    preset: theme.id, 
                    primaryColor: theme.id === 'custom' ? quiz.theme.primaryColor : theme.primary
                  }
                })}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  quiz.theme.preset === theme.id 
                    ? 'border-zinc-900 bg-zinc-50' 
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div 
                  className="w-10 h-10 rounded-full shadow-inner border border-black/10"
                  style={{ backgroundColor: theme.id === 'custom' ? quiz.theme.primaryColor : theme.primary }}
                />
                <span className="text-xs font-medium text-zinc-700">{theme.name}</span>
              </button>
            ))}
          </div>

          {quiz.theme.preset === 'custom' && (
            <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center gap-4">
              <label className="text-sm font-medium text-zinc-700">Color Primario (Hex):</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={quiz.theme.primaryColor}
                  onChange={e => setQuiz({
                    ...quiz,
                    theme: { ...quiz.theme, primaryColor: e.target.value }
                  })}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <input
                  type="text"
                  value={quiz.theme.primaryColor}
                  onChange={e => setQuiz({
                    ...quiz,
                    theme: { ...quiz.theme, primaryColor: e.target.value }
                  })}
                  className="w-24 px-3 py-1.5 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm font-mono uppercase"
                  placeholder="#000000"
                />
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center gap-4">
            <label className="text-sm font-medium text-zinc-700">Color de Fondo (Hex):</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={quiz.theme.backgroundColor || '#fafafa'}
                onChange={e => setQuiz({
                  ...quiz,
                  theme: { ...quiz.theme, backgroundColor: e.target.value }
                })}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={quiz.theme.backgroundColor || '#fafafa'}
                onChange={e => setQuiz({
                  ...quiz,
                  theme: { ...quiz.theme, backgroundColor: e.target.value }
                })}
                className="w-24 px-3 py-1.5 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm font-mono uppercase"
                placeholder="#fafafa"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100">
          <MultiImageUpload
            images={quiz.result_images}
            onChange={(images) => setQuiz({ ...quiz, result_images: images })}
            maxImages={10}
          />
        </div>
      </section>

      {/* Preguntas */}
      <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Preguntas</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{questions.length} / 10 preguntas configuradas</span>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((q, index) => (
            <div key={index} className="p-6 bg-zinc-50 rounded-xl border border-zinc-200 relative">
              <div className="absolute top-4 right-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    const newQ = [...questions];
                    newQ.splice(index, 1);
                    // Update order numbers
                    newQ.forEach((q, i) => q.order_number = i + 1);
                    setQuestions(newQ);
                  }}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                  title="Eliminar pregunta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Pregunta {index + 1}</label>
                  <input
                    ref={el => { questionRefs.current[index] = el; }}
                    type="text"
                    value={q.question_text}
                    onChange={e => {
                      const newQ = [...questions];
                      newQ[index].question_text = e.target.value;
                      setQuestions(newQ);
                    }}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
                  />
                </div>
                {q.question_type === 'multiple_choice' ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-zinc-700">Opciones de Respuesta y Resultado/Perfil</label>
                    {(q.options || []).map((opt: any, optIndex: number) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.text || ''}
                          onChange={e => {
                            const newQ = [...questions];
                            const newOpts = [...(newQ[index].options || [])];
                            newOpts[optIndex] = { ...newOpts[optIndex], text: e.target.value };
                            newQ[index].options = newOpts;
                            setQuestions(newQ);
                          }}
                          className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
                          placeholder={`Opción ${optIndex + 1}`}
                        />
                        <input
                          type="text"
                          value={opt.profile || ''}
                          onChange={e => {
                            const newQ = [...questions];
                            const newOpts = [...(newQ[index].options || [])];
                            newOpts[optIndex] = { ...newOpts[optIndex], profile: e.target.value };
                            newQ[index].options = newOpts;
                            setQuestions(newQ);
                          }}
                          className="w-1/3 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
                          placeholder={`Valor (ej. Seca)`}
                        />
                        <button
                          onClick={() => {
                            const newQ = [...questions];
                            const newOpts = [...(newQ[index].options || [])];
                            newOpts.splice(optIndex, 1);
                            newQ[index].options = newOpts;
                            setQuestions(newQ);
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newQ = [...questions];
                        const newOpts = [...(newQ[index].options || [])];
                        newOpts.push({ text: '', profile: '' });
                        newQ[index].options = newOpts;
                        setQuestions(newQ);
                      }}
                      className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 font-medium mt-2"
                    >
                      <Plus className="w-4 h-4" /> Agregar Opción
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1.5">Texto Positivo (Valor 1)</label>
                      <input
                        ref={el => { positiveRefs.current[index] = el; }}
                        type="text"
                        value={q.positive_text}
                        onChange={e => {
                          const newQ = [...questions];
                          newQ[index].positive_text = e.target.value;
                          setQuestions(newQ);
                        }}
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1.5">Texto Negativo (Valor 0)</label>
                      <input
                        ref={el => { negativeRefs.current[index] = el; }}
                        type="text"
                        value={q.negative_text}
                        onChange={e => {
                          const newQ = [...questions];
                          newQ[index].negative_text = e.target.value;
                          setQuestions(newQ);
                        }}
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {questions.length < 10 && (
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setQuestions([...questions, { question_text: '', positive_text: '', negative_text: '', order_number: questions.length + 1, question_type: quiz.quiz_type, options: [{ text: '', profile: '' }, { text: '', profile: '' }] }])}
                className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                AGREGAR PREGUNTA
              </button>
            </div>
          )}
        </div>
      </section>

      {/* IA y Redirecciones */}
      <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 border-b border-zinc-100 pb-4">Inteligencia Artificial y Flujo</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Prompt de IA</label>
            <textarea
              value={quiz.ai_prompt}
              onChange={e => setQuiz({...quiz, ai_prompt: e.target.value})}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
            />
            <div className="mt-1 flex justify-between items-center">
              <p className="text-xs text-zinc-500">Instrucciones para generar el resultado personalizado.</p>
              <span className="text-xs text-zinc-400">{quiz.ai_prompt?.length || 0}/500</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Límite de Palabras IA</label>
            <input
              type="number"
              value={quiz.ai_max_words}
              onChange={e => setQuiz({...quiz, ai_max_words: parseInt(e.target.value)})}
              className="w-32 px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">URL Redirección (Alto Potencial)</label>
              <input
                type="url"
                value={quiz.redirect_potential}
                onChange={e => setQuiz({...quiz, redirect_potential: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">URL Redirección (Bajo Potencial)</label>
              <input
                type="url"
                value={quiz.redirect_not_interested}
                onChange={e => setQuiz({...quiz, redirect_not_interested: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Textos Personalizados */}
      <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 border-b border-zinc-100 pb-4">Textos Personalizados (Resultados y Lead)</h2>
        
        <div className="space-y-6">
          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-100 space-y-4">
            <h3 className="font-medium text-zinc-900">Pantalla de Resultados</h3>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Título de Resultados</label>
              <input
                type="text"
                value={quiz.theme?.resultTitle || 'Tus Resultados'}
                onChange={e => setQuiz({
                  ...quiz,
                  theme: { ...quiz.theme, resultTitle: e.target.value }
                })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Texto de Cierre</label>
              <textarea
                value={quiz.result_closing_text}
                onChange={e => setQuiz({...quiz, result_closing_text: e.target.value})}
                rows={7}
                style={{ minHeight: '150px' }}
                className="w-full px-4 py-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Texto del Botón</label>
              <input
                type="text"
                value={quiz.result_button_text}
                onChange={e => setQuiz({...quiz, result_button_text: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
              />
            </div>
          </div>

          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-100 space-y-4">
            <h3 className="font-medium text-zinc-900">Pantalla de Captura de Lead</h3>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Título</label>
              <input
                type="text"
                value={quiz.lead_title}
                onChange={e => setQuiz({...quiz, lead_title: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Descripción</label>
              <textarea
                value={quiz.lead_description}
                onChange={e => setQuiz({...quiz, lead_description: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Texto del Botón</label>
              <input
                type="text"
                value={quiz.lead_button_text}
                onChange={e => setQuiz({...quiz, lead_button_text: e.target.value})}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Resultados Predefinidos */}
      <section className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Resultados Predefinidos (Opcional)</h2>
          <button
            onClick={() => setResults([...results, { combination: '', result_text: '' }])}
            className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 font-medium"
          >
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        <div className="space-y-4">
          {results.length === 0 && (
            <p className="text-sm text-zinc-500 italic">No hay resultados predefinidos. Se usará el texto automático o IA.</p>
          )}
          {results.map((r, index) => (
            <div key={index} className="flex gap-4 items-start">
              <div className="w-32">
                <input
                  type="text"
                  value={r.combination}
                  onChange={e => {
                    const newR = [...results];
                    newR[index].combination = e.target.value;
                    setResults(newR);
                  }}
                  placeholder="Ej. 10101"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm font-mono"
                />
              </div>
              <div className="flex-1">
                <textarea
                  value={r.result_text}
                  onChange={e => {
                    const newR = [...results];
                    newR[index].result_text = e.target.value;
                    setResults(newR);
                  }}
                  rows={2}
                  placeholder="Texto a mostrar para esta combinación..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm"
                />
              </div>
              <button
                onClick={() => {
                  const newR = results.filter((_, i) => i !== index);
                  setResults(newR);
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-4 pt-8 border-t border-zinc-200">
        {!isNew && (
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 text-sm font-medium rounded-xl transition-colors shadow-sm"
            title="Eliminar Quiz"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar Quiz
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saved}
          className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50 ${saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-900 hover:bg-zinc-800'}`}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
        </button>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Eliminar Quiz"
        message="¿Estás seguro de que quieres borrar este quiz? Esta acción no se puede deshacer y borrará todos los leads y analíticas asociados."
        confirmText="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />

      <ConfirmModal
        isOpen={blocker.state === 'blocked'}
        title="Cambios sin guardar"
        message="¿Deseas salir sin guardar los cambios?"
        confirmText="Salir sin guardar"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />

    </motion.div>
  );
}
