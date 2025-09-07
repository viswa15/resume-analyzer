// frontend/src/components/ErrorMessage.js
import React from 'react';
import './ErrorMessage.css'; // CSS will be added in the final step

const ErrorMessage = ({ message }) => {
  if (!message) return null;
  return <div className="error-message">{message}</div>;
};

export default ErrorMessage;