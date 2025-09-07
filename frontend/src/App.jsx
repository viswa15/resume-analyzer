// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import { uploadResume, getAllResumes, getResumeById } from './services/api';

// Import Components
import ResumeUploader from './components/ResumeUploader';
import ResumeDetails from './components/ResumeDetails';
import PastResumesTable from './components/PastResumesTable';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';

function App() {
  // State Management
  const [activeTab, setActiveTab] = useState('analysis');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data State
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [pastResumes, setPastResumes] = useState([]);
  const [selectedResumeDetails, setSelectedResumeDetails] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch all resumes on initial component mount
  useEffect(() => {
    if (activeTab === 'history') {
      fetchPastResumes();
    }
  }, [activeTab]);

  const fetchPastResumes = async () => {
    setIsLoading(true);
    try {
      const data = await getAllResumes();
      setPastResumes(data);
    } catch (err) {
      setError('Failed to fetch past resumes.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for the upload component
  const handleUploadSuccess = async (file) => {
    try {
      const analysisData = await uploadResume(file);
      setCurrentAnalysis(analysisData);
      // Automatically switch to history tab to show the new entry
      fetchPastResumes(); 
    } catch (err) {
      throw err; // Re-throw to be caught by the uploader component's handler
    }
  };

  // Handler for clicking 'View Details' in the history table
  const handleDetailsClick = async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const details = await getResumeById(id);
      setSelectedResumeDetails(details);
      setIsModalOpen(true);
    } catch (err) {
      setError('Failed to fetch resume details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>📄 DeepKlarity Resume Analyzer</h1>
      </header>
      <nav className="tabs">
        <button
          className={activeTab === 'analysis' ? 'active' : ''}
          onClick={() => setActiveTab('analysis')}
        >
          Resume Analysis
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Historical Viewer
        </button>
      </nav>
      <main>
        <ErrorMessage message={error} />

        {activeTab === 'analysis' && (
          <div className="tab-content">
            <ResumeUploader
              onUploadSuccess={handleUploadSuccess}
              onError={setError}
              setIsLoading={setIsLoading}
            />
            {isLoading && <LoadingSpinner />}
            {!isLoading && <ResumeDetails data={currentAnalysis} />}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-content">
            {isLoading && <LoadingSpinner />}
            {!isLoading && (
              <PastResumesTable
                resumes={pastResumes}
                onDetailsClick={handleDetailsClick}
              />
            )}
          </div>
        )}
      </main>
      
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setIsModalOpen(false)}>×</button>
            <ResumeDetails data={selectedResumeDetails} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;