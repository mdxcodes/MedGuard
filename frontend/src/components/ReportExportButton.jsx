import { useState } from 'react';
import { Download, FileText } from 'lucide-react';

export default function ReportExportButton({ className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/export/report');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Export failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medguard_research_report.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-navy hover:bg-navy-soft text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
      >
        <FileText className="w-4 h-4" />
        {loading ? 'Generating...' : 'Export Research Report (PDF)'}
        <Download className="w-4 h-4" />
      </button>
      {error && <div className="text-xs text-rose-400 mt-1">{error}</div>}
    </div>
  );
}
