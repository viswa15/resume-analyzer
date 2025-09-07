// frontend/src/components/ResumeDetails.js
import React from 'react';

const ResumeDetails = ({ data }) => {
  if (!data) return <p>Upload a resume to see the analysis.</p>;

  // Helper to render lists safely
  const renderList = (items) => {
    if (!items || items.length === 0) return <li>None listed.</li>;
    return items.map((item, index) => <li key={index}>{item}</li>);
  };
  
  return (
    <div className="details-container">
      <div className="detail-section contact-info">
        <h3>{data.name || 'N/A'}</h3>
        <p>Email: {data.email || 'N/A'}</p>
        <p>Phone: {data.phone || 'N/A'}</p>
        <p>LinkedIn: {data.linkedin_url ? <a href={data.linkedin_url} target="_blank" rel="noopener noreferrer">{data.linkedin_url}</a> : 'N/A'}</p>
      </div>

      <div className="detail-section rating-card">
         <h4>Overall Rating</h4>
         <p className="rating-score">{data.resume_rating}/10</p>
      </div>

      <div className="detail-section">
        <h4>📝 Summary</h4>
        <p>{data.summary || 'No summary found.'}</p>
      </div>

      <div className="detail-section">
        <h4>💡 Areas for Improvement</h4>
        <p>{data.improvement_areas || 'No specific improvement areas identified.'}</p>
      </div>
      
      <div className="detail-section">
        <h4>🚀 Upskilling Suggestions</h4>
        <ul>{renderList(data.upskill_suggestions)}</ul>
      </div>

      <div className="detail-section">
        <h4>💻 Technical Skills</h4>
        <div className="skills-list">{data.technical_skills?.join(', ')}</div>
      </div>
      
      <div className="detail-section">
        <h4>🤝 Soft Skills</h4>
        <div className="skills-list">{data.soft_skills?.join(', ')}</div>
      </div>

      <div className="detail-section">
        <h4>🏢 Work Experience</h4>
        {data.work_experience?.map((exp, index) => (
          <div key={index} className="experience-item">
            <strong>{exp.role}</strong> at {exp.company} ({exp.duration})
            <ul>
              {exp.description?.map((desc, i) => <li key={i}>{desc}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResumeDetails;