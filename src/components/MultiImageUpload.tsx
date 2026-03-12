import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, GripVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MultiImageUploadProps {
  images: any[];
  onChange: (images: any[]) => void;
  maxImages?: number;
}

export default function MultiImageUpload({ images, onChange, maxImages = 10 }: MultiImageUploadProps) {
  const { getAuthHeaders } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > maxImages) {
      alert(`Solo puedes subir hasta ${maxImages} imágenes. Has seleccionado ${files.length} y ya tienes ${images.length}.`);
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      const newImages = [...images];
      let current = 0;
      for (const file of files) {
        current++;
        setUploadProgress({ current, total: files.length });
        
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { ...getAuthHeaders() },
          body: formData,
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          newImages.push({ image_url: data.url });
        } else {
          const errData = await res.json();
          console.error('Error uploading file', file.name, errData);
          alert(`Error al subir ${file.name}: ${errData.error || 'Desconocido'}`);
        }
      }
      onChange(newImages);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error de conexión al subir imágenes');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-zinc-700">Pool de Imágenes de Resultado</label>
        <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
          {images.length} / {maxImages} imágenes cargadas
        </span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Se mostrará una imagen aleatoria de este pool cuando un usuario termine el quiz. Recomendado: 1920x1080 (16:9) • Máx 10MB por imagen.</p>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
          {images.map((img, index) => (
            <div key={index} className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 aspect-video group">
              <img src={img.image_url || img} alt={`Result ${index + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  title="Eliminar imagen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length < maxImages && (
        <div 
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed border-zinc-300 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin mb-2" />
              <p className="text-sm font-medium text-zinc-700">
                Subiendo {uploadProgress?.current} de {uploadProgress?.total}...
              </p>
              <div className="w-full max-w-xs bg-zinc-200 rounded-full h-1.5 mt-3">
                <div 
                  className="bg-zinc-900 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${((uploadProgress?.current || 0) / (uploadProgress?.total || 1)) * 100}%` }}
                ></div>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-zinc-400 mb-2" />
              <p className="text-sm font-medium text-zinc-700">Subir imágenes</p>
              <p className="text-xs text-zinc-500 mt-1">Puedes seleccionar varias a la vez (JPG, PNG) • Máx 10MB c/u</p>
            </>
          )}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/webp"
        multiple
        className="hidden"
      />
    </div>
  );
}
