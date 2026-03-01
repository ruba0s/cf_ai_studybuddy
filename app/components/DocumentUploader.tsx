import { useRef, useState } from 'react';
import { api } from '../lib/api';

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface DocumentUploadProps {
  onUploadComplete?: (materialId: string) => void;
}

const ACCEPTED_EXTENSIONS = ['.txt'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isDisabled = status === 'uploading' || status === 'processing';

  const handleFile = async (file: File) => {
    setErrorMessage('');

    // Validation
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setStatus('error');
      setErrorMessage(`Unsupported file type: ${ext}. Please upload .txt`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus('error');
      setErrorMessage(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
      return;
    }

    try {
      setStatus('uploading');
      const content = await readFileAsText(file);

      setStatus('processing');
      const result = await api.upload(file.name, content);

      if (result.status === 'processing') {
        setStatus('success');
        onUploadComplete?.(result.materialId);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage((err as Error).message ?? 'Something went wrong');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be re-uploaded after error
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Drop zone */}
      <div
        onClick={() => !isDisabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={[
          'w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 transition-colors',
          isDisabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer',
        ].join(' ')}
      >
        <StatusIcon status={status} />
        <StatusMessage status={status} errorMessage={errorMessage} />
        {status === 'idle' && (
          <p className="text-xs text-gray-400">.txt · max 10MB</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={handleInputChange}
        disabled={isDisabled}
      />

      {/* Retry button on error */}
      {status === 'error' && (
        <button
          onClick={() => { setStatus('idle'); setErrorMessage(''); }}
          className="text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadStatus }) {
  switch (status) {
    case 'idle':
      return (
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      );
    case 'uploading':
      return <Spinner className="text-gray-400" />;
    case 'processing':
      return <Spinner className="text-blue-500" />;
    case 'success':
      return (
        <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
  }
}

function StatusMessage({ status, errorMessage }: { status: UploadStatus; errorMessage: string }) {
  switch (status) {
    case 'idle':
      return (
        <>
          <p className="text-sm font-medium text-gray-700">
            Welcome to your Study Buddy!
          </p>
          <p className="text-xs text-gray-500 text-center">
            Upload your study material to get started.
            <br />Click or drag and drop a file here.
          </p>
        </>
      );
    case 'uploading':
      return <p className="text-sm text-gray-500">Uploading...</p>;
    case 'processing':
      return <p className="text-sm text-blue-600">Processing document...</p>;
    case 'success':
      return <p className="text-sm text-green-600 font-medium">Upload complete! Questions are being generated.</p>;
    case 'error':
      return <p className="text-sm text-red-600 text-center">{errorMessage || 'Upload failed.'}</p>;
  }
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`w-10 h-10 animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}