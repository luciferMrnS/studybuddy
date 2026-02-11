import React, { useState } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [files, setFiles] = useState([]);
  const [summary, setSummary] = useState('');
  const [questionnaire, setQuestionnaire] = useState([]);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatAnswer, setChatAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    console.log('Uploading files:', files);
    console.log('FormData entries:', Array.from(formData.entries()));
    
    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      console.log('Server response:', data);
      
      if (response.ok) {
        alert(data.message);
        if (data.warnings) {
          alert('Warnings:\n' + data.warnings.join('\n'));
        }
      } else {
        alert('Error: ' + data.error + (data.details ? '\nDetails:\n' + data.details.join('\n') : ''));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading files: ' + error.message);
    }
    setLoading(false);
  };
 
  const handleSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/summary`);
      const data = await response.json();
      if (response.ok) {
        setSummary(data.summary);
      } else {
        alert('Error: ' + data.error + (data.details ? '\n' + data.details : ''));
      }
    } catch (error) {
      alert('Error generating summary: ' + error.message);
    }
    setLoading(false);
  };

  const handleQuestionnaire = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/questionnaire`);
      const data = await response.json();
      if (response.ok) {
        setQuestionnaire(data.questionnaire);
      } else {
        alert('Error: ' + data.error + (data.details ? '\n' + data.details : ''));
      }
    } catch (error) {
      alert('Error generating questionnaire: ' + error.message);
    }
    setLoading(false);
  };

  const handleChat = async () => {
    if (!chatQuestion) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: chatQuestion }),
      });
      const data = await response.json();
      setChatAnswer(data.answer);
    } catch (error) {
      alert('Error getting answer');
    }
    setLoading(false);
  };

  const handleEndSession = async () => {
    try {
      await fetch(`${API_URL}/end-session`, {
        method: 'POST',
      });
      setFiles([]);
      setSummary('');
      setQuestionnaire([]);
      setChatQuestion('');
      setChatAnswer('');
      alert('Session ended');
    } catch (error) {
      alert('Error ending session');
    }
  };

  return (
    <div className="App">
      <h1>Study Buddy</h1>
      <div className="upload-section">
        <input type="file" multiple onChange={handleFileChange} accept=".pdf,.docx,.xlsx,.csv,.txt" />
        <button onClick={handleUpload} disabled={loading}>Upload Files</button>
      </div>
      <div className="actions">
        <button onClick={handleSummary} disabled={loading}>Get Summary</button>
        <button onClick={handleQuestionnaire} disabled={loading}>Generate Questionnaire</button>
      </div>
      {summary && (
        <div className="summary">
          <h2>Summary</h2>
          <p>{summary}</p>
        </div>
      )}
      {questionnaire.length > 0 && (
        <div className="questionnaire">
          <h2>Questionnaire</h2>
          {questionnaire.map((q, index) => (
            <div key={index} className="question">
              <p>{q.question}</p>
              {q.options && (
                <ul>
                  {q.options.map((opt, i) => <li key={i}>{opt}</li>)}
                </ul>
              )}
              <button onClick={() => alert(q.answer)}>Reveal Answer</button>
            </div>
          ))}
        </div>
      )}
      <div className="chat">
        <h2>Ask Anything About the Uploaded Documents</h2>
        <input
          type="text"
          value={chatQuestion}
          onChange={(e) => setChatQuestion(e.target.value)}
          placeholder="Enter your question"
        />
        <button onClick={handleChat} disabled={loading}>Ask</button>
        {chatAnswer && <p>{chatAnswer}</p>}
      </div>
      <button onClick={handleEndSession} className="end-session">End Session</button>
      {loading && <p>Loading...</p>}
    </div>
  );
}

export default App;
