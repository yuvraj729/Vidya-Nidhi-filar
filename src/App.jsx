import { useState, useEffect } from 'react';
import { getApplicationByRefId, updateApplicationFields } from './dataStore';

const UPLOAD_FEE = 149;

async function checkPaymentStatus(orderId, attempt = 0) {
  try {
    const res = await fetch('/api/zapupi-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    });
    const data = await res.json();
    const status = data?.data?.status || data?.status;
    if (status === 'Pending' && attempt < 5) {
      await new Promise(r => setTimeout(r, 2000));
      return checkPaymentStatus(orderId, attempt + 1);
    }
    return status || 'Failed';
  } catch (e) {
    return 'Failed';
  }
}

export default function App() {
  const [refId, setRefId] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [fileData, setFileData] = useState('');
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState('lookup'); // lookup | details | paying | done | failed
  const [payMsg, setPayMsg] = useState('');

  // Handle returning from ZapUPI's payment page
  useEffect(() => {
    if (!window.location.hash.startsWith('#payment-return')) return;
    const docId = sessionStorage.getItem('pendingDocId');
    const orderId = sessionStorage.getItem('pendingOrderId');
    const savedFileData = sessionStorage.getItem('pendingFileData');
    const savedFileName = sessionStorage.getItem('pendingFileName');
    const savedRefId = sessionStorage.getItem('pendingRefId');
    if (!docId || !orderId) return;

    setStage('paying');
    setPayMsg('Confirming your payment…');
    (async () => {
      const status = await checkPaymentStatus(orderId);
      if (status === 'Success') {
        try {
          await updateApplicationFields(docId, {
            marksheetUrl: savedFileData,
            marksheetFileName: savedFileName,
            marksheetUploadedAt: Date.now(),
            marksheetFeeStatus: 'paid'
          });
          setFound({ docId, id: savedRefId });
          setStage('done');
        } catch (err) {
          setPayMsg('Payment succeeded but the upload failed to save. Please contact support with your reference ID: ' + savedRefId);
          setStage('failed');
        }
      } else {
        setPayMsg('Payment was not completed (' + status + '). Please try again.');
        setStage('failed');
      }
      sessionStorage.removeItem('pendingDocId');
      sessionStorage.removeItem('pendingOrderId');
      sessionStorage.removeItem('pendingFileData');
      sessionStorage.removeItem('pendingFileName');
      sessionStorage.removeItem('pendingRefId');
      window.location.hash = '';
    })();
  }, []);

  const lookup = async (e) => {
    e.preventDefault();
    setError(''); setFound(null); setFileData(''); setFileName('');
    const id = refId.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    try {
      const result = await getApplicationByRefId(id);
      if (result) { setFound(result); setStage('details'); }
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

  const payAndUpload = async () => {
    if (!fileData) { alert('Please choose your marksheet file first.'); return; }
    setStage('paying');
    setPayMsg('Creating your payment order…');
    const orderId = 'MKS' + Date.now();
    sessionStorage.setItem('pendingDocId', found.docId);
    sessionStorage.setItem('pendingOrderId', orderId);
    sessionStorage.setItem('pendingFileData', fileData);
    sessionStorage.setItem('pendingFileName', fileName);
    sessionStorage.setItem('pendingRefId', found.id);
    try {
      const res = await fetch('/api/zapupi-create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, amount: UPLOAD_FEE, customer_mobile: found.phone || '9999999999', remark: found.id })
      });
      const data = await res.json();
      if (data.status === 'success' && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        setPayMsg('Could not start payment: ' + (data.message || 'unknown error'));
        setStage('failed');
      }
    } catch (err) {
      setPayMsg('Could not reach the payment server. Please try again.');
      setStage('failed');
    }
  };

  const retry = () => {
    setStage('details');
    setPayMsg('');
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
        <p>Enter the reference ID you received when you applied on the Vidya Nidhi scholarship site. Your details will be fetched automatically — attach your marksheet and complete the processing fee to finish.</p>
      </div>

      <main>
        {stage === 'lookup' && (
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
        )}

        {stage === 'details' && found && (
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
              {fileData && !processing && <div className="hint">Ready: {fileName}</div>}
            </div>
            <div className="btn-row">
              <button className="btn btn-accent" onClick={payAndUpload} disabled={processing || !fileData}>
                Pay ₹{UPLOAD_FEE} &amp; Upload
              </button>
            </div>
          </div>
        )}

        {stage === 'paying' && (
          <div className="panel">
            <div className="success">
              <div className="stamp" style={{ background: 'var(--saffron)' }}>₹</div>
              <h3>₹{UPLOAD_FEE}</h3>
              <p>{payMsg}</p>
            </div>
          </div>
        )}

        {stage === 'failed' && (
          <div className="panel">
            <div className="success">
              <h3 style={{ color: 'var(--red)' }}>Payment not completed</h3>
              <p>{payMsg}</p>
            </div>
            <div className="btn-row">
              <button className="btn btn-accent" onClick={retry}>Try Again</button>
            </div>
          </div>
        )}

        {stage === 'done' && found && (
          <div className="panel">
            <div className="success">
              <div className="stamp">&#10003;</div>
              <h3>Marksheet uploaded</h3>
              <p>Payment confirmed and your marksheet has been attached to your application.</p>
              <div className="refno">Reference ID: {found.id}</div>
            </div>
          </div>
        )}
      </main>

      <footer>Vidya Nidhi — Marksheet Upload Portal</footer>
    </>
  );
}
