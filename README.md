# 📄 DeepKlarity Resume Analyzer

![React](https://img.shields.io/badge/Frontend-React.js-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Framework-Express.js-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&logoColor=white)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Frontend%20on%20Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Backend%20on%20Render-46E3B7?logo=render&logoColor=white)

The DeepKlarity Resume Analyzer is a full-stack web application designed to help users improve their resumes. It allows users to upload a PDF resume, automatically extracts key information using AI, stores it in a database, and provides AI-driven feedback for improvement.

---

## ✨ Features

- **AI-Powered Analysis**: Leverages Google's Gemini LLM to extract structured data (contact info, skills, experience) and generate actionable feedback.
- **Structured Data Extraction**: Parses PDF resumes to pull out key sections like work experience, education, and skills.
- **Resume Rating**: Provides an overall score from 1-10 based on clarity, impact, and completeness.
- **Actionable Feedback**: Offers concrete suggestions for improvement and relevant skills for upskilling.
- **Historical Viewer**: A complete history of all uploaded resumes, allowing users to review past analyses.
- **Modern Tech Stack**: Built with React, Node.js, Express, and PostgreSQL for a robust and scalable experience.

---

## 🛠️ Technology Stack

- **Frontend**: React.js  
- **Backend**: Node.js with Express.js  
- **Database**: PostgreSQL  
- **AI Integration**: Google Gemini API via `@google/generative-ai`  
- **File Handling**: `multer` (backend), Drag-and-Drop (frontend)  
- **PDF Parsing**: `pdf-parse`  

---

## 🏛️ High-Level Architecture

The application follows a standard client-server model. The user uploads a resume via the React frontend, which sends it to the Node.js backend. The backend parses the PDF, sends the text to the Gemini API for analysis, saves the structured results in a PostgreSQL database, and returns the analysis to the frontend for display.

---

## 🚀 Getting Started

Follow these instructions to set up and run the project on your local machine.

### Prerequisites

- Node.js (v18 or later)  
- npm  
- PostgreSQL installed and running locally, or a cloud-hosted instance (e.g., on Render)  

---

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd resume-analyzer
2. Backend Setup
Navigate to the backend directory:

bash
Copy code
cd backend
Install dependencies:

bash
Copy code
npm install
Create a .env file in the backend directory and add the following environment variables. Replace the placeholder values with your actual credentials:

env
Copy code
# Server Configuration
PORT=3001

# PostgreSQL Database Configuration
DB_USER=your_postgres_user
DB_HOST=localhost
DB_DATABASE=resume_analyzer
DB_PASSWORD=your_postgres_password
DB_PORT=5432

# Google Gemini API Key
GOOGLE_API_KEY="YOUR_GEMINI_API_KEY"
Set up the database:
Connect to your PostgreSQL instance (e.g., using psql or pgAdmin).

Create the database:

sql
Copy code
CREATE DATABASE resume_analyzer;
Connect to the new database and run the following command to create the necessary table:

sql
Copy code
CREATE TABLE resumes (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    summary TEXT,
    work_experience JSONB,
    education JSONB,
    technical_skills JSONB,
    soft_skills JSONB,
    projects JSONB,
    certifications JSONB,
    resume_rating INTEGER,
    improvement_areas TEXT,
    upskill_suggestions JSONB
);
Start the backend server:

bash
Copy code
npm start
The backend will be running on http://localhost:3001

3. Frontend Setup
Open a new terminal and navigate to the frontend directory:

bash
Copy code
cd frontend
Install dependencies:

bash
Copy code
npm install
Start the frontend development server:

bash
Copy code
npm start
The frontend will open and run on http://localhost:3000

☁️ Deployment
This project is configured for easy deployment on modern cloud platforms.

Backend (Render)
Create a new Web Service on Render and connect your GitHub repository.

Set the Root Directory to backend.

Set the Build Command to:

bash
Copy code
npm install
and the Start Command to:

bash
Copy code
node server.js
Add your GOOGLE_API_KEY and DATABASE_URL (the internal connection string from your Render PostgreSQL instance) in the Environment Variables.

Ensure your db/index.js file is configured to use DATABASE_URL in production.

Frontend (Vercel)
Create a new Project on Vercel and connect your GitHub repository.

Set the Root Directory to frontend.
Vercel will automatically detect the Vite React App settings.

Add an environment variable:

makefile
Copy code
Name: VITE_BASE_URL
Value: The URL of your live Render backend (e.g., https://your-backend-url.onrender.com)
Ensure your services/api.js file is configured to use VITE_BASE_URL.

Deploy 🚀