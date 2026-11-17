import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import './MessCountPage.css';

const BOTH_HOSTELS = 'both-hostels';
const preferences = [
  ['chicken', 'Chicken'],
  ['fish', 'Fish'],
  ['egg', 'Egg'],
  ['beef', 'Beef'],
  ['none', 'None'],
];

function getVisibleColumns(preference) {
  if (preference === 'none') return [{ key: 'meal_count', label: 'Total' }];

  const label = preferences.find(([key]) => key === preference)?.[1] || 'Chicken';
  return [
    { key: 'meal_count', label: 'Total' },
    { key: preference, label },
    { key: 'veg', label: 'Veg-only' },
    { key: 'not_preferred', label: `No-${label}` },
  ];
}

function getColumnValue(row, column, preference) {
  if (column.key === 'not_preferred') {
    return Math.max(0, Number(row.meal_count || 0) - Number(row[preference] || 0) - Number(row.veg || 0));
  }
  return row[column.key] ?? 0;
}

function getTomorrowInIndia() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1))
    .toISOString()
    .slice(0, 10);
}

function formatIndiaTime(timestamp) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function drawRoundedRect(context, x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.stroke();
  }
}

function createSnapshotBlob(summary, hostelName) {
  const scale = 2;
  const width = 1000;
  const topCardHeight = 136;
  const tableTop = 160;
  const headerHeight = 56;
  const rowHeight = 58;
  const requestedAtHeight = 48;
  const footerHeight = 48;
  const visibleColumns = getVisibleColumns(summary.preference);
  const tableHeight = headerHeight + rowHeight * summary.rows.length + requestedAtHeight + footerHeight;
  const height = tableTop + tableHeight;
  const padding = 22;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Unable to create the snapshot image.'));
  context.scale(scale, scale);
  context.fillStyle = '#f5f8f6';
  context.fillRect(0, 0, width, height);

  context.lineWidth = 1;
  drawRoundedRect(context, 0.5, 0.5, width - 1, topCardHeight - 1, 18, '#ffffff', '#e2e9e3');
  const fieldGap = 20;
  const fieldWidth = (width - padding * 2 - fieldGap * 2) / 3;
  const fields = [
    { label: 'HOSTEL', value: hostelName },
    { label: 'DATE', value: new Date(`${summary.date}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }) },
    { label: 'PREFERENCE', value: preferences.find(([key]) => key === summary.preference)?.[1] || 'Chicken' },
  ];
  fields.forEach((field, index) => {
    const x = padding + index * (fieldWidth + fieldGap);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#36473b';
    context.font = '700 14px Arial, sans-serif';
    context.fillText(field.label, x, 34);
    drawRoundedRect(context, x, 48, fieldWidth, 54, 10, '#ffffff', '#d4ded6');
    context.fillStyle = '#17241b';
    context.font = '16px Arial, sans-serif';
    context.fillText(field.value, x + 18, 81);
  });

  drawRoundedRect(context, 0.5, tableTop + 0.5, width - 1, tableHeight - 1, 18, '#ffffff', '#e2e9e3');
  context.save();
  context.beginPath();
  context.roundRect(1, tableTop + 1, width - 2, tableHeight - 2, 18);
  context.clip();
  context.fillStyle = '#f3f7f3';
  context.fillRect(1, tableTop + 1, width - 2, headerHeight);

  const labels = ['Meal', ...visibleColumns.map(column => column.label)];
  const weights = [0.28, ...visibleColumns.map(() => 0.72 / visibleColumns.length)];
  const contentWidth = width - padding * 2;
  const columnWidths = weights.map(weight => contentWidth * weight);
  const columnStarts = [];
  let columnStart = padding;
  columnWidths.forEach(columnWidth => {
    columnStarts.push(columnStart);
    columnStart += columnWidth;
  });

  context.font = '700 13px Arial, sans-serif';
  context.fillStyle = '#536257';
  context.textBaseline = 'middle';
  labels.forEach((label, index) => {
    if (index === 0) {
      context.textAlign = 'left';
      context.fillText(label.toUpperCase(), columnStarts[index], tableTop + headerHeight / 2);
    } else {
      context.textAlign = 'center';
      context.fillText(label.toUpperCase(), columnStarts[index] + columnWidths[index] / 2, tableTop + headerHeight / 2);
    }
  });

  summary.rows.forEach((row, rowIndex) => {
    const rowY = tableTop + headerHeight + rowIndex * rowHeight;
    context.strokeStyle = '#e7ece8';
    context.beginPath();
    context.moveTo(1, rowY + rowHeight);
    context.lineTo(width - 1, rowY + rowHeight);
    context.stroke();

    context.textBaseline = 'middle';
    context.textAlign = 'left';
    context.fillStyle = '#17241b';
    context.font = '700 16px Arial, sans-serif';
    context.fillText(row.meal, padding, rowY + rowHeight / 2);

    context.fillStyle = '#27362b';
    context.font = '16px Arial, sans-serif';
    visibleColumns.forEach((column, columnIndex) => {
      const index = columnIndex + 1;
      context.textAlign = 'center';
      context.fillText(String(getColumnValue(row, column, summary.preference)), columnStarts[index] + columnWidths[index] / 2, rowY + rowHeight / 2);
    });
  });

  const requestedAtY = tableTop + headerHeight + rowHeight * summary.rows.length;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillStyle = '#536257';
  context.font = '14px Arial, sans-serif';
  context.fillText(`Snapshot requested at ${formatIndiaTime(summary.requestedAt)} IST`, padding, requestedAtY + requestedAtHeight / 2);

  const footerY = requestedAtY + requestedAtHeight;
  context.strokeStyle = '#e7ece8';
  context.beginPath();
  context.moveTo(1, footerY);
  context.lineTo(width - 1, footerY);
  context.stroke();
  context.fillStyle = '#78847c';
  context.font = '14px Arial, sans-serif';
  const footerDate = new Date(`${summary.date}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
  context.fillText(`${hostelName} · ${footerDate}`, padding, footerY + footerHeight / 2);
  context.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to encode the snapshot image.'));
    }, 'image/png');
  });
}

