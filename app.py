from flask import Flask, request, render_template, jsonify, session
import os
import tempfile
from google import genai
from google.genai import types
import docx
import pandas as pd
import json

app = Flask(__name__)
app.secret_key = os.environ.get("GROQ_API_KEY", "studybuddy_secret_key")

GEMINI_API_KEY = os.environ.get(
    "GEMINI_API_KEY", "AIzaSyBXT7rUzxdZAYomE1xX79-S_sz17ZLEYuk"
)
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def save_temp_file(file):
    with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp_file:
        file.save(tmp_file.name)
        return tmp_file.name


def ai_summarize(file_path, mime_type):
    if not client:
        return (
            "AI service not configured. Please set GEMINI_API_KEY environment variable."
        )

    try:
        print(f"Uploading file: {file_path}")
        file_ref = client.files.upload(file=file_path)
        print(f"File uploaded, generating summary with model gemini-2.5-flash...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[file_ref, "Provide a detailed summary of this document."],
        )
        print(f"Summary generated successfully")
        return response.text
    except Exception as e:
        print(f"Error in ai_summarize: {e}")
        return f"Error: {str(e)}"


def ai_generate_questionnaire(file_path, mime_type):
    if not client:
        return {"error": "AI service not configured"}

    try:
        file_ref = client.files.upload(file=file_path)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                file_ref,
                """Generate a questionnaire with multiple choice and open-ended questions.
                Return ONLY valid JSON array of objects with this format:
                [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "..."}]""",
            ],
        )
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text)
    except Exception as e:
        return {"error": f"Error generating questionnaire: {str(e)}"}


def ai_chat(file_path, mime_type, question):
    if not client:
        return (
            "AI service not configured. Please set GEMINI_API_KEY environment variable."
        )

    try:
        file_ref = client.files.upload(file=file_path)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                file_ref,
                f"Based on this document, answer the question and provide references: {question}",
            ],
        )
        return response.text
    except Exception as e:
        return f"Error answering question: {str(e)}"


def get_mime_type(filename):
    ext = filename.lower()
    if ext.endswith(".pdf"):
        return "application/pdf"
    elif ext.endswith(".csv"):
        return "text/csv"
    elif ext.endswith(".docx"):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif ext.endswith(".xlsx") or ext.endswith(".xls"):
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        return "application/octet-stream"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files selected"}), 400

    session["files"] = []
    for file in files:
        if file.filename == "":
            continue
        file_path = save_temp_file(file)
        session["files"].append(
            {
                "path": file_path,
                "filename": file.filename,
                "mime_type": get_mime_type(file.filename),
            }
        )

    return jsonify({"message": "Files uploaded successfully"})


@app.route("/summary")
def get_summary():
    if "files" not in session or not session["files"]:
        return jsonify({"error": "No documents uploaded"}), 400

    try:
        file_info = session["files"][0]
        summary = ai_summarize(file_info["path"], file_info["mime_type"])
        return jsonify({"summary": summary})
    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500


@app.route("/questionnaire")
def get_questionnaire():
    if "files" not in session or not session["files"]:
        return jsonify({"error": "No documents uploaded"}), 400

    try:
        file_info = session["files"][0]
        questionnaire = ai_generate_questionnaire(
            file_info["path"], file_info["mime_type"]
        )
        if isinstance(questionnaire, dict) and "error" in questionnaire:
            return jsonify(questionnaire), 500
        return jsonify({"questionnaire": questionnaire})
    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    question = data.get("question", "")

    if "files" not in session or not session["files"]:
        return jsonify({"error": "No documents uploaded"}), 400
    if not question:
        return jsonify({"error": "No question provided"}), 400

    try:
        file_info = session["files"][0]
        answer = ai_chat(file_info["path"], file_info["mime_type"], question)
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500


@app.route("/end-session", methods=["POST"])
def end_session():
    for file_info in session.get("files", []):
        try:
            os.unlink(file_info["path"])
        except:
            pass
    session.pop("files", None)
    return jsonify({"message": "Session ended"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
