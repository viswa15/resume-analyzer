// frontend/src/components/PastResumesTable.js
import React from 'react';

const PastResumesTable = ({ resumes, onDetailsClick }) => {
  if (!resumes || resumes.length === 0) {
    return <p>No resumes have been analyzed yet.</p>;
  }

  return (
    <div className="table-container">
      <h2>Analysis History</h2>
      <table>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Candidate Name</th>
            <th>Uploaded On</th>
            <th>Rating</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resumes.map((resume) => (
            <tr key={resume.id}>
              <td>{resume.file_name}</td>
              <td>{resume.name || 'N/A'}</td>
              <td>{new Date(resume.uploaded_at).toLocaleDateString()}</td>
              <td>{resume.resume_rating}/10</td>
              <td>
                <button onClick={() => onDetailsClick(resume.id)}>
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PastResumesTable;