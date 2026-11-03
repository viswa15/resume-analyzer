// backend/data/skillTaxonomy.js
//
// A curated, static list of common tech skills, used only to figure out
// what a JOB POSTING is asking for (by scanning its text for these terms),
// not to describe any particular resume. Without a list like this, a job's
// "required skills" would be limited to whatever happens to already be on
// the candidate's resume - which would silently hide any skill the job
// wants that the candidate DOESN'T have, inflating the match percentage.
// See adzunaService.js's scoreJobAgainstResume for how this is used.
//
// This is intentionally broad rather than exhaustive. Casing/punctuation
// doesn't need to be exact - matching is fuzzy (see normalizeForms).

const SKILL_TAXONOMY = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Rust',
  'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl',
  'Objective-C', 'Dart', 'Elixir', 'Haskell', 'Bash', 'Shell Scripting', 'SQL',
  'HTML', 'CSS', 'Assembly',

  // Frontend
  'React', 'React.js', 'Angular', 'Vue.js', 'Svelte', 'Next.js', 'Nuxt.js',
  'Redux', 'Zustand', 'jQuery', 'Bootstrap', 'Tailwind CSS', 'Sass', 'Less',
  'Webpack', 'Vite', 'Babel', 'Storybook', 'Web Components', 'PWA',

  // Backend
  'Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot',
  'Ruby on Rails', 'Laravel', 'ASP.NET', 'ASP.NET Core', 'NestJS', 'GraphQL',
  'REST API', 'gRPC', 'WebSockets', 'Microservices',

  // Databases
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle Database',
  'SQL Server', 'Cassandra', 'DynamoDB', 'Elasticsearch', 'Firebase',
  'Supabase', 'Neo4j', 'MariaDB', 'CouchDB',

  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud Platform', 'GCP', 'Docker', 'Kubernetes',
  'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI',
  'CI/CD', 'Helm', 'Prometheus', 'Grafana', 'Nginx', 'Linux', 'Unix',
  'Serverless', 'Cloudflare', 'Vercel', 'Netlify',

  // Data, ML & analytics
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Keras',
  'Scikit-learn', 'Pandas', 'NumPy', 'Data Science', 'Data Analysis', 'NLP',
  'Computer Vision', 'Big Data', 'Apache Spark', 'Hadoop', 'Kafka', 'Airflow',
  'Tableau', 'Power BI', 'Excel', 'ETL', 'Data Warehousing', 'dbt', 'Snowflake',
  'Looker', 'LLM', 'Generative AI', 'RAG',

  // Mobile
  'Android', 'iOS', 'React Native', 'Flutter', 'SwiftUI', 'Xamarin',
  'Jetpack Compose',

  // Testing
  'Jest', 'Mocha', 'Cypress', 'Selenium', 'JUnit', 'PyTest', 'Testing Library',
  'Playwright', 'TDD', 'Unit Testing', 'Test Automation',

  // Tools & general engineering practice
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Agile',
  'Scrum', 'Kanban', 'Figma', 'Postman', 'VS Code', 'API Design',
  'System Design', 'OOP', 'Design Patterns', 'Data Structures', 'Algorithms',
  'Security', 'OAuth', 'JWT',

  // Product & project
  'Product Management', 'Project Management', 'Stakeholder Management',
  'Roadmapping', 'A/B Testing', 'User Research',
];

module.exports = { SKILL_TAXONOMY };
