import React, { useState } from 'react';
import { FileSpreadsheet, Copy, CheckCircle2, Info, ArrowRight } from 'lucide-react';

export default function SheetsIntegration() {
  const [copied, setCopied] = useState('');

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const sheetsScript = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Add a new row with the received data
  sheet.appendRow([
    new Date(),
    data.phone || '',
    data.name || '',
    data.message || '',
    data.status || '',
    data.campaign || ''
  ]);
  
  return ContentService
    .createTextOutput(JSON.stringify({"status": "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService
    .createTextOutput("Webhook is active")
    .setMimeType(ContentService.MimeType.TEXT);
}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-500/15 to-brand-500/5 rounded-2xl border border-green-500/20">
        <div className="w-12 h-12 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
          <FileSpreadsheet size={24} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Google Sheets Integration</h1>
          <p className="text-surface-400 text-sm">Automatically sync WhatsApp contacts and messages directly to Google Sheets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Script Panel */}
        <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-700 bg-surface-800/40">
            <Code size={18} className="text-brand-400" />
            <h2 className="text-base font-bold text-white">Apps Script Code</h2>
          </div>
          <div className="p-4 bg-surface-900/50 flex-1 relative group">
            <pre className="text-[11px] text-surface-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {sheetsScript}
            </pre>
            <button 
              onClick={() => handleCopy(sheetsScript, 'script')}
              className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-xs text-white transition-all opacity-0 group-hover:opacity-100 border border-surface-600 shadow-xl"
            >
              {copied === 'script' ? <CheckCircle2 size={14} className="text-brand-400" /> : <Copy size={14} />}
              {copied === 'script' ? 'Copied to Clipboard!' : 'Copy Script'}
            </button>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-700 bg-surface-800/40">
            <Info size={18} className="text-blue-400" />
            <h2 className="text-base font-bold text-white">Setup Instructions</h2>
          </div>
          <div className="p-6 space-y-6 bg-surface-900/30">
            
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-700 before:to-transparent">
              
              {[
                { step: 1, title: 'Create Spreadsheet', desc: 'Open Google Sheets and create a new blank spreadsheet. Name it anything you like.' },
                { step: 2, title: 'Open Apps Script', desc: 'In the top menu, go to Extensions → Apps Script. Delete any existing code.' },
                { step: 3, title: 'Paste & Save', desc: 'Paste the copied script into the editor and click the Save icon (or press Ctrl+S).' },
                { step: 4, title: 'Deploy Web App', desc: 'Click "Deploy" (top right) → "New deployment". Select type "Web app".' },
                { step: 5, title: 'Set Permissions', desc: 'Under "Who has access", select "Anyone". Click Deploy and authorize the app if prompted.' },
                { step: 6, title: 'Connect Webhook', desc: 'Copy the generated "Web app URL" and paste it into the Webhook URL field in the API Access page.' },
              ].map(s => (
                <div key={s.step} className="relative flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-surface-800 border-2 border-surface-600 flex items-center justify-center text-xs font-bold text-white z-10 shrink-0">
                    {s.step}
                  </div>
                  <div className="pt-1 pb-2">
                    <p className="text-sm font-bold text-white">{s.title}</p>
                    <p className="text-xs text-surface-400 mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 flex gap-3">
              <CheckCircle2 size={16} className="text-brand-400 shrink-0 mt-0.5" />
              <p className="text-xs text-brand-300 leading-relaxed">
                Once set up, every incoming message or contact update sent to your panel webhook will automatically be added as a new row in your spreadsheet in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Code = ({ size, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="16 18 22 12 16 6"></polyline>
    <polyline points="8 6 2 12 8 18"></polyline>
  </svg>
);