function getSnapshotFilename(timestamp) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(timestamp).map(({ type, value }) => [type, value]),
  );
  return `DigiMessBook_Count_${parts.day}${parts.month}${parts.year}_${parts.hour}${parts.minute}.png`;
}

export default function MessCountPage() {
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState('');
  const [date, setDate] = useState(getTomorrowInIndia);
  const [preference, setPreference] = useState('chicken');
  const [summary, setSummary] = useState(null);
  const [loadingHostels, setLoadingHostels] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState('');
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState('');
  const summaryRequest = useRef(0);

  useEffect(() => {
    let active = true;

    async function loadHostels() {
      if (!supabase) {
        setError('Supabase is not configured. Add the local API values to client/.env.local.');
        setLoadingHostels(false);
        return;
      }

      try {
        const { data, error: queryError } = await supabase.rpc('mess_count_hostels');
        if (!active) return;

        if (queryError) {
          setError(queryError.message);
        } else {
          setHostels(data || []);
          if (!data?.length) setError('No hostels are available for this dashboard.');
        }
      } catch (queryError) {
        if (active) setError(queryError.message || 'Unable to load hostels.');
      } finally {
        if (active) setLoadingHostels(false);
      }
    }

    loadHostels();
    return () => { active = false; };
  }, []);

  async function getSummary(event) {
    event.preventDefault();
    if (!hostelId || !date || !supabase) {
      setError('Select a hostel and date to get the summary.');
      return;
    }

    const requestId = ++summaryRequest.current;
    const requestedHostelId = hostelId;
    const requestedDate = date;
    const requestedPreference = preference;
    const requestedAt = new Date().toISOString();

    setError('');
    setSummary(null);
    setLoadingSummary(true);
    try {
      const { data, error: queryError } = await supabase.rpc('mess_count_summary', {
        p_hostel: requestedHostelId === BOTH_HOSTELS ? null : requestedHostelId,
        p_date: requestedDate,
      });

      if (requestId !== summaryRequest.current) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setSummary({
          hostelId: requestedHostelId,
          date: requestedDate,
          preference: requestedPreference,
          requestedAt,
          rows: data || [],
        });
      }
    } catch (queryError) {
      if (requestId === summaryRequest.current) {
        setError(queryError.message || 'Unable to load the mess count.');
      }
    } finally {
      if (requestId === summaryRequest.current) setLoadingSummary(false);
    }
  }

  function getSnapshotHostelName(snapshot) {
    return snapshot.hostelId === BOTH_HOSTELS
      ? 'MH 1 & 2'
      : hostels.find(hostel => hostel.id === snapshot.hostelId)?.name || 'Hostel';
  }

  const visibleColumns = summary ? getVisibleColumns(summary.preference) : [];

  async function downloadSnapshot() {
    if (!summary || snapshotBusy) return;
    setSnapshotBusy(true);
    setSnapshotStatus('');
    try {
      const blob = await createSnapshotBlob(summary, getSnapshotHostelName(summary));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getSnapshotFilename(new Date());
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSnapshotStatus('Snapshot downloaded.');
    } catch (snapshotError) {
      setSnapshotStatus(snapshotError.message || 'Unable to download the snapshot.');
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function copySnapshot() {
    if (!summary || snapshotBusy) return;
    setSnapshotBusy(true);
    setSnapshotStatus('');
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('PNG clipboard copy is not supported by this browser.');
      }
      const snapshotBlob = createSnapshotBlob(summary, getSnapshotHostelName(summary));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': snapshotBlob })]);
      setSnapshotStatus('Snapshot copied to clipboard.');
    } catch (snapshotError) {
      setSnapshotStatus(snapshotError.message || 'Unable to copy the snapshot.');
    } finally {
      setSnapshotBusy(false);
    }
  }

  return (
    <main className="mess-count-page">
      <a className="mess-count-back" href="/">← Back to Mess Book</a>
      <header className="mess-count-header">
        <span className="mess-count-eyebrow">Digi Mess Book</span>
        <h1>Mess Count</h1>
        <p>Daily meal selections and food preferences by hostel.</p>
      </header>

      <form className="mess-count-card" onSubmit={getSummary}>
        <div className="mess-count-filters">
          <label>
            <span>Hostel</span>
            <select
              value={hostelId}
              onChange={event => { summaryRequest.current += 1; setHostelId(event.target.value); setSummary(null); setError(''); }}
              disabled={loadingHostels || loadingSummary || hostels.length === 0}
              required
            >
              <option value="">{loadingHostels ? 'Loading hostels…' : 'Select hostel'}</option>
              {hostels.map(hostel => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}
              {hostels.some(hostel => hostel.name === 'MH 1') && hostels.some(hostel => hostel.name === 'MH 2') && (
                <option value={BOTH_HOSTELS}>MH 1 &amp; 2</option>
              )}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={event => { summaryRequest.current += 1; setDate(event.target.value); setSummary(null); setError(''); }}
              disabled={loadingSummary}
              required
            />
          </label>
          <label>
            <span>Preference</span>
            <select
              value={preference}
              onChange={event => { summaryRequest.current += 1; setPreference(event.target.value); setSummary(null); setError(''); }}
              disabled={loadingSummary}
              required
            >
              {preferences.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <button className="mess-count-submit" type="submit" disabled={loadingSummary || loadingHostels || hostels.length === 0}>
            {loadingSummary ? 'Getting Summary…' : 'Get Summary'}
          </button>
        </div>
        {error && <p className="mess-count-error" role="alert">{error}</p>}
      </form>

      <section className="mess-count-results" aria-live="polite">
        {summary === null ? (
          <div className="mess-count-empty">Choose a hostel and date, then select <b>Get Summary</b>.</div>
        ) : (
          <div className="mess-count-table-wrap">
            <table className="mess-count-table">
              <thead>
                <tr><th scope="col">Meal</th>{visibleColumns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {summary.rows.map(row => (
                  <tr key={row.meal}>
                    <th scope="row">{row.meal}</th>
                    {visibleColumns.map(column => <td key={column.key}>{getColumnValue(row, column, summary.preference)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mess-count-calculated-at">
              Snapshot requested at {formatIndiaTime(summary.requestedAt)} IST
            </p>
            <p className="mess-count-caption">
              {summary.hostelId === BOTH_HOSTELS ? 'MH 1 & 2' : hostels.find(hostel => hostel.id === summary.hostelId)?.name} · {new Date(`${summary.date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long' })}
            </p>
            <div className="mess-count-snapshot-actions">
              <button type="button" onClick={downloadSnapshot} disabled={snapshotBusy}>
                Download Snapshot
              </button>
              <button type="button" className="mess-count-copy" onClick={copySnapshot} disabled={snapshotBusy}>
                Copy Snapshot
              </button>
            </div>
            {snapshotStatus && <p className="mess-count-snapshot-status" role="status">{snapshotStatus}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
