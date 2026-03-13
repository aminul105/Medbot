import { useState, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `You are MedBot — an expert medical AI assistant trained on the uploaded medical PDF documents. You respond like a highly professional doctor with deep clinical knowledge.

STRICT RULES:
1. Base your answers ONLY on the content from the uploaded PDF documents provided in the context.
2. Always respond in BOTH Bengali (বাংলা) and English — Bengali first, then English.
3. Structure your response with these sections:
   - 🔬 রোগ পরিচিতি / Disease Overview
   - ⚠️ লক্ষণসমূহ / Symptoms
   - 🧬 কারণ / Causes
   - 💊 চিকিৎসা / Treatment
   - 📋 পরামর্শ / Medical Advice
   - 🚨 সতর্কতা / Warning Signs (when to see a doctor urgently)
4. Be thorough, accurate, and professional like a senior physician.
5. Always end with: "⚠️ এটি শুধু তথ্যগত উদ্দেশ্যে। গুরুতর উপসর্গে অবশ্যই একজন লাইসেন্সপ্রাপ্ত চিকিৎসকের পরামর্শ নিন। / This is for informational purposes only. For serious symptoms, always consult a licensed physician."`;

export default function MedicalAssistant() {
  const [pdfs, setPdfs] = useState([]);
  const [pdfContents, setPdfContents] = useState([]);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  const readPdfAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = useCallback(async (files) => {
    const pdfFiles = Array.from(files).filter(f => f.type === "application/pdf");
    if (!pdfFiles.length) return;
    setUploadingPdf(true);
    const newPdfs = [];
    const newContents = [];
    for (const file of pdfFiles) {
      const base64 = await readPdfAsBase64(file);
      newPdfs.push({ name: file.name, size: file.size, id: Date.now() + Math.random() });
      newContents.push({ name: file.name, base64 });
    }
    setPdfs(prev => [...prev, ...newPdfs]);
    setPdfContents(prev => [...prev, ...newContents]);
    setUploadingPdf(false);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removePdf = (id) => {
    const idx = pdfs.findIndex(p => p.id === id);
    setPdfs(prev => prev.filter(p => p.id !== id));
    setPdfContents(prev => prev.filter((_, i) => i !== idx));
  };

  const sendQuery = async () => {
    if (!query.trim() || loading) return;
    if (pdfContents.length === 0) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ অনুগ্রহ করে প্রথমে মেডিকেল PDF আপলোড করুন।\nPlease upload medical PDF files first."
      }]);
      return;
    }

    const userMsg = { role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      // Build message with PDF documents
      const pdfDocs = pdfContents.map(pdf => ({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdf.base64 },
        title: pdf.name,
        context: `Medical reference document: ${pdf.name}`
      }));

      const userContent = [
        ...pdfDocs,
        { type: "text", text: `Patient Query: ${query}\n\nPlease analyze the uploaded medical PDFs and provide a comprehensive professional medical response in both Bengali and English.` }
      ];

      // Build history (without PDFs for previous messages to save tokens)
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [...history, { role: "user", content: userContent }]
        })
      });

      const data = await response.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "দুঃখিত, উত্তর পাওয়া যায়নি।";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ সংযোগ ত্রুটি। পুনরায় চেষ্টা করুন। / Connection error. Please try again." }]);
    }
    setLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuery(); }
  };

  const formatMessage = (text) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("🔬") || line.startsWith("⚠️") || line.startsWith("🧬") || line.startsWith("💊") || line.startsWith("📋") || line.startsWith("🚨")) {
        return <div key={i} style={{ fontWeight: 700, marginTop: 14, marginBottom: 4, color: "#00d4a0", fontSize: 15 }}>{line}</div>;
      }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return <div key={i} style={{ paddingLeft: 16, marginBottom: 3, display: "flex", gap: 6 }}><span style={{ color: "#00d4a0" }}>▸</span><span>{line.slice(2)}</span></div>;
      }
      return line ? <div key={i} style={{ marginBottom: 3 }}>{line}</div> : <div key={i} style={{ height: 6 }} />;
    });
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080f1a",
      fontFamily: "'Noto Serif Bengali', 'Georgia', serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "0 0 40px 0"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;600;700&family=Cinzel:wght@600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0d1a2e; } ::-webkit-scrollbar-thumb { background: #00d4a0; border-radius: 3px; }
        .pdf-chip:hover .remove-btn { opacity: 1 !important; }
        .send-btn:hover { background: #00ffbe !important; transform: scale(1.05); }
        .upload-zone:hover { border-color: #00d4a0 !important; background: rgba(0,212,160,0.06) !important; }
        textarea:focus { outline: none; }
        .msg-user { animation: slideRight 0.3s ease; }
        .msg-bot { animation: slideLeft 0.3s ease; }
        @keyframes slideRight { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }
        @keyframes slideLeft { from { opacity:0; transform: translateX(-20px); } to { opacity:1; transform: translateX(0); } }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Header */}
      <div style={{
        width: "100%", background: "linear-gradient(135deg, #0d1a2e 0%, #091525 100%)",
        borderBottom: "1px solid rgba(0,212,160,0.2)", padding: "20px 24px",
        display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(10px)"
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #00d4a0, #0066ff)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, boxShadow: "0 0 20px rgba(0,212,160,0.4)"
        }}>⚕️</div>
        <div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, color: "#00d4a0", letterSpacing: 2, fontWeight: 700 }}>MedBot AI</div>
          <div style={{ fontSize: 12, color: "#4a7a6a", letterSpacing: 1 }}>Professional Medical Assistant • বাংলা & English</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: pdfContents.length ? "#00d4a0" : "#ff4466" }} className={pdfContents.length ? "pulse" : ""} />
          <span style={{ fontSize: 12, color: pdfContents.length ? "#00d4a0" : "#ff4466" }}>
            {pdfContents.length ? `${pdfContents.length} PDF সক্রিয়` : "কোনো PDF নেই"}
          </span>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 820, padding: "0 16px", marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* PDF Upload Zone */}
        <div style={{ background: "rgba(13,26,46,0.8)", border: "1px solid rgba(0,212,160,0.15)", borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#00d4a0", fontWeight: 600, marginBottom: 14, letterSpacing: 1 }}>📁 মেডিকেল PDF আপলোড করুন</div>

          <div
            className="upload-zone"
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#00d4a0" : "rgba(0,212,160,0.3)"}`,
              borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer",
              background: dragOver ? "rgba(0,212,160,0.06)" : "rgba(0,212,160,0.02)",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ color: "#7a9a8a", fontSize: 14 }}>PDF ড্র্যাগ করুন অথবা ক্লিক করুন</div>
            <div style={{ color: "#3a5a4a", fontSize: 12, marginTop: 4 }}>Multiple PDFs সাপোর্টেড</div>
            {uploadingPdf && <div style={{ color: "#00d4a0", fontSize: 13, marginTop: 8 }} className="pulse">প্রসেস হচ্ছে...</div>}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />

          {/* PDF Chips */}
          {pdfs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {pdfs.map(pdf => (
                <div key={pdf.id} className="pdf-chip" style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(0,212,160,0.1)", border: "1px solid rgba(0,212,160,0.3)",
                  borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#00d4a0", position: "relative"
                }}>
                  <span>📄</span>
                  <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pdf.name}</span>
                  <span style={{ color: "#3a6a5a", fontSize: 10 }}>({(pdf.size / 1024).toFixed(0)}KB)</span>
                  <button
                    className="remove-btn"
                    onClick={() => removePdf(pdf.id)}
                    style={{
                      background: "rgba(255,68,102,0.2)", border: "none", color: "#ff4466",
                      borderRadius: "50%", width: 18, height: 18, cursor: "pointer",
                      fontSize: 10, opacity: 0, transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div style={{
          background: "rgba(13,26,46,0.8)", border: "1px solid rgba(0,212,160,0.15)",
          borderRadius: 16, minHeight: 400, maxHeight: 520, overflowY: "auto", padding: 20,
          display: "flex", flexDirection: "column", gap: 16
        }}>
          {messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 360, gap: 16, opacity: 0.5 }}>
              <div style={{ fontSize: 56 }}>🏥</div>
              <div style={{ color: "#4a7a6a", textAlign: "center", fontSize: 15 }}>
                PDF আপলোড করুন এবং আপনার সমস্যা বলুন<br />
                <span style={{ fontSize: 13 }}>Upload PDFs and describe your symptoms</span>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "msg-user" : "msg-bot"} style={{
                display: "flex", flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start"
              }}>
                <div style={{
                  maxWidth: "85%",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #003d30, #005240)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${msg.role === "user" ? "rgba(0,212,160,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "14px 18px", color: "#d0e8e0", fontSize: 14, lineHeight: 1.7
                }}>
                  {msg.role === "user" ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 16 }}>🧑‍⚕️</span>
                      <span>{msg.content}</span>
                    </div>
                  ) : formatMessage(msg.content)}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="msg-bot" style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "18px 18px 18px 4px", padding: "14px 18px",
                display: "flex", gap: 6, alignItems: "center"
              }}>
                <span style={{ color: "#00d4a0" }}>⚕️</span>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#00d4a0",
                    animation: `pulse 1s ${i * 0.2}s infinite`
                  }} />
                ))}
                <span style={{ color: "#4a7a6a", fontSize: 13 }}>বিশ্লেষণ করছি...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          background: "rgba(13,26,46,0.9)", border: "1px solid rgba(0,212,160,0.2)",
          borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-end"
        }}>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="আপনার সমস্যা বা লক্ষণ বলুন... (Describe your symptoms)"
            rows={2}
            style={{
              flex: 1, background: "transparent", border: "none", color: "#d0e8e0",
              fontSize: 14, lineHeight: 1.6, resize: "none",
              fontFamily: "'Noto Serif Bengali', serif",
              caretColor: "#00d4a0"
            }}
          />
          <button
            className="send-btn"
            onClick={sendQuery}
            disabled={loading || !query.trim()}
            style={{
              background: loading || !query.trim() ? "rgba(0,212,160,0.2)" : "#00d4a0",
              border: "none", borderRadius: 12, width: 46, height: 46, cursor: loading || !query.trim() ? "not-allowed" : "pointer",
              fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s", flexShrink: 0
            }}
          >
            {loading ? "⏳" : "➤"}
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#2a4a3a" }}>
          ⚠️ এটি শুধু তথ্যগত উদ্দেশ্যে। চিকিৎসার জন্য সর্বদা লাইসেন্সপ্রাপ্ত চিকিৎসকের পরামর্শ নিন।
        </div>
      </div>
    </div>
  );
}
