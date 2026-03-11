import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  recommendedSize?: string;
}

export default function ImageUpload({ value, onChange, label, recommendedSize }: ImageUploadProps) {
  const { getAuthHeaders } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        body: formData,
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        onChange(data.url);
      } else {
        const errData = await res.json();
        alert(`Error al subir la imagen: ${errData.error || 'Desconocido'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error de conexión al subir la imagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-zinc-700">{label}</label>}
      {recommendedSize && <p className="text-xs text-zinc-500 mb-2">Recomendado: {recommendedSize}</p>}
      
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 aspect-video flex items-center justify-center group">
          <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-100"
            >
              Reemplazar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed border-zinc-300 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-colors aspect-video flex flex-col items-center justify-center ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? (
            <div className="w-8 h-8 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin mb-3" />
          ) : (
            <ImageIcon className="w-8 h-8 text-zinc-400 mb-3" />
          )}
          <p className="text-sm font-medium text-zinc-700">
            {uploading ? 'Subiendo...' : 'Haz clic para subir imagen'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">JPG o PNG (16:9)</p>
        </div>
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
      />
    </div>
  );
}
