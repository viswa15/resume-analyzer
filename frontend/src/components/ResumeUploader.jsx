// frontend/src/components/ResumeUploader.js
import React, { useState, useRef } from 'react';
import './ResumeUploader.css'; // We will create this CSS file

const ResumeUploader = ({ onUploadSuccess, onError, setIsLoading }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      onError('Please select a PDF file to upload.');
      return;
    }
    setIsLoading(true);
    onError(null);

    try {
      await onUploadSuccess(selectedFile);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'An unexpected error occurred.';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      onError('Invalid file type. Please drop a PDF file.');
    }
  };

  const handleBoxClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="uploader-container">
      <h2>Upload Your Resume</h2>
      <p>Get AI-powered analysis and feedback in seconds.</p>
      
      <div 
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onClick={handleBoxClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          ref={fileInputRef}
          style={{ display: 'none' }} 
        />
        <div className="drop-zone-icon">📄</div>
        {selectedFile ? (
          <p className="file-name">Selected: {selectedFile.name}</p>
        ) : (
          <p><strong>Drag & drop</strong> your PDF here, or click to select a file.</p>
        )}
      </div>

      <button onClick={handleUpload} disabled={!selectedFile}>
        Analyze Resume
      </button>
    </div>
  );
};

export default ResumeUploader;