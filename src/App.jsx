import { useState, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `You are MedBot — an expert medical AI assistant with deep clinical knowledge. You respond like a highly professional senior physician.

STRICT RULES:
1. Always respond in BOTH Bengali (বাংলা) and English — Bengali first, then English.
2. Structure every response with these exact sections:
   🔬 রোগ পরিচিতি / Disease Overview
   ⚠️ লক্ষণসমূহ / Symptoms
   🧬 কারণ / Causes
   💊 চিকিৎসা / Treatment
   📋 পরামর্শ / Medical Advice
   🚨 সতর্কতা / Warning Signs (when to see a doctor urgently)
3. Be thorough, accurate, and professional.
4. Always end with: "⚠️ এটি শুধু তথ্যগত উদ্দেশ্যে। গুরুতর উপসর্গে অবশ্যই একজন লাইসেন্সপ্রাপ্ত চিকিৎসকের পরামর্শ নিন। / This is for informational purposes only. Always consult a licensed physician for serious symptoms."`;

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("medbot_key") || "");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKeySetup, setShowKeySetup] = useState(!localStorage.getItem("medbot_key"));
  const [pdfs, setPdfs] = useState([]);
  const [pdfContents, setPdfContents] = useState([]);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const saveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem("medbot_key", apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
    setShowKeySetup(false);
  };

  const removeApiKey = () => {
    localStorage.removeItem("medbot_key");
    setApiKey("");
    setApiKeyInput("");
    setShowKeySetup(true);
  };

  const readPdfAsBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleFiles = useCallback(async (files) => {
    const pdfFiles = Array.from(files).filter(f => f.type === "application/pdf");
    if (!pdfFiles.length) return;
    for (const file of pdfFiles) {
      const base64 = await readPdfAsBase64(file);
      const id = Date.now() + Math.random();
      setPdfs(prev => [...prev, { name: file.name, size: file.size, id }]);
      setPdfContents(prev => [...prev, { name: file.name, base64, id }]);
    }
  }, []);

  const removePdf = (id) => {
    setPdfs(prev => prev.filter(p => p.id !== id));
    setPdfContents(prev => prev.filter(p => p.id !== id));
  };

  const sendQuery = async () => {
    if (!query.trim() || loading || !apiKey) return;

    const userMsg = { role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    try {
      let userContent;
      if (pdfContents.length > 0) {
        const pdfDocs = pdfContents.map(pdf => ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdf.base64 },
          title: pdf.name
        }));
        userContent = [...pdfDocs, { type: "text", text: `Patient Query: ${query}\n\nPlease analyze the uploaded medical PDFs and provide a comprehensive professional response in both Bengali and English.` }];
      } else {
        userContent = query;
      }

      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [...history, { role: "user", content: userContent }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.find(b => b.type === "text")?.text || "দুঃখিত, উত্তর পাওয়া যায়নি।";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ত্রুটি: ${err.message}\n\nAPI Key সঠিক আছে কিনা চেক করুন।` }]);
    }
    setLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const formatMessage = (text) => text.split("\n").map((line, i) => {
    const isHeader = ["🔬","⚠️","🧬","💊","📋","🚨"].some(e => line.startsWith(e));
    const isBullet = line.startsWith("- ") || line.startsWith("• ");
    if (isHeader) return <div key={i} style={{ fontWeight: 700, marginTop: 14, marginBottom: 4, color: "#00d4a0", fontSize: 15 }}>{line}</div>;
    if (isBullet) return <div key={i} style={{ paddingLeft: 16, marginBottom: 3, display: "flex", gap: 6 }}><span style={{ color: "#00d4a0" }}>▸</span><span>{line.slice(2)}</span></div>;
    return line ? <div key={i} style={{ marginBottom: 3 }}>{line}</div> : <div key={i} style={{ height: 6 }} />;
  });

  // API Key Setup Screen
  if (showKeySetup) return (
    <div style={{ minHeight: "100vh", background: "#080f1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Noto Serif Bengali', Georgia, serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;600;700&family=Cinzel:wght@600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ background: "#0d1a2e", border: "1px solid rgba(0,212,160,0.2)", borderRadius: 20, padding: 36, maxWidth: 480, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚕️</div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: "#00d4a0", fontWeight: 700, letterSpacing: 2 }}>MedBot AI</div>
          <div style={{ color: "#4a7a6a", fontSize: 13, marginTop: 6 }}>Professional Medical Assistant</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#7a9a8a", fontSize: 14, marginBottom: 10 }}>
            🔑 Anthropic API Key দিন:<br />
            <span style={{ fontSize: 12, color: "#3a5a4a" }}>
              console.anthropic.com থেকে ফ্রি key নিন
            </span>
          </div>
          <input
            type="password"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveApiKey()}
            placeholder="sk-ant-..."
            style={{ width: "100%", background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.3)", borderRadius: 10, padding: "12px 14px", color: "#d0e8e0", fontSize: 14, outline: "none" }}
          />
        </div>
        <button
          onClick={saveApiKey}
          disabled={!apiKeyInput.trim()}
          style={{ width: "100%", background: apiKeyInput.trim() ? "#00d4a0" : "rgba(0,212,160,0.2)", border: "none", borderRadius: 10, padding: 14, color: "#000", fontSize: 15, fontWeight: 700, cursor: apiKeyInput.trim() ? "pointer" : "not-allowed" }}
        >
          শুরু করুন →
        </button>
        <div style={{ marginTop: 16, padding: 14, background: "rgba(255,200,0,0.06)", borderRadius: 10, border: "1px solid rgba(255,200,0,0.15)" }}>
          <div style={{ color: "#ccaa00", fontSize: 12, lineHeight: 1.6 }}>
            🔒 আপনার API Key শুধু আপনার ব্রাউজারে সেভ থাকবে। কোনো সার্ভারে পাঠানো হবে না।
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080f1a", fontFamily: "'Noto Serif Bengali', Georgia, serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;600;700&family=Cinzel:wght@600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#0d1a2e} ::-webkit-scrollbar-thumb{background:#00d4a0;border-radius:3px}
        .chip:hover .rm{opacity:1!important}
        .sbtn:hover{background:#00ffbe!important;transform:scale(1.04)}
        .uz:hover{border-color:#00d4a0!important;background:rgba(0,212,160,.07)!important}
        textarea:focus{outline:none}
        .slide-r{animation:sr .3s ease} .slide-l{animation:sl .3s ease}
        @keyframes sr{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        @keyframes sl{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
        .pulse{animation:pu 2s infinite} @keyframes pu{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* Header */}
      <div style={{ width: "100%", background: "#0d1a2e", borderBottom: "1px solid rgba(0,212,160,.2)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#00d4a0,#0066ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 0 18px rgba(0,212,160,.4)" }}>⚕️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 18, color: "#00d4a0", letterSpacing: 2, fontWeight: 700 }}>MedBot AI</div>
          <div style={{ fontSize: 11, color: "#4a7a6a" }}>Professional Medical Assistant • বাংলা & English</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00d4a0" }} className="pulse" />
          <span style={{ fontSize: 11, color: "#00d4a0" }}>{pdfContents.length > 0 ? `${pdfContents.length} PDF` : "Ready"}</span>
          <button onClick={removeApiKey} style={{ background: "rgba(255,68,102,.15)", border: "1px solid rgba(255,68,102,.3)", color: "#ff4466", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>🔑</button>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 820, padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* PDF Upload */}
        <div style={{ background: "rgba(13,26,46,.8)", border: "1px solid rgba(0,212,160,.15)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, color: "#00d4a0", fontWeight: 600, marginBottom: 12 }}>📁 মেডিকেল PDF আপলোড করুন (ঐচ্ছিক)</div>
          <div className="uz" onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? "#00d4a0" : "rgba(0,212,160,.3)"}`, borderRadius: 10, padding: "20px 16px", textAlign: "center", cursor: "pointer", background: "rgba(0,212,160,.02)", transition: "all .2s" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
            <div style={{ color: "#7a9a8a", fontSize: 13 }}>PDF ড্র্যাগ করুন বা ক্লিক করুন</div>
            <div style={{ color: "#3a5a4a", fontSize: 11, marginTop: 3 }}>একাধিক PDF সাপোর্টেড</div>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          {pdfs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
              {pdfs.map(pdf => (
                <div key={pdf.id} className="chip" style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(0,212,160,.1)", border: "1px solid rgba(0,212,160,.3)", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#00d4a0" }}>
                  <span>📄</span>
                  <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pdf.name}</span>
                  <button className="rm" onClick={() => removePdf(pdf.id)} style={{ background: "rgba(255,68,102,.2)", border: "none", color: "#ff4466", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", fontSize: 9, opacity: 0, transition: "opacity .2s" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat */}
        <div style={{ background: "rgba(13,26,46,.8)", border: "1px solid rgba(0,212,160,.15)", borderRadius: 14, minHeight: 420, maxHeight: 540, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 380, gap: 14, opacity: .5 }}>
              <div style={{ fontSize: 52 }}>🏥</div>
              <div style={{ color: "#4a7a6a", textAlign: "center", fontSize: 14 }}>আপনার লক্ষণ বা রোগের নাম লিখুন<br /><span style={{ fontSize: 12 }}>Describe your symptoms or disease name</span></div>
            </div>
          ) : messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "slide-r" : "slide-l"} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "86%", background: msg.role === "user" ? "linear-gradient(135deg,#003d30,#005240)" : "rgba(255,255,255,.04)", border: `1px solid ${msg.role === "user" ? "rgba(0,212,160,.4)" : "rgba(255,255,255,.08)"}`, borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "13px 16px", color: "#d0e8e0", fontSize: 14, lineHeight: 1.7 }}>
                {msg.role === "user" ? <div style={{ display: "flex", gap: 8 }}><span>🧑‍⚕️</span><span>{msg.content}</span></div> : formatMessage(msg.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="slide-l" style={{ display: "flex" }}>
              <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "18px 18px 18px 4px", padding: "13px 16px", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#00d4a0" }}>⚕️</span>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#00d4a0", animation: `pu 1s ${i*.2}s infinite` }} />)}
                <span style={{ color: "#4a7a6a", fontSize: 13 }}>বিশ্লেষণ করছি...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ background: "rgba(13,26,46,.9)", border: "1px solid rgba(0,212,160,.2)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuery(); } }} placeholder="লক্ষণ বা রোগের নাম লিখুন... (Describe your symptoms)" rows={2}
            style={{ flex: 1, background: "transparent", border: "none", color: "#d0e8e0", fontSize: 14, lineHeight: 1.6, resize: "none", fontFamily: "'Noto Serif Bengali',serif", caretColor: "#00d4a0" }} />
          <button className="sbtn" onClick={sendQuery} disabled={loading || !query.trim()}
            style={{ background: loading || !query.trim() ? "rgba(0,212,160,.2)" : "#00d4a0", border: "none", borderRadius: 10, width: 44, height: 44, cursor: loading || !query.trim() ? "not-allowed" : "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0 }}>
            {loading ? "⏳" : "➤"}
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#2a4a3a" }}>
          ⚠️ শুধুমাত্র তথ্যগত উদ্দেশ্যে। চিকিৎসার জন্য সর্বদা লাইসেন্সপ্রাপ্ত চিকিৎসকের পরামর্শ নিন।
        </div>
      </div>
    </div>
  );
}
