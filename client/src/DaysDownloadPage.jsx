import { useEffect, useMemo, useState } from 'react';
import { downloadDaysExcel, downloadDaysPdf } from './daysDownloadExport';

const allHostels = 'all';
const filterChoices = [
  ['all', 'All values'], ['nonzero', 'Non-zero'], ['zero', 'Zero'], ['na', 'NA'],
];
const sortOptions = [
  ['account_number', 'Account no.'], ['room', 'Room no.'], ['hostel', 'Hostel'],
  ['days', 'No. of days'], ['extras', 'Extras'], ['fine', 'Fine'],
];
const tableHeaders = ['Account number', 'Room no.', 'Name', 'Hostel', 'Year', 'Department', 'No. of days', 'Fined days', 'Extras total'];
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function currentMonthKey() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}`;
}

function shiftMonth(month, amount) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthTitle(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function passesAmountFilter(value, filter) {
  if (filter === 'all') return true;
  if (value == null || value === '') return filter === 'na';
  const amount = Number(value);
  return filter === 'nonzero' ? amount !== 0 : filter === 'zero' && amount === 0;
}

function compareValues(first, second) {
  if (first == null || first === '') return second == null || second === '' ? 0 : 1;
  if (second == null || second === '') return -1;
  if (typeof first === 'number' && typeof second === 'number') return first - second;
  return collator.compare(String(first), String(second));
}

function rowValue(student, key) {
  if (key === 'hostel') return student.hostels?.name || '';
  if (key === 'fine') return student.finedDays;
  if (key === 'extras') return student.extrasTotal;
  return student[key] ?? '';
}

function exportRow(student) {
  return [
    student.account_number || '—', student.room || '—', student.full_name || '—',
    student.hostels?.name || '—', student.academic_year || '—', student.department || '—',
    Number(student.days || 0), student.finedDays ?? 'NA', student.extrasTotal ?? 'NA',
  ];
}

function downloadDateStamp(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}.${parts.minute}-${parts.dayPeriod.toUpperCase()}`;
}

function fileHostelName(name) {
  return name.replace(/[^a-z0-9 -]/gi, '').trim().replace(/\s+/g, '-');
}

