import React, { useRef, useState } from 'react';
import { parseEmailFileContent, type ParseResult } from '../../utils/csv';

export interface FileUploadProps {
  onParsed: (result: ParseResult, filename: string) => void;
  onClear: () => void;
  parsedResult?: ParseResult | null;
  filename?: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onParsed,
  onClear,
  parsedResult,
  filename,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseEmailFileContent(content);
      onParsed(result, file.name);
    };
    reader.readAsText(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const validCount = parsedResult?.valid.length || 0;

  return (
    <div className="w-full space-y-2.5">
      <label className="block text-xs font-bold text-brand-text">
        Recipients CSV / TXT File Upload
      </label>

      {/* File Dropzone Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition shadow-2xs ${
          dragActive
            ? 'border-brand-gold bg-brand-gold-light'
            : 'border-brand-border bg-brand-white hover:border-brand-gold/60 hover:bg-brand-cream-soft'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center space-y-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-cream text-brand-muted group-hover:bg-brand-gold-soft group-hover:text-brand-gold-dark transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-xs font-semibold text-brand-text">
            Click to upload or drag & drop CSV or TXT file
          </p>
          <p className="text-[11px] text-brand-muted">
            Emails will be parsed and validated automatically
          </p>
        </div>
      </div>

      {/* Detected Email Addresses Info Card */}
      <div className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-cream/80 p-3.5 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold-soft text-brand-gold-dark border border-brand-gold/30">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-brand-text">
              {validCount} email address{validCount === 1 ? '' : 'es'} detected
            </p>
            <p className="text-[11px] text-brand-muted">
              {filename ? `Parsed from "${filename}"` : 'Upload a file to see the count'}
            </p>
          </div>
        </div>

        {parsedResult && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (fileInputRef.current) fileInputRef.current.value = '';
              onClear();
            }}
            className="rounded-lg border border-brand-border bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-muted hover:text-brand-text hover:bg-brand-cream transition"
          >
            Remove file
          </button>
        )}
      </div>
    </div>
  );
};

