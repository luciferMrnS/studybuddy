const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { default: pdfParse } = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');


const app = express();
const port = 5000;

// Simple mock AI service
async function mockAIResponse(prompt) {
  // Extract key information from the prompt to provide contextual responses
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('summary')) {
    return `Document Summary:\n\nThis is a mock summary of the uploaded documents. In a real implementation, this would contain an AI-generated summary based on the actual document content. The documents appear to contain important information that would typically be analyzed and summarized here.\n\nKey points would include:\n- Main topics covered in the documents\n- Important facts and figures\n- Key conclusions or recommendations`;
  }
  
  if (lowerPrompt.includes('questionnaire')) {
    return JSON.stringify([
      {
        question: "What is the main topic of the documents?",
        options: ["Technology", "Science", "Business", "Education"],
        answer: "Technology"
      },
      {
        question: "Based on the content, what would be the most important takeaway?",
        options: [],
        answer: "The documents emphasize the importance of continuous learning and adaptation in today's rapidly changing world."
      },
      {
        question: "Which concept is mentioned most frequently?",
        options: ["Innovation", "Efficiency", "Collaboration", "Growth"],
        answer: "Innovation"
      }
    ]);
  }
  
  if (lowerPrompt.includes('question:') || lowerPrompt.includes('answer')) {
    return `Based on the documents you've uploaded, I can provide a comprehensive answer to your question. However, since this is a mock implementation, I would typically analyze the specific content of your documents to extract relevant information and provide accurate references to specific passages.\n\nIn a real implementation, this response would include:\n- Direct answers based on document content\n- Specific references to page numbers or sections\n- Relevant quotes or excerpts\n- Contextual explanations`;
  }
  
  return "I've processed your request regarding the uploaded documents. This is a mock response - in the real implementation, I would analyze the actual document content and provide detailed, context-aware responses based on the AI service you choose to integrate.";
}

app.use(cors());
app.use(express.json());

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'application/json',
      'application/octet-stream'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log('Rejected file:', file.originalname, 'MIME type:', file.mimetype);
      cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  }
});

let documentText = '';

app.post('/upload', upload.array('files'), async (req, res) => {
  console.log('Upload request received');
  console.log('Files:', req.files);
  
  const texts = [];
  const errors = [];

  if (!req.files || req.files.length === 0) {
    console.log('No files received');
    return res.status(400).json({ error: 'No files were uploaded' });
  }

  for (const file of req.files) {
    const filePath = path.join(__dirname, file.path);
    let text = '';

    try {
      if (file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        text = data.text;
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
      } else if (file.mimetype === 'application/vnd.ms-excel' || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        text = xlsx.utils.sheet_to_csv(worksheet);
      } else if (file.mimetype === 'text/csv') {
        text = fs.readFileSync(filePath, 'utf8');
      } else if (file.mimetype === 'text/plain') {
        text = fs.readFileSync(filePath, 'utf8');
      }

      texts.push(text);
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      errors.push(`Failed to process ${file.originalname}: ${error.message}`);
    } finally {
      // Clean up the file regardless of success or failure
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error(`Error cleaning up file ${filePath}:`, cleanupError);
      }
    }
  }

  if (texts.length > 0) {
    documentText = texts.join('\n\n');
    console.log('Document text length:', documentText.length);
    if (errors.length > 0) {
      res.json({ message: 'Some files uploaded and processed successfully', warnings: errors });
    } else {
      res.json({ message: 'Files uploaded and processed successfully' });
    }
  } else {
    res.status(400).json({ error: 'No files were processed successfully', details: errors });
  }
});

app.get('/summary', async (req, res) => {
  try {
    if (!documentText || documentText.trim() === '') {
      return res.status(400).json({ error: 'No documents have been uploaded yet' });
    }
    
    console.log('Generating summary for document length:', documentText.length);
    const prompt = `Please provide a detailed summary of the following documents:\n\n${documentText}`;
    const summary = await mockAIResponse(prompt);
    res.json({ summary });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({ error: 'Error generating summary', details: error.message });
  }
});

app.get('/questionnaire', async (req, res) => {
  try {
    if (!documentText || documentText.trim() === '') {
      return res.status(400).json({ error: 'No documents have been uploaded yet' });
    }
    
    console.log('Generating questionnaire for document length:', documentText.length);
    const prompt = `Based on the following documents, generate an extensive questionnaire with multiple choice and open-ended questions. Format as JSON array of objects, each with question, options (array for MCQ), and answer:\n\n${documentText}`;
    const questionnaireText = await mockAIResponse(prompt);
    const questionnaire = JSON.parse(questionnaireText);
    res.json({ questionnaire });
  } catch (error) {
    console.error('Questionnaire generation error:', error);
    res.status(500).json({ error: 'Error generating questionnaire', details: error.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!documentText || documentText.trim() === '') {
      return res.status(400).json({ error: 'No documents have been uploaded yet' });
    }
    
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    console.log('Processing chat question:', question);
    const prompt = `Based on the following documents, answer the question and provide references to specific excerpts, words, lines, or sentences from the documents:\n\nDocuments:\n${documentText}\n\nQuestion: ${question}`;
    const answer = await mockAIResponse(prompt);
    res.json({ answer });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error answering question', details: error.message });
  }
});

app.post('/end-session', (req, res) => {
  documentText = '';
  console.log('Session ended, document text cleared');
  res.json({ message: 'Session ended' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running',
    hasDocuments: documentText && documentText.trim() !== '',
    documentLength: documentText.length
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});