export default function DaysDownloadPage({ hostels, onHome, callMessAdmin }) {
  const todayMonth = currentMonthKey();
  const monthOptions = useMemo(() => [-1, 0, 1].map(offset => {
    const month = shiftMonth(todayMonth, offset);
    return { month, label: monthTitle(month), relative: offset === -1 ? 'Previous month' : offset === 0 ? 'Current month' : 'Next month' };
  }), [todayMonth]);
  const [month, setMonth] = useState(() => shiftMonth(currentMonthKey(), -1));
  const [hostelFilter, setHostelFilter] = useState(() => hostels.length === 1 ? hostels[0].id : allHostels);
  const [departmentFilter, setDepartmentFilter] = useState(allHostels);
  const [yearFilter, setYearFilter] = useState(allHostels);
  const [fineFilter, setFineFilter] = useState('all');
  const [extrasFilter, setExtrasFilter] = useState('all');
  const [sortKeys, setSortKeys] = useState(['account_number']);
  const [newSort, setNewSort] = useState('');
  const [sourceRows, setSourceRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSourceRows([]);
    callMessAdmin('days-download', { month })
      .then(data => { if (active) setSourceRows(data.students || []); })
      .catch(loadError => { if (active) setError(loadError.message || 'Unable to load days for this month.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [callMessAdmin, month]);

  const departments = useMemo(() => [...new Set(sourceRows.map(student => student.department).filter(Boolean))].sort(collator.compare), [sourceRows]);
  const years = useMemo(() => [...new Set(sourceRows.map(student => student.academic_year).filter(Boolean))].sort(collator.compare), [sourceRows]);
  const selectedHostel = hostels.find(hostel => hostel.id === hostelFilter);
  const hostelLabel = hostelFilter === allHostels ? 'All' : selectedHostel?.name || hostels[0]?.name || 'All';
  const billReady = month < todayMonth;

  const filteredRows = useMemo(() => sourceRows.filter(student => (
    (hostelFilter === allHostels || student.hostel_id === hostelFilter)
    && (departmentFilter === allHostels || student.department === departmentFilter)
    && (yearFilter === allHostels || student.academic_year === yearFilter)
    && passesAmountFilter(student.finedDays, fineFilter)
    && passesAmountFilter(student.extrasTotal, extrasFilter)
  )), [departmentFilter, extrasFilter, fineFilter, hostelFilter, sourceRows, yearFilter]);

  const sortedRows = useMemo(() => [...filteredRows].sort((first, second) => {
    for (const key of sortKeys) {
      const difference = compareValues(rowValue(first, key), rowValue(second, key));
      if (difference) return difference;
    }
    return compareValues(first.account_number, second.account_number);
  }), [filteredRows, sortKeys]);

  function resetFiltersAndSort() {
    setHostelFilter(hostels.length === 1 ? hostels[0].id : allHostels);
    setDepartmentFilter(allHostels);
    setYearFilter(allHostels);
    setFineFilter('all');
    setExtrasFilter('all');
    setSortKeys(['account_number']);
    setNewSort('');
  }

  function addSort(key) {
    if (!key) return;
    setSortKeys(current => current.includes(key) ? current : [...current, key]);
    setNewSort('');
  }

  function removeSort(key) {
    setSortKeys(current => {
      const next = current.filter(item => item !== key);
      return next.length ? next : ['account_number'];
    });
  }

  function exportFile(kind) {
    if (!billReady || loading) return;
    const timestamp = downloadDateStamp(new Date());
    const safeHostel = fileHostelName(hostelLabel);
    const filename = `Days-${month.slice(0, 4)}_${monthTitle(month).split(' ')[0]}-${safeHostel} - Download date ${timestamp}.${kind === 'excel' ? 'xlsx' : 'pdf'}`;
    const rows = sortedRows.map(exportRow);
    if (kind === 'excel') {
      downloadDaysExcel({ filename, headers: tableHeaders, rows });
      return;
    }
    downloadDaysPdf({
      filename,
      title: `${hostelLabel} | ${monthTitle(month)}`,
      subtitle: `Bill status: Bill Ready | Download date ${timestamp}`,
      headers: tableHeaders,
      rows,
    });
  }

  return (
    <>
      <div className="ma-subpage-heading ma-days-back-heading">
        <button className="ma-back-home" onClick={onHome}>← Home</button>
        <div><span className="ma-eyebrow">MONTHLY RECORDS</span><h1>Days Download</h1><p>Review billable days and download a filtered student list.</p></div>
        <span className="ma-count-pill">{sortedRows.length} students</span>
      </div>

      <section className="ma-days-title-card" aria-label="Days download month and bill status">
        <div className="ma-days-title-copy"><span className="ma-eyebrow">HOSTEL · BILL PERIOD</span><h2>{hostelLabel} <i>·</i> {monthTitle(month)}</h2><p>{billReady ? 'The selected month has ended and is ready for download.' : 'Downloads open after the selected month has ended.'}</p></div>
        <label className="ma-days-month-picker"><span>Month &amp; year</span><select aria-label="Select month and year" value={month} onChange={event => setMonth(event.target.value)}>
          {monthOptions.map(option => <option key={option.month} value={option.month}>{option.label} · {option.relative}</option>)}
        </select></label>
        <div className={`ma-days-status ${billReady ? 'is-ready' : 'is-pending'}`}><span>Bill status</span><b><i />{billReady ? 'Bill Ready' : 'Bill Not Ready'}</b></div>
      </section>

      {error && <div className="ma-alert ma-days-alert" role="alert">{error}</div>}

      <div className="ma-days-download-actions" aria-label="Days download actions">
        <button type="button" className="ma-days-reset" onClick={resetFiltersAndSort}><span>↺</span>Reset sort &amp; filters</button>
        <span className="ma-days-actions-spacer" />
        <button type="button" className="ma-days-export is-excel" disabled={!billReady || loading} onClick={() => exportFile('excel')}><span>▦</span>Download Excel</button>
        <button type="button" className="ma-days-export is-pdf" disabled={!billReady || loading} onClick={() => exportFile('pdf')}><span>▤</span>Download PDF</button>
      </div>

      <section className="ma-days-controls" aria-label="Student list controls">
        <article className="ma-days-control-card ma-days-sort-card">
          <div className="ma-days-control-heading"><span className="ma-days-control-icon">↕</span><div><b>Sort</b><small>First selected sort has priority</small></div>
            <select aria-label="Add sorting priority" value={newSort} onChange={event => addSort(event.target.value)}><option value="">Add sort…</option>{sortOptions.filter(([key]) => !sortKeys.includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          </div>
          <div className="ma-days-sort-order">{sortKeys.map((key, index) => <span className="ma-days-sort-chip" key={key}><b>{index + 1}</b>{sortOptions.find(([value]) => value === key)?.[1]}<button type="button" onClick={() => removeSort(key)} aria-label={`Remove ${sortOptions.find(([value]) => value === key)?.[1]} sort`}>×</button></span>)}</div>
        </article>

        <article className="ma-days-control-card ma-days-filter-card">
          <div className="ma-days-control-heading"><span className="ma-days-control-icon">⏷</span><div><b>Filters</b><small>Apply together to the student list</small></div></div>
          <div className="ma-days-filter-grid">
            <label><span>Hostel</span><select aria-label="Filter by hostel" value={hostelFilter} onChange={event => setHostelFilter(event.target.value)}>{hostels.length > 1 && <option value={allHostels}>All accessible hostels</option>}{hostels.map(hostel => <option key={hostel.id} value={hostel.id}>{hostel.name}</option>)}</select></label>
            <label><span>Department</span><select aria-label="Filter by department" value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}><option value={allHostels}>All departments</option>{departments.map(department => <option key={department} value={department}>{department}</option>)}</select></label>
            <label><span>Year</span><select aria-label="Filter by year" value={yearFilter} onChange={event => setYearFilter(event.target.value)}><option value={allHostels}>All years</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
            <label><span>Fined days</span><select aria-label="Filter by fined days" value={fineFilter} onChange={event => setFineFilter(event.target.value)}>{filterChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Extras</span><select aria-label="Filter by extras" value={extrasFilter} onChange={event => setExtrasFilter(event.target.value)}>{filterChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </article>
      </section>

      <section className="ma-days-list-card" aria-label="Days download students">
        <div className="ma-days-list-heading"><div><span className="ma-eyebrow">STUDENT LIST</span><h2>{hostelLabel} · {monthTitle(month)}</h2></div><span>{sortedRows.length} of {sourceRows.length} students</span></div>
        <div className="ma-days-ledger-note"><i>i</i><span>Fined days and extras are shown as <b>NA</b> because those ledgers are not set up yet. Their NA filters are available now.</span></div>
        <div className="ma-days-table-wrap">
          <table className="ma-days-table"><thead><tr>{tableHeaders.map(header => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>{sortedRows.map(student => <tr key={student.id}>
              <td className="ma-mono">{student.account_number || '—'}</td><td>{student.room || '—'}</td><td className="ma-days-student-name">{student.full_name || '—'}</td><td>{student.hostels?.name || '—'}</td><td>{student.academic_year || '—'}</td><td>{student.department || '—'}</td><td><b>{student.days ?? 0}</b></td><td>{student.finedDays ?? <span className="ma-days-na">NA</span>}</td><td>{student.extrasTotal ?? <span className="ma-days-na">NA</span>}</td>
            </tr>)}</tbody>
          </table>
          {loading && <div className="ma-empty"><span className="ma-spinner" />Loading student days for {monthTitle(month)}…</div>}
          {!loading && !error && sortedRows.length === 0 && <div className="ma-empty">{sourceRows.length ? 'No students match these filters.' : 'No students are assigned to your hostels yet.'}</div>}
        </div>
        <div className="ma-days-list-footer"><span>Sorted by {sortKeys.map(key => sortOptions.find(([value]) => value === key)?.[1]).join(' → ')}</span><span>{billReady ? 'Bill Ready' : 'Downloads locked until the month ends'}</span></div>
      </section>
    </>
  );
}
