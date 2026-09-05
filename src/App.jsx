import { useState } from 'react';
import { getApplicationByRefId, updateApplicationFields } from './dataStore';

export default function App() {
  const [refId, setRefId] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [fileData, setFileData] = useState('');
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const lookup = async (e) => {
    e.preventDefault();
    setError(''); setFound(null); setDone(false); setFileData(''); setFileName('');
    const id = refId.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    try {
      const result = await getApplicationByRefId(id);
      if (result) setFound(result);
      else setError('No application found with this reference ID. Please check and try again.');
    } catch (err) {
      setError('Could not look up this reference ID right now. Please try again.');
    }
    setLoading(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setProcessing(true);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1000;
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setFileData(canvas.toDataURL('image/jpeg', 0.75));
          setProcessing(false);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileData(e.target.result);
        setProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitDocument = async () => {
    if (!fileData) { alert('Please choose your marksheet file first.'); return; }
    setSubmitting(true);
    try {
      await updateApplicationFields(found.docId, {
        marksheetUrl: fileData,
        marksheetFileName: fileName,
        marksheetUploadedAt: Date.now()
      });
      setDone(true);
    } catch (err) {
      alert('Could not upload right now. The file may be too large — try a smaller image or a compressed PDF. (' + err.message + ')');
    }
    setSubmitting(false);
  };

  return (
    <>
      <header className="top">
        <div className="brand">
          <div className="mark">VN</div>
          <div className="brand-text">
            <div className="name">Vidya Nidhi</div>
            <div className="tag">Marksheet Upload</div>
          </div>
        </div>
      </header>

      <div className="hero">
        <div className="eyebrow">Document submission</div>
        <h1>Upload your marksheet</h1>
        <p>Enter the reference ID you received when you applied on the Vidya Nidhi scholarship site. Your details will be fetched automatically — you only need to upload your marksheet.</p>
      </div>

      <main>
        <div className="panel">
          <form onSubmit={lookup}>
            <div className="form-row">
              <label>Application Reference ID <span className="req">*</span></label>
              <input type="text" placeholder="e.g. APP-XXXXXXXX" value={refId} onChange={e => setRefId(e.target.value)} />
            </div>
            <div className="btn-row">
              <button className="btn btn-accent" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Find My Application'}</button>
            </div>
          </form>
          {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
        </div>

        {found && !done && (
          <div className="panel">
            <h2>Your details</h2>
            <div className="form-grid">
              <div className="form-row"><label>Name (as per Aadhaar)</label><input value={found.aadharName || ''} disabled /></div>
              <div className="form-row"><label>Date of Birth</label><input value={found.aadharDob || ''} disabled /></div>
              <div className="form-row"><label>Aadhaar Number</label><input value={found.aadharNumber || ''} disabled /></div>
              <div className="form-row"><label>Class / Year</label><input value={found.classYear || ''} disabled /></div>
              <div className="form-row"><label>Gender</label><input value={found.gender || ''} disabled /></div>
              <div className="form-row full"><label>Scholarship</label><input value={found.scholarshipTitle || ''} disabled /></div>
            </div>
            <div className="hint" style={{ marginBottom: 14 }}>These details were fetched automatically from your original application — nothing to fill in here.</div>

            <div className="divider-label">Upload marksheet</div>
            <div className="form-row">
              <input type="file" accept="image/*,.pdf" onChange={e => handleFile(e.target.files[0])} />
              {processing && <div className="hint">Processing file…</div>}
              {fileData && !processing && <div className="hint">Ready to upload: {fileName}</div>}
            </div>
            <div className="btn-row">
              <button className="btn btn-accent" onClick={submitDocument} disabled={submitting || processing || !fileData}>
                {submitting ? 'Uploading…' : 'Upload Marksheet'}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="panel">
            <div className="success">
              <div className="stamp">&#10003;</div>
              <h3>Marksheet uploaded</h3>
              <p>Your marksheet has been attached to your application successfully.</p>
              <div className="refno">Reference ID: {found.id}</div>
            </div>
          </div>
        )}
      </main>

      <footer>Vidya Nidhi — Marksheet Upload Portal</footer>
    </>
  );
}
