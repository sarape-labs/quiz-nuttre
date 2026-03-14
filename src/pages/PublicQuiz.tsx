import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';

export default function PublicQuiz() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get('quiz');
  
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionId] = useState(uuidv4());
  
  const [step, setStep] = useState('start'); // start, question, lead, result, redirecting, success
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  const [leadForm, setLeadForm] = useState({ nombre: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [generatingResult, setGeneratingResult] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [randomResultImage, setRandomResultImage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [resultError, setResultError] = useState('');
  const isFetchingResult = useRef(false);

  useEffect(() => {
    if (slug) {
      fetchQuiz();
    } else {
      setError('No se especificó un quiz.');
      setLoading(false);
    }
  }, [slug]);

  const fetchQuiz = async () => {
    try {
      const res = await fetch(`/api/public/quiz/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.questions) {
          data.questions = data.questions.filter((q: any) => q.question_text && q.question_text.trim() !== '');
        }
        setQuiz(data);
        trackEvent('quiz_open', undefined, data.id);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || `Quiz no encontrado (${res.status})`);
      }
    } catch (err) {
      console.error('Fetch quiz error:', err);
      setError('Error de conexión al cargar el quiz.');
    } finally {
      setLoading(false);
    }
  };

  const trackEvent = async (eventType: string, questionNumber?: number, specificQuizId?: string) => {
    const targetQuizId = specificQuizId || quiz?.id;
    if (!targetQuizId) return;
    try {
      const res = await fetch(`/api/public/quiz/${targetQuizId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, question_number: questionNumber, session_id: sessionId }),
      });
      if (!res.ok) {
        console.warn('Analytics tracking failed', res.status);
      }
    } catch (e) {
      console.error('Analytics error', e);
    }
  };

  const handleStart = () => {
    trackEvent('quiz_start');
    if (quiz?.questions && quiz.questions.length > 0) {
      setStep('question');
    } else {
      trackEvent('quiz_completed');
      fetchResult();
    }
  };

  const fetchResult = async () => {
    if (isFetchingResult.current) return;
    isFetchingResult.current = true;
    setGeneratingResult(true);
    setResultError('');
    
    try {
      const cachedResult = sessionStorage.getItem(`quiz_result_${quiz.id}_${sessionId}`);
      if (cachedResult) {
        const data = JSON.parse(cachedResult);
        setResult(data);
        if (quiz?.result_images && quiz.result_images.length > 0) {
          const randomIndex = Math.floor(Math.random() * quiz.result_images.length);
          setRandomResultImage(quiz.result_images[randomIndex].image_url);
        }
        setStep('result');
        setGeneratingResult(false);
        return;
      }

      const res = await fetch(`/api/public/quiz/${quiz.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (res.ok) {
        const data = await res.json();
        
        const apiKey = (window as any).process?.env?.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
        console.log('Checking AI generation conditions:', {
          hasPromptContext: !!data.promptContext,
          hasApiKey: !!apiKey
        });
        
        if (data.promptContext && apiKey) {
          try {
            console.log('Starting AI generation...');
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite-preview",
              contents: data.promptContext,
              config: {
                systemInstruction: "Eres un experto. Responde de forma concisa en máximo 80 palabras.",
              }
            });
            console.log('AI generation successful');
            data.aiInterpretation = response.text;
          } catch (aiError) {
            console.error('AI Generation Error:', aiError);
            throw new Error('AI_ERROR');
          }
        } else if (data.promptContext) {
          console.warn('Prompt context exists but GEMINI_API_KEY is missing');
        }
        
        if (quiz?.result_images && quiz.result_images.length > 0) {
          const randomIndex = Math.floor(Math.random() * quiz.result_images.length);
          setRandomResultImage(quiz.result_images[randomIndex].image_url);
        }

        sessionStorage.setItem(`quiz_result_${quiz.id}_${sessionId}`, JSON.stringify(data));
        setResult(data);
        setStep('result');
      } else {
        throw new Error('BACKEND_ERROR');
      }
    } catch (e: any) {
      console.error('Result fetch error', e);
      if (e.message === 'AI_ERROR') {
        setResultError('Hubo un problema generando tu análisis con Inteligencia Artificial. Por favor, intenta de nuevo.');
      } else {
        setResultError('Error de conexión al obtener tu resultado. Por favor, intenta de nuevo.');
      }
      isFetchingResult.current = false;
    } finally {
      setGeneratingResult(false);
    }
  };

  const handleAnswer = async (answer: number) => {
    const question = quiz.questions[currentQuestionIndex];
    
    try {
      await fetch(`/api/public/quiz/${quiz.id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: question.id, answer, session_id: sessionId }),
      });
      
      trackEvent('question_answered', question.order_number);

      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        trackEvent('quiz_completed');
        fetchResult();
      }
    } catch (e) {
      console.error('Answer error', e);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`/api/public/quiz/${quiz.id}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadForm, session_id: sessionId }),
      });

      if (res.ok) {
        trackEvent('lead_submitted');
        handleRedirect();
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Error al procesar. Intenta de nuevo.');
      }
    } catch (e) {
      console.error('Lead submit error', e);
      setSubmitError('Error de conexión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedirect = () => {
    trackEvent('redirect_completed');
    if (result?.redirectUrl) {
      setStep('redirecting');
      let url = result.redirectUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Small delay to show the redirecting message
      setTimeout(() => {
        window.location.href = url;
      }, 1000);
    } else {
      setStep('success');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50">Cargando...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500">{error}</div>;

  let primaryColor = '#18181b'; // zinc-900 default
  try {
    if (quiz?.theme) {
      const t = typeof quiz.theme === 'string' ? JSON.parse(quiz.theme) : quiz.theme;
      if (t.primaryColor) primaryColor = t.primaryColor;
    }
  } catch (e) {}

  if (generatingResult) {
    return (
      <div 
        className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 font-sans space-y-4"
        style={{ '--primary-color': primaryColor } as React.CSSProperties}
      >
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: primaryColor }} />
        <p className="text-zinc-600 font-medium animate-pulse">Generando tu resultado...</p>
      </div>
    );
  }

  if (resultError) {
    return (
      <div 
        className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 font-sans space-y-4"
        style={{ '--primary-color': primaryColor } as React.CSSProperties}
      >
        <div className="p-8 bg-white rounded-3xl shadow-sm border border-red-100 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-zinc-900">Algo salió mal</h3>
            <p className="text-zinc-600">{resultError}</p>
          </div>
          <button
            onClick={() => fetchResult()}
            className="w-full py-4 px-6 text-center rounded-2xl theme-bg theme-bg-hover transition-all text-lg font-medium text-white active:scale-[0.98] shadow-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans"
      style={{ '--primary-color': primaryColor } as React.CSSProperties}
    >
      <style>{`
        .theme-bg { background-color: var(--primary-color); }
        .theme-bg-hover:hover { opacity: 0.9; }
        .theme-border-hover:hover { border-color: var(--primary-color); }
        .theme-text-hover:hover { color: var(--primary-color); }
        .theme-focus:focus { 
          border-color: var(--primary-color) !important; 
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent) !important; 
        }
      `}</style>
      <div className="w-full max-w-xl">
        <AnimatePresence mode="wait">
          
          {step === 'start' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-sm border border-zinc-200 text-center overflow-hidden"
            >
              {quiz.cover_image ? (
                <div className="w-full aspect-video relative bg-zinc-100">
                  <img src={quiz.cover_image} alt={quiz.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="w-full aspect-video bg-zinc-100 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-zinc-200/50 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-300/50" />
                  </div>
                </div>
              )}
              <div className="p-10 space-y-8">
                <div className="space-y-4">
                  <h1 className="text-4xl font-semibold text-zinc-900 leading-tight">
                    {quiz.title}
                  </h1>
                  <p className="text-lg text-zinc-500 leading-relaxed">
                    {quiz.subtitle}
                  </p>
                </div>
                <button
                  onClick={handleStart}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 theme-bg theme-bg-hover text-white text-lg font-medium rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                >
                  Comenzar
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'question' && quiz.questions && quiz.questions[currentQuestionIndex] && (
            <motion.div
              key={`q-${currentQuestionIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-zinc-200 space-y-8"
            >
              <div className="flex items-center justify-between text-sm font-medium text-zinc-400 mb-8">
                <span>Pregunta {currentQuestionIndex + 1} de {quiz.questions.length}</span>
                <div className="flex gap-1">
                  {quiz.questions.map((_: any, i: number) => (
                    <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i <= currentQuestionIndex ? 'theme-bg' : 'bg-zinc-100'}`} />
                  ))}
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-medium text-zinc-900 leading-snug">
                {quiz.questions[currentQuestionIndex].question_text}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <button
                  onClick={() => handleAnswer(1)}
                  className="p-6 text-center rounded-2xl theme-bg theme-bg-hover transition-all text-lg font-medium text-white active:scale-[0.98] shadow-sm"
                >
                  {quiz.questions[currentQuestionIndex].positive_text}
                </button>
                <button
                  onClick={() => handleAnswer(0)}
                  className="p-6 text-center rounded-2xl theme-bg theme-bg-hover transition-all text-lg font-medium text-white active:scale-[0.98] shadow-sm"
                >
                  {quiz.questions[currentQuestionIndex].negative_text}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-3xl shadow-sm border border-zinc-200 text-center overflow-hidden"
            >
              {randomResultImage ? (
                <div className="w-full aspect-video relative bg-zinc-100">
                  <img src={randomResultImage} alt="Resultado" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="w-full aspect-video bg-zinc-100 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-zinc-200/50 flex items-center justify-center">
                    <CheckCircle2 className="w-16 h-16 text-zinc-400" />
                  </div>
                </div>
              )}
              <div className="p-8 sm:p-10 space-y-8">
                <h2 className="text-3xl font-semibold tracking-normal text-zinc-900">Tus Resultados</h2>
                
                <div className="prose prose-zinc prose-lg mx-auto text-left">
                  {result?.aiInterpretation ? (
                    <div className="text-zinc-700 leading-relaxed">
                      <Markdown>{result.aiInterpretation}</Markdown>
                    </div>
                  ) : (
                    <p className="text-zinc-700 leading-relaxed">
                      {result?.resultText}
                    </p>
                  )}
                </div>

              <div className="pt-8 border-t border-zinc-100 space-y-4">
                <p className="text-lg text-zinc-700 font-medium whitespace-pre-line">
                  {quiz.result_closing_text || 'Solo algunas personas tienen el perfil adecuado para aprovechar esta oportunidad al máximo. Descubre si tienes lo necesario para dar el siguiente paso.'}
                </p>
                <button
                  onClick={() => setStep('lead')}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 theme-bg theme-bg-hover text-white text-lg font-medium rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm mt-4"
                >
                  {quiz.result_button_text || 'Descubrir más >'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              </div>
            </motion.div>
          )}

          {step === 'lead' && (
            <motion.div
              key="lead"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-zinc-200 space-y-8"
            >
              <div className="text-center space-y-6">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-normal text-zinc-900 leading-tight">
                  {quiz.lead_title || 'Te preparé una guía para que comiences a aplicar tu resultado hoy mismo.'}
                </h2>
                <div className="space-y-4">
                  <p className="text-zinc-600 text-lg leading-relaxed whitespace-pre-line">
                    {quiz.lead_description || 'Déjame tu nombre y correo para enviarte el acceso inmediato a la guía y al video explicativo.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleLeadSubmit} className="space-y-5">
                {submitError && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm text-center font-medium">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Nombre</label>
                  <input
                    type="text"
                    required
                    value={leadForm.nombre}
                    onChange={e => setLeadForm({...leadForm, nombre: e.target.value})}
                    className="w-full px-4 py-3 border border-zinc-300 rounded-2xl theme-focus transition-shadow text-lg outline-none"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={e => setLeadForm({...leadForm, email: e.target.value})}
                    className="w-full px-4 py-3 border border-zinc-300 rounded-2xl theme-focus transition-shadow text-lg outline-none"
                    placeholder="tu@correo.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-sm text-lg font-medium text-white theme-bg theme-bg-hover focus:outline-none disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] mt-8 uppercase tracking-wide"
                >
                  {submitting ? 'Procesando...' : (quiz.lead_button_text || 'DESCARGAR GUÍA + VIDEO')}
                  {!submitting && <ArrowRight className="w-5 h-5" />}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-zinc-200 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-semibold text-zinc-900">¡Registro exitoso!</h2>
              <p className="text-lg text-zinc-600">
                Tus datos han sido guardados correctamente.
              </p>
            </motion.div>
          )}

          {step === 'redirecting' && (
            <motion.div
              key="redirecting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-zinc-200 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-zinc-100 text-zinc-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900">Redireccionando...</h2>
              <p className="text-lg text-zinc-600">
                Estamos llevándote a tu destino.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
