import React, { ChangeEvent, useState } from 'react';
import { Upload, FilePlus } from 'lucide-react';
import { UploadedFile } from '../types';
import { parseCSV, detectDelimiter, detectDecimalSeparator } from '../services/csvService';

interface Props {
  onFilesUploaded: (files: UploadedFile[]) => void;
}

const FileUpload: React.FC<Props> = ({ onFilesUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
    const processedFiles: UploadedFile[] = [];

    for (const file of files) {
      const text = await file.text();
      const delimiter = detectDelimiter(text);
      const decimalSeparator = detectDecimalSeparator(text, delimiter);

      const result = parseCSV(text, { 
        delimiter, 
        decimalSeparator, 
        hasHeader: true,
        excludeRows: "",
        excludeColumns: "" 
      });
      
      processedFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        rawContent: text,
        delimiter,
        skipRows: 0,
        excludeRows: "", 
        excludeColumns: "",
        hasHeader: true,
        prefixColumns: false,
        includeIndex: false,
        decimalSeparator,
        columns: result.columns,
        data: result.data
      });
    }
    onFilesUploaded(processedFiles);
  };

  return (
    <div className="mb-8">
      <div
        className={`border-2 border-dashed rounded-none p-10 text-center transition-all cursor-pointer relative ${
          isDragging 
            ? 'border-rust bg-rust/5 shadow-[8px_8px_0px_0px_rgba(217,79,43,1)]' 
            : 'border-charcoal bg-white/50 hover:bg-white hover:shadow-[8px_8px_0px_0px_rgba(42,42,42,1)]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            await processFiles(Array.from(e.dataTransfer.files));
          }
        }}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <div className="flex flex-col items-center">
          <div className="mb-4 bg-charcoal p-3 text-cream">
            {isDragging ? <FilePlus size={32} /> : <Upload size={32} />}
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight font-display text-charcoal">
            Drop CSV files here
          </h3>
          <p className="text-sm font-mono text-slate mt-2">
            OR CLICK TO SCAN LOCAL DIRECTORY
          </p>
          <input
            id="fileInput"
            type="file"
            multiple
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
};

export default FileUpload;