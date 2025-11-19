
import React, { ChangeEvent, useState } from 'react';
import { Upload } from 'lucide-react';
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
      
      // Smart Detection
      const delimiter = detectDelimiter(text);
      const decimalSeparator = detectDecimalSeparator(text, delimiter);

      // Initial Parse
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
        skipRows: 0, // Legacy
        excludeRows: "", 
        excludeColumns: "",
        hasHeader: true,
        prefixColumns: false, // Default: Do NOT prefix columns (Merge by default)
        decimalSeparator,
        columns: result.columns,
        data: result.data
      });
    }
    onFilesUploaded(processedFiles);
  };

  return (
    <div className="mb-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
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
      >
        <Upload className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h3 className="text-lg font-medium text-slate-700">Drop CSV files here</h3>
        <p className="text-sm text-slate-500 mb-4">or click to browse</p>
        <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium">
            Browse Files
          <input
            type="file"
            multiple
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>
    </div>
  );
};

export default FileUpload;
