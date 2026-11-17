import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import './SuperAdminPage.css';

const paths = {
  overview: '/super-admin', students: '/super-admin/students', history: '/super-admin/history',
  attendance: '/super-admin/attendance', controls: '/super-admin/controls',
};
const pages = {
  overview: ['Overview', 'A clear view of today’s mess operations.'],
  students: ['Students', 'Manage student records, access, and bulk updates.'],
  history: ['Activity history', 'Review and search every administrative change.'],
  attendance: ['Day status', 'Set a student as present or cut on any date.'],
  controls: ['Admin controls', 'Manage lock time, mess closure, notifications, and data.'],
};
const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'MTech 1st Year', 'MTech 2nd Year', 'Guest Lecturer', 'Other'];
const departmentOptions = ['Mech', 'Civil', 'EEE', 'ECE', 'ICE', 'CSE', 'Other'];
const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const foodOptions = ['Chicken', 'Fish', 'Egg', 'Beef', 'Veg only'];
const historyActivityOptions = [
  ['all', 'All activities'], ['student_management', 'Student management'], ['day_status', 'Day status'],
  ['admin_controls', 'Admin controls'], ['notifications', 'Notifications'], ['student_updates', 'Student updates'], ['login', 'Login'],
];
const monthDates = month => {
  const [year, monthNumber] = month.split('-').map(Number);
  const count = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(year, monthNumber - 1, index + 1));
};
const accountNumbersFromInput = value => [...new Set(String(value || '').split(/[\s,;]+/)
  .map(account => account.trim().toUpperCase()).filter(account => /^[A-Z0-9._-]{1,40}$/.test(account)))].slice(0, 100);
const iconPaths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M4.9 9a7.5 7.5 0 0 1 12.3-2L20 12M4 17v-5h5"/><path d="M19.1 15a7.5 7.5 0 0 1-12.3 2L4 12"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.9Z" transform="translate(-1 -1) scale(1.08)"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5m5-5v12"/></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  trash: <><path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
  sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/></>,
  fork: <><path d="M6 3v6m4-6v6a4 4 0 0 1-4 4v8m10-18v18m0-18a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4"/></>,
  coffee: <><path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Zm13 2h2a2 2 0 1 1 0 4h-2M8 3c0 2 2 2 2 4M13 3c0 2 2 2 2 4"/></>,
  lunch: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><path d="M3 4v7m-2-7v4a2 2 0 1 0 4 0V4m-2 7v9m18-16v16m0-16c-2 2-3 5-3 8h3"/></>,
  tea: <><path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Zm12 2h2a2 2 0 1 1 0 4h-2M9 3c0 2 2 2 2 4"/></>,
  dinner: <><path d="M3 17a9 9 0 0 1 18 0H3Zm-1 3h20M12 4V2m-6 5L4 5m14 2 2-2"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5m-5 5V3"/></>,
};

function Icon({ name, size = 19 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name] || iconPaths.grid}</svg>;
}

function currentPathPage() {
  const entry = Object.entries(paths).find(([, pathname]) => pathname === window.location.pathname.replace(/\/$/, ''));
  return entry?.[0] || 'overview';
}

function dateLabel(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(`${date}T00:00:00+05:30`));
}

function dateTimeLabel(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftCalendarDateKey(value, amount) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function studentMealCodeFor(days, value) {
  if (Object.prototype.hasOwnProperty.call(days || {}, value)) return String(days[value] || '----').trim();
  return null;
}

function actionLabel(action) {
  const labels = {
    'auth.login': 'Signed in',
    'student.created': 'Student added', 'student.updated': 'Student profile updated',
    'student.deleted': 'Student removed', 'student.password_reset': 'Password reset',
    'students.bulk_imported': 'Student imported', 'day.status_changed': 'Day status changed',
    'settings.updated': 'Lock settings updated', 'day.mess_closed': 'Mess closed',
    'day.opened': 'Day opened', 'month.deleted': 'Month data deleted',
    'notification.sent': 'Notification sent', 'meal.created': 'Meal entry added',
    'meal.updated': 'Meal selection updated', 'student.food_preference_updated': 'Food preference updated',
  };
  return labels[action] || action?.replaceAll('.', ' ') || 'Activity';
}

const bulkHeaders = ['Sl No', 'Full Name', 'Acc no', 'Admission number', 'Hostel', 'Room number', 'Email ID', 'Mobile number', 'Year', 'Department', 'Guardian name', 'Guardian relation', 'Guardian mobile number', 'Blood group', 'Food preference'];
const bulkFields = ['sl_no', 'full_name', 'account_number', 'admission_number', 'hostel', 'room', 'email', 'mobile_number', 'academic_year', 'department', 'guardian_name', 'guardian_relation', 'guardian_mobile_number', 'blood_group', 'food_preference'];

function parseBulkDelimited(raw, hostels) {
  const lines = raw.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const split = line => {
    const delimiter = line.includes('\t') ? '\t' : ',';
    const cells = []; let value = ''; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === delimiter && !quoted) { cells.push(value.trim()); value = ''; }
      else value += character;
    }
    cells.push(value.trim()); return cells;
  };
  const headerKeys = split(lines[0]).map(value => value.toLowerCase().replace(/\./g, '').trim());
  const expected = bulkHeaders.map(value => value.toLowerCase().replace(/\./g, '').trim());
  if (!expected.every((value, index) => headerKeys[index] === value)) throw new Error('The uploaded list headers do not match the template.');
  return lines.slice(1).map((line, rowIndex) => {
    const cells = split(line);
    const values = Object.fromEntries(bulkFields.map((field, index) => [field, cells[index] || '']));
    const hostel = hostels.find(item => item.name.toLowerCase() === values.hostel.toLowerCase() || item.id === values.hostel);
    return {
      sl_no: values.sl_no, full_name: values.full_name, account_number: values.account_number,
      admission_number: values.admission_number, hostel_id: hostel?.id || '', room: values.room,
      email: values.email, mobile_number: values.mobile_number, academic_year: values.academic_year,
      department: values.department, guardian_name: values.guardian_name, guardian_relation: values.guardian_relation,
      guardian_mobile_number: values.guardian_mobile_number, blood_group: values.blood_group,
      food_preference: values.food_preference, _row: rowIndex + 2,
    };
  }).filter(row => Object.values(row).some(value => String(value || '').trim()));
}

function xmlEscape(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function makeXlsxBlob(rows) {
  const headers = ['Activity', 'User type', 'User', 'Account number', 'Date', 'Details', 'Date and time', 'Action'];
  const columnName = index => {
    let value = index + 1;
    let name = '';
    while (value) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  };
  const excelRows = [headers, ...rows.map(item => {
    const details = item.details || {};
    const humanDetails = details.status
      ? `${details.status === 'cut' ? 'Mess cut' : 'Present'} · ${details.date || ''}`
      : details.title
        ? `${details.title} · ${details.recipients || 0} recipients`
        : details.month
          ? `Month: ${details.month}`
          : Object.entries(details).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ');
    return [
      actionLabel(item.action), item.user_type || details.actor_type || 'admin', item.user_name || details.actor_name || '', details.account_number || '',
      details.date || details.month || '', humanDetails, dateTimeLabel(item.created_at), item.action || '',
    ];
  })];
  const sheetRows = excelRows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowNumber}`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join('');
  const xmlFiles = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Activity Log" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`],
  ];
  const encoder = new TextEncoder();
  const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    return crc >>> 0;
  });
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [path, content] of xmlFiles) {
    const name = encoder.encode(path);
    const bytes = encoder.encode(content);
    const checksum = crc32(bytes);
    const local = new Uint8Array(30 + name.length + bytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, bytes.length, true);
    localView.setUint32(22, bytes.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(bytes, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length;
  }
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, xmlFiles.length, true);
  endView.setUint16(10, xmlFiles.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  const allParts = [...localParts, ...centralParts, end];
  const size = allParts.reduce((total, part) => total + part.length, 0);
  const workbook = new Uint8Array(size);
  let offset = 0;
  for (const part of allParts) { workbook.set(part, offset); offset += part.length; }
  return new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`sa-pill is-${tone}`}><i />{children}</span>;
}

export default function SuperAdminPage() {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [page, setPage] = useState(currentPathPage);
  const [mobileNav, setMobileNav] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordChangeBusy, setPasswordChangeBusy] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('');
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [data, setData] = useState(null);
  const [pageBusy, setPageBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsHostel, setStudentsHostel] = useState('all');
  const [studentsYear, setStudentsYear] = useState('all');
  const [studentsDepartment, setStudentsDepartment] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentDialog, setStudentDialog] = useState(null);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkError, setBulkError] = useState('');
  const [bulkAwaitConfirm, setBulkAwaitConfirm] = useState(false);
  const [studentBusy, setStudentBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyActivityType, setHistoryActivityType] = useState('all');
  const [historyUserType, setHistoryUserType] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyAccountNumbers, setHistoryAccountNumbers] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [historyExportBusy, setHistoryExportBusy] = useState(false);
  const [calendarStudent, setCalendarStudent] = useState(null);
  const [studentCalendarMonth, setStudentCalendarMonth] = useState('');
  const [studentCalendarDays, setStudentCalendarDays] = useState({});
  const [studentCalendarClosedDays, setStudentCalendarClosedDays] = useState({});
  const [studentCalendarBusy, setStudentCalendarBusy] = useState(false);
  const [studentCalendarError, setStudentCalendarError] = useState('');
  const [studentCalendarNotice, setStudentCalendarNotice] = useState('');
  const [studentCalendarSelected, setStudentCalendarSelected] = useState(null);
  const [studentCalendarForm, setStudentCalendarForm] = useState({});
  const [studentCalendarSaveBusy, setStudentCalendarSaveBusy] = useState(false);
  const [dayDate, setDayDate] = useState('');
  const [dayData, setDayData] = useState(null);
  const [daySearch, setDaySearch] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [dayBusy, setDayBusy] = useState(false);
  const [lockTime, setLockTime] = useState('19:00');
  const [lockDays, setLockDays] = useState(1);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [calendarDate, setCalendarDate] = useState('');
  const [currentCalendarStatus, setCurrentCalendarStatus] = useState({ status: 'open', note: '' });
  const [calendarNote, setCalendarNote] = useState('');
  const [closedDaysDialog, setClosedDaysDialog] = useState(false);
  const [closedDaysList, setClosedDaysList] = useState([]);
  const [closedDaysListBusy, setClosedDaysListBusy] = useState(false);
  const [monthToDelete, setMonthToDelete] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationHostel, setNotificationHostel] = useState('all');
  const [notificationYear, setNotificationYear] = useState('all');
  const [notificationBusy, setNotificationBusy] = useState(false);

  const callAdmin = useCallback(async (action, payload = {}) => {
    if (!supabase) throw new Error('Supabase is not configured. Add the public API URL and anon key to client/.env.local.');
    const { data: result, error } = await supabase.functions.invoke('super-admin', { body: { action, ...payload } });
    if (error) {
      let message = error.message || 'Unable to complete the request.';
      try {
        const detail = await error.context?.json();
        if (detail?.error) message = detail.error;
      } catch { /* keep the client error */ }
      throw new Error(message);
    }
    if (result?.error) throw new Error(result.error);
    return result;
  }, []);

  const flash = (kind, message) => setNotice({ kind, message });

  const refreshDashboard = useCallback(async (target = tenantId) => {
    if (!target || !session) return;
    setPageBusy(true);
    try {
      const result = await callAdmin('dashboard', { tenantId: target });
      setData(result);
      setLockTime(String(result.settings?.lock_time || '19:00').slice(0, 5));
      setLockDays(result.settings?.lock_days_before ?? 1);
      setDayDate(current => current || result.today);
      setCalendarDate(current => current || result.today);
      setMonthToDelete(current => current || result.today.slice(0, 7));
    } catch (error) {
      if (error.message.includes('super-admin access')) {
        setAuthError(error.message);
        await supabase?.auth.signOut();
      } else flash('error', error.message);
    } finally {
      setPageBusy(false);
    }
  }, [callAdmin, session, tenantId]);

  useEffect(() => {
    let alive = true;
    if (!supabase) { setSessionReady(true); return undefined; }
    supabase.auth.getSession().then(({ data: result }) => {
      if (!alive) return;
      setSession(result.session);
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) setSession(nextSession);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!session) { setData(null); setTenants([]); setTenantId(''); return undefined; }
    (async () => {
      try {
        const result = await callAdmin('tenants');
        if (!alive) return;
        setTenants(result.tenants || []);
        if (result.tenants?.length) setTenantId(current => current || result.tenants[0].id);
        else flash('error', 'Add a tenant before opening its admin dashboard.');
      } catch (error) {
        if (!alive) return;
        setAuthError(error.message);
        if (error.message.includes('super-admin access')) await supabase?.auth.signOut();
      }
    })();
    return () => { alive = false; };
  }, [callAdmin, session]);

  useEffect(() => {
    if (session && tenantId) refreshDashboard(tenantId);
  }, [session, tenantId, refreshDashboard]);

  useEffect(() => {
    const handlePop = () => setPage(currentPathPage());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    if (!session || !tenantId || page !== 'history') return;
    let active = true;
    setHistoryBusy(true);
    const timeoutId = window.setTimeout(() => {
      callAdmin('history', {
        tenantId, page: historyPage, search: historyQuery, activityType: historyActivityType,
        userType: historyUserType, dateFrom: historyDateFrom, dateTo: historyDateTo,
        accountNumbers: accountNumbersFromInput(historyAccountNumbers),
      })
        .then(result => {
          if (active) {
            setHistory(result.activities || []);
            setHistoryTotal(result.total || 0);
          }
        })
        .catch(error => { if (active) flash('error', error.message); })
        .finally(() => { if (active) setHistoryBusy(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timeoutId); };
  }, [callAdmin, historyActivityType, historyAccountNumbers, historyDateFrom, historyDateTo, historyPage, historyQuery, historyRefreshKey, historyUserType, page, session, tenantId]);

  useEffect(() => {
    if (!session || !tenantId || page !== 'attendance' || !dayDate) return;
    let active = true;
    setDayBusy(true);
    callAdmin('day-status', { tenantId, date: dayDate }).then(result => {
      if (active) setDayData(result);
    }).catch(error => flash('error', error.message)).finally(() => { if (active) setDayBusy(false); });
    return () => { active = false; };
  }, [callAdmin, dayDate, page, session, tenantId]);

  useEffect(() => {
    if (!calendarStudent || !tenantId || !studentCalendarMonth) return;
    let active = true;
    setStudentCalendarBusy(true);
    setStudentCalendarError('');
    callAdmin('student-calendar', { tenantId, studentId: calendarStudent.id, month: studentCalendarMonth })
      .then(result => {
        if (!active) return;
        setStudentCalendarDays(Object.fromEntries((result.meals || []).map(row => [row.meal_date, row.meal_code?.trim() || '----'])));
        setStudentCalendarClosedDays(Object.fromEntries((result.closedDays || []).map(day => [day.calendar_date, day.status])));
      })
      .catch(error => { if (active) setStudentCalendarError(error.message); })
      .finally(() => { if (active) setStudentCalendarBusy(false); });
    return () => { active = false; };
  }, [callAdmin, calendarStudent, studentCalendarMonth, tenantId]);

  useEffect(() => {
    if (!session || !tenantId || page !== 'controls' || !calendarDate) return;
    let active = true;
    callAdmin('calendar-status', { tenantId, date: calendarDate }).then(result => {
      if (active) {
        setCurrentCalendarStatus(result.calendar || { status: 'open', note: '' });
        setCalendarNote(result.calendar?.note || '');
      }
    }).catch(error => flash('error', error.message));
    return () => { active = false; };
  }, [callAdmin, calendarDate, page, session, tenantId]);

  function navigate(nextPage) {
    const nextPath = paths[nextPage] || paths.overview;
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setPage(nextPage);
    setMobileNav(false);
    setNotice(null);
  }

  async function signIn(event) {
    event.preventDefault();
    if (!email.trim() || !password || !supabase) {
      setAuthError(!supabase ? 'Supabase is not configured. Add the API URL and anon key to client/.env.local.' : 'Enter your admin email and password.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setAuthError(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
      else {
        setPassword('');
        try {
          const tenantResult = await callAdmin('tenants');
          const firstTenant = tenantResult.tenants?.[0];
          if (firstTenant) await callAdmin('record-login', { tenantId: firstTenant.id });
        } catch (loginAuditError) {
          console.warn('Unable to record the admin login activity.', loginAuditError);
        }
      }
    } catch (error) {
      setAuthError(error.message || 'Unable to sign in. Try again.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    setAccountMenuOpen(false);
    await supabase?.auth.signOut();
    setData(null);
    setHistory([]);
    setAuthError('');
    setPassword('');
  }

  function openPasswordChange() {
    setAccountMenuOpen(false);
    setOtpSent(false);
    setOtpCode('');
    setNewAdminPassword('');
    setConfirmAdminPassword('');
    setPasswordChangeError('');
    setPasswordChangeMessage('');
    setPasswordDialogOpen(true);
  }

  async function sendPasswordOtp() {
    const accountEmail = session?.user?.email;
    if (!accountEmail || !supabase) {
      setPasswordChangeError('This account does not have a verified email address.');
      return;
    }
    setPasswordChangeBusy(true);
    setPasswordChangeError('');
    setPasswordChangeMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: accountEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setOtpSent(true);
      setPasswordChangeMessage(`A verification code was sent to ${accountEmail}.`);
    } catch (error) {
      setPasswordChangeError(error.message || 'Unable to send the email verification code.');
    } finally {
      setPasswordChangeBusy(false);
    }
  }

  async function updateAdminPassword(event) {
    event.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeMessage('');
    if (!otpSent) {
      setPasswordChangeError('Request an email verification code first.');
      return;
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setPasswordChangeError('Enter the 6-digit code from your email.');
      return;
    }
    if (newAdminPassword.length < 8) {
      setPasswordChangeError('Choose a password with at least 8 characters.');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordChangeError('The new passwords do not match.');
      return;
    }
    setPasswordChangeBusy(true);
    try {
      const { data: verified, error: otpError } = await supabase.auth.verifyOtp({
        email: session.user.email,
        token: otpCode.trim(),
        type: 'email',
      });
      if (otpError) throw otpError;
      if (verified.user?.id !== session.user.id) throw new Error('The code was verified for a different account. Sign in again.');
      const { error } = await supabase.auth.updateUser({ password: newAdminPassword });
      if (error) throw error;
      setOtpCode('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      setOtpSent(false);
      setPasswordChangeMessage('Your password has been changed.');
    } catch (error) {
      setPasswordChangeError(error.message || 'Unable to update the password.');
    } finally {
      setPasswordChangeBusy(false);
    }
  }

  const students = data?.students || [];
  const hostels = data?.hostels || [];
  const years = useMemo(() => [...new Set(students.map(student => student.academic_year).filter(Boolean))].sort(), [students]);
  const departments = useMemo(() => [...new Set(students.map(student => student.department).filter(Boolean))].sort(), [students]);
  const studentCalendarDates = useMemo(() => studentCalendarMonth ? monthDates(studentCalendarMonth) : [], [studentCalendarMonth]);
  const studentCalendarFirstWeekday = studentCalendarDates[0]?.getDay() || 0;
  const filteredStudents = useMemo(() => {
    const query = studentsSearch.trim().toLocaleLowerCase();
    return students.filter(student => {
      const matches = !query || [student.account_number, student.admission_number, student.full_name, student.room, student.department, student.email, student.mobile_number, student.guardian_name, student.guardian_mobile_number]
        .some(value => String(value || '').toLocaleLowerCase().includes(query));
      return matches
        && (studentsHostel === 'all' || student.hostel_id === studentsHostel)
        && (studentsYear === 'all' || student.academic_year === studentsYear)
        && (studentsDepartment === 'all' || student.department === studentsDepartment);
    });
  }, [students, studentsSearch, studentsHostel, studentsYear, studentsDepartment]);
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / 100));
  const historyFirstRow = historyTotal ? (historyPage - 1) * 100 + 1 : 0;
  const historyLastRow = Math.min(historyPage * 100, historyTotal);
  const selectedTenant = tenants.find(item => item.id === tenantId);
  const adminName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Super admin';

  function openNewStudent(student = null) {
    setStudentDialog(student ? {
      id: student.id,
      account_number: student.account_number || '',
      admission_number: student.admission_number || '',
      full_name: student.full_name || '',
      hostel_id: student.hostel_id || '',
      room: student.room || '',
      academic_year: student.academic_year || '',
      department: student.department || '',
      email: student.email || '',
      mobile_number: student.mobile_number || '',
      guardian_name: student.guardian_name || '',
      guardian_relation: student.guardian_relation || '',
      guardian_mobile_number: student.guardian_mobile_number || '',
      blood_group: student.blood_group || '',
      food_preference: student.food_preference || '',
    } : {
      account_number: '', admission_number: '', full_name: '', hostel_id: hostels[0]?.id || '', room: '',
      academic_year: '', department: '', email: '', mobile_number: '', guardian_name: '',
      guardian_relation: '', guardian_mobile_number: '', blood_group: '', food_preference: '',
    });
  }

  function openStudentCalendar(student) {
    setCalendarStudent(student);
    setStudentCalendarMonth(data?.today?.slice(0, 7) || dateKey(new Date()).slice(0, 7));
    setStudentCalendarSelected(null);
    setStudentCalendarNotice('');
    setStudentCalendarError('');
  }

  function moveStudentCalendarMonth(offset) {
    const [year, month] = studentCalendarMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setStudentCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    setStudentCalendarSelected(null);
    setStudentCalendarNotice('');
  }

  function openStudentCalendarDay(date) {
    const key = dateKey(date);
    const code = studentMealCodeFor(studentCalendarDays, key) || '----';
    setStudentCalendarSelected({ date, key });
    setStudentCalendarForm(Object.fromEntries(['b', 'l', 't', 'd'].map((meal, index) => [meal, code[index] === meal.toUpperCase()])));
    setStudentCalendarNotice('');
  }

  async function saveStudentCalendarDay(mealCode) {
    if (!calendarStudent || !studentCalendarSelected || studentCalendarSaveBusy) return;
    if (Object.prototype.hasOwnProperty.call(studentCalendarDays, studentCalendarSelected.key)
      && studentCalendarDays[studentCalendarSelected.key] === mealCode) {
      setStudentCalendarSelected(null);
      return;
    }
    setStudentCalendarSaveBusy(true);
    setStudentCalendarError('');
    try {
      await callAdmin('save-student-meal', {
        tenantId, studentId: calendarStudent.id, date: studentCalendarSelected.key, mealCode,
      });
      setStudentCalendarDays(current => ({ ...current, [studentCalendarSelected.key]: mealCode }));
      setStudentCalendarSelected(null);
      setStudentCalendarNotice(`${dateLabel(studentCalendarSelected.key)} updated.`);
      refreshDashboard(tenantId);
    } catch (error) {
      setStudentCalendarError(error.message);
    } finally {
      setStudentCalendarSaveBusy(false);
    }
  }

  async function saveStudent(event) {
    event.preventDefault();
    if (!studentDialog) return;
    setStudentBusy(true);
    try {
      await callAdmin('save-student', { tenantId, student: studentDialog });
      await refreshDashboard(tenantId);
      setStudentDialog(null);
      flash('success', studentDialog.id ? 'Student profile updated.' : 'Student account created. The admission number is the initial password, or the fallback password if none was provided.');
    } catch (error) { flash('error', error.message); }
    finally { setStudentBusy(false); }
  }

  function toggleStudent(id) {
    setSelectedStudents(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function toggleVisibleStudents() {
    const visible = filteredStudents.map(student => student.id);
    const allSelected = visible.length > 0 && visible.every(id => selectedStudents.includes(id));
    setSelectedStudents(current => allSelected ? current.filter(id => !visible.includes(id)) : [...new Set([...current, ...visible])]);
  }

  async function doReset(ids) {
    setStudentBusy(true);
    try {
      const resetResults = [];
      if (ids.length === 1) {
        const result = await callAdmin('reset-password', { tenantId, studentId: ids[0] });
        resetResults.push(...(result.results || []));
      } else {
        for (let index = 0; index < ids.length; index += 500) {
          const result = await callAdmin('bulk-reset-password', { tenantId, studentIds: ids.slice(index, index + 500) });
          resetResults.push(...(result.results || []));
        }
      }
      const successCount = resetResults.filter(item => item.ok).length;
      const failures = resetResults.filter(item => !item.ok);
      const failedCount = failures.length;
      setSelectedStudents([]);
      await refreshDashboard(tenantId);
      flash(failedCount ? 'error' : 'success', `Password reset for ${successCount} student${successCount === 1 ? '' : 's'}${failedCount ? `; ${failedCount} failed. ${failures[0]?.account_number || ''}: ${failures[0]?.error || 'Reset failed.'}` : ''}`);
    } catch (error) { flash('error', error.message); }
    finally { setStudentBusy(false); setConfirm(null); }
  }

  async function doDeleteStudent(student) {
    setStudentBusy(true);
    try {
      await callAdmin('delete-student', { tenantId, studentId: student.id });
      setSelectedStudents(current => current.filter(id => id !== student.id));
      await refreshDashboard(tenantId);
      flash('success', `${student.full_name} was removed.`);
    } catch (error) { flash('error', error.message); }
    finally { setStudentBusy(false); setConfirm(null); }
  }

  const bulkPreview = bulkRows;
  async function downloadStudentTemplate() {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const sheet = XLSX.utils.aoa_to_sheet([bulkHeaders, Array(bulkHeaders.length).fill('')]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Students');
    XLSX.writeFile(workbook, 'student-profile-template.xlsx');
  }
  async function readBulkFile(file) {
    setBulkError(''); setBulkRows([]); setBulkResult(null);
    try {
      let text;
      if (/\.csv$/i.test(file.name)) text = await file.text();
      else {
        const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false });
        text = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]], { blankrows: false });
      }
      const parsed = parseBulkDelimited(text, hostels);
      if (!parsed.length) throw new Error('The file does not contain any student rows.');
      if (parsed.length > 200) throw new Error('Upload up to 200 student rows at a time.');
      setBulkRows(parsed);
    } catch (error) { setBulkError(error.message || 'Unable to read this file.'); }
  }
  async function importStudents() {
    if (!bulkPreview.length) return;
    setBulkAwaitConfirm(true);
  }
  async function proceedBulkImport() {
    setBulkAwaitConfirm(false); setStudentBusy(true); setBulkResult([]); setBulkProgress(0);
    const results = [];
    for (let index = 0; index < bulkPreview.length; index += 1) {
      const row = bulkPreview[index];
      try {
        const response = await callAdmin('save-student', { tenantId, student: Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_') && key !== 'sl_no')) });
        results.push({ row: row._row || index + 2, full_name: response.student.full_name, account_number: response.student.account_number, hostel: hostels.find(item => item.id === response.student.hostel_id)?.name || '', ok: true });
      } catch (error) {
        results.push({ row: row._row || index + 2, full_name: row.full_name, account_number: row.account_number, hostel: hostels.find(item => item.id === row.hostel_id)?.name || row.hostel || '', ok: false, error: error.message });
      }
      setBulkResult([...results]); setBulkProgress(index + 1);
    }
    try { await refreshDashboard(tenantId); } catch { /* keep import results visible even if the dashboard refresh fails */ }
    setStudentBusy(false);
    const failed = results.filter(row => !row.ok).length;
    flash(failed ? 'error' : 'success', `${results.length - failed} student${results.length - failed === 1 ? '' : 's'} added${failed ? `; ${failed} failed` : ''}.`);
  }

  const dayRows = dayData?.students || [];
  const dayMeals = useMemo(() => Object.fromEntries((dayData?.meals || []).map(item => [item.student_id, item.meal_code?.trim() || '----'])), [dayData]);
  const filteredDayRows = useMemo(() => {
    const query = daySearch.trim().toLowerCase();
    return dayRows.filter(student => {
      const hasMealRecord = Object.prototype.hasOwnProperty.call(dayMeals, student.id);
      const status = !hasMealRecord ? 'no-record' : dayMeals[student.id] === '----' ? 'cut' : 'present';
      return (!query || [student.account_number, student.full_name, student.room, student.department]
        .some(value => String(value || '').toLowerCase().includes(query))) && (dayFilter === 'all' || status === dayFilter);
    });
  }, [dayRows, dayMeals, daySearch, dayFilter]);

  function dayIsLocked(value) {
    if (!value || !data?.settings) return false;
    const [year, month, date] = value.split('-').map(Number);
    const lockDate = new Date(Date.UTC(year, month - 1, date - Number(data.settings.lock_days_before || 0)));
    const lockText = String(data.settings.lock_time || '19:00').slice(0, 5);
    const deadline = new Date(`${lockDate.toISOString().slice(0, 10)}T${lockText}:00+05:30`);
    return Date.now() >= deadline.getTime();
  }

  async function changeDayStatus(studentId, status) {
    setDayBusy(true);
    try {
      await callAdmin('set-day-status', { tenantId, date: dayDate, studentId, status });
      setDayData(current => ({ ...current, meals: [...(current?.meals || []).filter(item => item.student_id !== studentId), { student_id: studentId, meal_code: status === 'cut' ? '----' : 'BLTD' }] }));
      flash('success', 'Day status updated. Admin changes can override the lock time.');
    } catch (error) { flash('error', error.message); }
    finally { setDayBusy(false); }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSettingsBusy(true);
    try {
      await callAdmin('save-settings', { tenantId, lock_time: lockTime, lock_days_before: Number(lockDays) });
      await refreshDashboard(tenantId);
      flash('success', 'Attendance lock settings saved.');
    } catch (error) { flash('error', error.message); }
    finally { setSettingsBusy(false); }
  }

  async function setCalendarStatus(status) {
    setSettingsBusy(true);
    try {
      const result = await callAdmin('set-calendar-day', { tenantId, date: calendarDate, status, note: calendarNote });
      setCurrentCalendarStatus({ status, note: calendarNote });
      await refreshDashboard(tenantId);
      flash('success', status === 'closed'
        ? `${dateLabel(calendarDate)} marked Mess Closed; ${result.affected} student meal entries set to mess cut.`
        : `${dateLabel(calendarDate)} is open for mess service.`);
    } catch (error) { flash('error', error.message); }
    finally { setSettingsBusy(false); }
  }

  async function viewClosedDays() {
    setClosedDaysDialog(true);
    setClosedDaysListBusy(true);
    try {
      const result = await callAdmin('closed-days', { tenantId });
      setClosedDaysList(result.closedDays || []);
    } catch (error) {
      flash('error', error.message);
    } finally {
      setClosedDaysListBusy(false);
    }
  }

  async function downloadActivityLog() {
    setHistoryExportBusy(true);
    try {
      const result = await callAdmin('history-export', {
        tenantId, search: historyQuery, activityType: historyActivityType, userType: historyUserType,
        dateFrom: historyDateFrom, dateTo: historyDateTo,
        accountNumbers: accountNumbersFromInput(historyAccountNumbers),
      });
      const blob = makeXlsxBlob(result.activities || []);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTenant = (selectedTenant?.name || 'mess').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      link.href = downloadUrl;
      link.download = `digimessbook-${safeTenant || 'mess'}-activity-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      flash('success', `Downloaded ${result.activities?.length || 0} filtered activity records.`);
    } catch (error) {
      flash('error', error.message);
    } finally {
      setHistoryExportBusy(false);
    }
  }

  async function deleteSelectedMonth() {
    setSettingsBusy(true);
    try {
      await callAdmin('delete-month', { tenantId, month: monthToDelete });
      await refreshDashboard(tenantId);
      flash('success', `Meal entries for ${monthToDelete} were deleted.`);
    } catch (error) { flash('error', error.message); }
    finally { setSettingsBusy(false); setConfirm(null); }
  }

  async function sendNotification(event) {
    event.preventDefault();
    setNotificationBusy(true);
    try {
      const result = await callAdmin('send-notification', {
        tenantId, title: notificationTitle, message: notificationMessage,
        hostelId: notificationHostel === 'all' ? '' : notificationHostel,
        academicYear: notificationYear === 'all' ? '' : notificationYear,
      });
      setNotificationTitle('');
      setNotificationMessage('');
      await refreshDashboard(tenantId);
      flash('success', `Notification delivered to ${result.recipients} student${result.recipients === 1 ? '' : 's'}.`);
    } catch (error) { flash('error', error.message); }
    finally { setNotificationBusy(false); }
  }

  if (!sessionReady || (session && !data && !authError)) {
    return <div className="sa-gate"><div className="sa-gate-card"><div className="sa-brand-mark"><Icon name="fork" size={24} /></div><span className="sa-loader" /><p>{sessionReady ? 'Loading secure admin workspace…' : 'Checking session…'}</p></div></div>;
  }

  if (!session || !data) {
    return (
      <main className="sa-gate">
        <section className="sa-login-card">
          <a className="sa-login-back" href="/">← DigiMessBook</a>
          <div className="sa-brand-mark"><Icon name="fork" size={25} /></div>
          <span className="sa-eyebrow">SECURE WORKSPACE</span>
          <h1>Super admin</h1>
          <p className="sa-login-subtitle">Sign in with your administrator account to manage the mess.</p>
          <form onSubmit={signIn}>
            <label className="sa-field"><span>Admin email</span><input type="email" autoComplete="username" placeholder="you@institution.edu" value={email} onChange={event => setEmail(event.target.value)} required /></label>
            <label className="sa-field"><span>Password</span><input type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
            {authError && <p className="sa-form-error" role="alert">{authError}</p>}
            <button className="sa-button sa-button-primary sa-login-submit" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'} {!authBusy && <Icon name="arrow" size={17} />}</button>
          </form>
          <div className="sa-login-security"><Icon name="shield" size={17} /><span>Protected by your institution’s admin access</span></div>
        </section>
      </main>
    );
  }

  return (
    <div className={`sa-layout ${mobileNav ? 'is-nav-open' : ''}`}>
      {mobileNav && <button className="sa-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className="sa-sidebar">
        <div className="sa-brand"><span className="sa-brand-mark"><Icon name="fork" size={21} /></span><span>DigiMess<span className="sa-brand-light">Book</span></span><button className="sa-close-nav" onClick={() => setMobileNav(false)} aria-label="Close menu"><Icon name="close" /></button></div>
        <div className="sa-workspace-label">WORKSPACE</div>
        <div className="sa-tenant-select"><span className="sa-tenant-dot" /><select value={tenantId} onChange={event => setTenantId(event.target.value)} aria-label="Select mess group">{tenants.map(tenant => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select><span>⌄</span></div>
        <nav className="sa-nav" aria-label="Admin sections">
          <span className="sa-nav-label">OVERVIEW</span>
          {Object.entries(pages).map(([key, [label]]) => <a key={key} href={paths[key]} className={`sa-nav-link ${page === key ? 'is-active' : ''}`} onClick={event => { event.preventDefault(); navigate(key); }}><Icon name={{ overview: 'grid', students: 'users', history: 'history', attendance: 'calendar', controls: 'settings' }[key]} /><span>{label}</span>{key === 'history' && <i className="sa-nav-count">{data.stats?.changesToday || 0}</i>}</a>)}
        </nav>
        <div className="sa-sidebar-bottom">
          <div className="sa-sidebar-health"><span className="sa-health-indicator"/><span><b>System operational</b><small>Supabase connected</small></span></div>
          <div className="sa-profile-menu-wrap">
            <button type="button" className="sa-admin-profile" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(value => !value)}>
              <span className="sa-avatar">{adminName.slice(0, 1).toUpperCase()}</span>
              <span><b>{adminName}</b><small>Super admin</small></span>
              <Icon name="more" size={20} />
            </button>
            {accountMenuOpen && <div className="sa-account-menu" role="menu" aria-label="Account settings">
              <div className="sa-account-menu-heading"><b>{adminName}</b><small>{session.user.email}</small></div>
              <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setAccountInfoOpen(true); }}><Icon name="user" size={16}/>Account information</button>
              <button type="button" role="menuitem" onClick={openPasswordChange}><Icon name="lock" size={16}/>Change password</button>
              <button type="button" role="menuitem" className="is-logout" onClick={signOut}><Icon name="logout" size={16}/>Sign out</button>
            </div>}
          </div>
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <button className="sa-menu-trigger" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icon name="menu" size={22} /></button>
          <div className="sa-breadcrumb"><span>Admin</span><b>/</b><strong>{pages[page][0]}</strong></div>
          <div className="sa-topbar-right">
            <span className="sa-topbar-date"><Icon name="calendar" size={16} /> {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date())}</span>
            <button className="sa-icon-button sa-refresh" aria-label="Refresh dashboard" title="Refresh" onClick={() => refreshDashboard()} disabled={pageBusy}><span className={pageBusy ? 'sa-spin' : ''}>↻</span></button>
            <span className="sa-topbar-divider" />
            <span className="sa-topbar-user"><span className="sa-avatar">{adminName.slice(0, 1).toUpperCase()}</span><b>{adminName}</b></span>
          </div>
        </header>

        <main className="sa-content">
          {notice && <div className={`sa-toast is-${notice.kind}`} role="status"><span className="sa-toast-icon"><Icon name={notice.kind === 'success' ? 'check' : 'alert'} size={17} /></span><span>{notice.message}</span><button onClick={() => setNotice(null)} aria-label="Dismiss notification"><Icon name="close" size={16} /></button></div>}
          {page === 'overview' && <>
            <div className="sa-page-heading sa-overview-heading"><div><span className="sa-eyebrow">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date()).toUpperCase()}</span><h1>{(() => { const hour = Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date())); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; })()}, {adminName.split(/[ .@]/)[0]} <span>✦</span></h1><p>Here’s what’s happening across {selectedTenant?.name || 'your mess'} today.</p></div><button className="sa-button sa-button-primary" onClick={() => openNewStudent()}><Icon name="plus" size={18} /> Add student</button></div>
            <section className="sa-stat-grid" aria-label="Mess overview statistics">
              <article className="sa-stat-card"><div className="sa-stat-top"><span>Total students</span><span className="sa-stat-icon is-green"><Icon name="users" /></span></div><strong>{data.stats?.students ?? '—'}</strong><small>Across {data.stats?.hostels ?? 0} hostels</small><span className="sa-stat-spark is-green">↗</span></article>
              <article className="sa-stat-card"><div className="sa-stat-top"><span>Present today</span><span className="sa-stat-icon is-blue"><Icon name="fork" /></span></div><strong>{data.stats?.presentToday ?? '—'}</strong><small>Meal entries for today</small><span className="sa-stat-spark is-blue">✓</span></article>
              <article className="sa-stat-card"><div className="sa-stat-top"><span>Mess cuts this week</span><span className="sa-stat-icon is-amber"><Icon name="calendar" /></span></div><strong>{data.stats?.cutThisWeek ?? '—'}</strong><small>Cut entries in the last 7 days</small><span className="sa-stat-spark is-amber">−</span></article>
              <article className="sa-stat-card"><div className="sa-stat-top"><span>Changes today</span><span className="sa-stat-icon is-violet"><Icon name="history" /></span></div><strong>{data.stats?.changesToday ?? '—'}</strong><small>Actions recorded in the audit log</small><span className="sa-stat-spark is-violet">↻</span></article>
            </section>

            <section className="sa-overview-grid">
              <article className="sa-card sa-attendance-card">
                <div className="sa-card-heading"><div><h2>Meal attendance</h2><p>Student meal entries over the last 7 days</p></div><StatusPill tone="green">Live data</StatusPill></div>
                <div className="sa-chart-legend"><span><i className="is-present"/>Present</span><span><i className="is-cut"/>Cut</span></div>
                <div className="sa-bar-chart" role="img" aria-label="Present and mess cut entries for each day in the last seven days">
                  {(data.week || []).map(day => {
                    const max = Math.max(1, ...data.week.map(item => item.present + item.cut));
                    const total = day.present + day.cut;
                    const presentHeight = total ? day.present / max * 100 : 0;
                    const cutHeight = total ? day.cut / max * 100 : 0;
                    return <div className="sa-chart-column" key={day.date}><div className="sa-chart-bars"><span className="sa-bar is-present" style={{ height: `${presentHeight}%` }} title={`${day.present} present`} /><span className="sa-bar is-cut" style={{ height: `${cutHeight}%` }} title={`${day.cut} cuts`} /></div><span className="sa-chart-label">{day.label}</span></div>;
                  })}
                </div>
                <div className="sa-chart-axis"><span>Last seven days</span><b>Local timezone · IST</b></div>
              </article>
              <article className="sa-card sa-quick-card">
                <div className="sa-card-heading"><div><h2>Quick actions</h2><p>Common admin tasks, one click away</p></div><span className="sa-sparkle"><Icon name="sparkle" /></span></div>
                <div className="sa-quick-actions">
                  <button onClick={() => openNewStudent()}><span className="sa-quick-icon is-green"><Icon name="plus" /></span><span><b>Add a student</b><small>Create an individual account</small></span><Icon name="arrow" size={16} /></button>
                  <button onClick={() => { setBulkResult(null); setBulkDialog(true); }}><span className="sa-quick-icon is-blue"><Icon name="upload" /></span><span><b>Import students</b><small>Paste rows from a spreadsheet</small></span><Icon name="arrow" size={16} /></button>
                  <button onClick={() => navigate('attendance')}><span className="sa-quick-icon is-amber"><Icon name="calendar" /></span><span><b>Change day status</b><small>Override a student’s attendance</small></span><Icon name="arrow" size={16} /></button>
                  <button onClick={() => navigate('controls')}><span className="sa-quick-icon is-violet"><Icon name="bell" /></span><span><b>Send notification</b><small>Reach a hostel or year group</small></span><Icon name="arrow" size={16} /></button>
                </div>
              </article>
            </section>

            <section className="sa-card sa-activity-card">
              <div className="sa-card-heading"><div><h2>Recent activity</h2><p>Latest changes made by admins and students</p></div><button className="sa-link-button" onClick={() => navigate('history')}>View all activity <Icon name="arrow" size={16} /></button></div>
              <ActivityTable items={data.activities || []} compact />
            </section>
            <div className="sa-footer-note"><span className="sa-health-indicator"/> Admin actions are protected and recorded in the audit history.</div>
          </>}

          {page === 'students' && <>
            <div className="sa-page-heading"><div><span className="sa-eyebrow">DIRECTORY</span><h1>Student management</h1><p>Search, filter, and manage student access in one place.</p></div><div className="sa-heading-actions"><button className="sa-button sa-button-secondary" onClick={downloadStudentTemplate}><Icon name="download" size={17} /> Download template</button><button className="sa-button sa-button-secondary" onClick={() => { setBulkResult(null); setBulkRows([]); setBulkProgress(0); setBulkError(''); setBulkAwaitConfirm(false); setBulkDialog(true); }}><Icon name="upload" size={17} /> Bulk import</button><button className="sa-button sa-button-primary" onClick={() => openNewStudent()}><Icon name="plus" size={18} /> Add student</button></div></div>
            <section className="sa-card sa-students-card">
              <div className="sa-student-filters">
                <label className="sa-search-box"><Icon name="search" size={18}/><input type="search" value={studentsSearch} onChange={event => setStudentsSearch(event.target.value)} placeholder="Search name, account no, room…" /></label>
                <select aria-label="Filter by hostel" value={studentsHostel} onChange={event => setStudentsHostel(event.target.value)}><option value="all">All hostels</option>{hostels.map(hostel => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}</select>
                <select aria-label="Filter by year" value={studentsYear} onChange={event => setStudentsYear(event.target.value)}><option value="all">All years</option>{years.map(year => <option key={year}>{year}</option>)}</select>
                <select aria-label="Filter by department" value={studentsDepartment} onChange={event => setStudentsDepartment(event.target.value)}><option value="all">All departments</option>{departments.map(department => <option key={department}>{department}</option>)}</select>
              </div>
              {selectedStudents.length > 0 && <div className="sa-bulk-toolbar"><span><b>{selectedStudents.length}</b> selected</span><button className="sa-button sa-button-soft" onClick={() => setConfirm({ title: 'Reset student passwords?', message: `Set each selected student's password to their admission number. Students without an admission number will use the fallback password Mess@2026!. No email will be sent.`, confirmText: 'Reset passwords', run: () => doReset(selectedStudents) })}><Icon name="lock" size={16}/> Reset passwords</button><button className="sa-text-button" onClick={() => setSelectedStudents([])}>Clear selection</button></div>}
              <div className="sa-table-wrap"><table className="sa-table"><thead><tr><th><input type="checkbox" aria-label="Select all visible students" checked={filteredStudents.length > 0 && filteredStudents.every(student => selectedStudents.includes(student.id))} onChange={toggleVisibleStudents}/></th><th>Student</th><th>Account no.</th><th>Hostel / room</th><th>Year</th><th>Department</th><th>Actions</th></tr></thead><tbody>
                {filteredStudents.map(student => <tr key={student.id}><td><input type="checkbox" aria-label={`Select ${student.full_name}`} checked={selectedStudents.includes(student.id)} onChange={() => toggleStudent(student.id)}/></td><td><div className="sa-student-cell"><span className="sa-student-avatar">{student.full_name?.slice(0, 1).toUpperCase()}</span><span><b>{student.full_name}</b><small>{student.food_preference || 'No food preference'}</small></span></div></td><td><span className="sa-mono">{student.account_number}</span></td><td><b>{student.hostels?.name || '—'}</b><small className="sa-secondary-line">Room {student.room || '—'}</small></td><td>{student.academic_year || '—'}</td><td>{student.department || '—'}</td><td><div className="sa-row-actions"><button title="Edit student" aria-label={`Edit ${student.full_name}`} onClick={() => openNewStudent(student)}><Icon name="edit" size={17}/></button><button title="Open student calendar" aria-label={`Open ${student.full_name}'s meal calendar`} onClick={() => openStudentCalendar(student)}><Icon name="calendar" size={16}/></button><button title="Reset password" aria-label={`Reset ${student.full_name}'s password`} onClick={() => setConfirm({ title: 'Reset this password?', message: `Set ${student.full_name} (${student.account_number})'s password to their admission number${String(student.admission_number || '').trim() ? '' : ', or to the fallback password Mess@2026! because no admission number is on file'}. No email will be sent.`, confirmText: 'Reset password', run: () => doReset([student.id]) })}><Icon name="lock" size={16}/></button><button title="Delete student" aria-label={`Delete ${student.full_name}`} className="is-danger" onClick={() => setConfirm({ title: 'Delete this student?', message: `This removes ${student.full_name} and their login, meal entries, and notifications. The admin audit history is retained.`, confirmText: 'Delete student', danger: true, run: () => doDeleteStudent(student) })}><Icon name="trash" size={16}/></button></div></td></tr>)}
              </tbody></table>{filteredStudents.length === 0 && <EmptyState title="No students found" body="Try a different search term or filter."/>}</div>
              <div className="sa-table-footer"><span>Showing <b>{filteredStudents.length}</b> of {students.length} students</span><button className="sa-link-button" onClick={() => navigate('history')}>View student history <Icon name="arrow" size={15}/></button></div>
            </section>
          </>}

          {page === 'history' && <>
            <div className="sa-page-heading"><div><span className="sa-eyebrow">AUDIT LOG</span><h1>Activity history</h1><p>Find admin and student actions by user, activity, account number, or date.</p></div><StatusPill tone="green">{historyTotal} records</StatusPill></div>
            <section className="sa-card sa-history-card">
              <div className="sa-history-toolbar"><label className="sa-search-box"><Icon name="search" size={18}/><input type="search" value={historyQuery} onChange={event => { setHistoryQuery(event.target.value); setHistoryPage(1); }} placeholder="Search user, account no, date, or activity…" /></label><div className="sa-history-actions"><button className="sa-button sa-button-secondary" onClick={() => setHistoryRefreshKey(value => value + 1)} disabled={historyBusy}><Icon name="refresh" size={16}/> Refresh log</button><button className="sa-button sa-button-primary" onClick={downloadActivityLog} disabled={historyExportBusy}><Icon name="download" size={16}/>{historyExportBusy ? 'Preparing Excel…' : 'Download Log'}</button></div></div>
              <div className="sa-history-filter-row">
                <label className="sa-field"><span>Activity type</span><select value={historyActivityType} onChange={event => { setHistoryActivityType(event.target.value); setHistoryPage(1); }}>{historyActivityOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className="sa-field"><span>User type</span><select value={historyUserType} onChange={event => { setHistoryUserType(event.target.value); setHistoryPage(1); }}><option value="all">All users</option><option value="admin">Admin</option><option value="student">Student</option></select></label>
                <label className="sa-field"><span>From date</span><input type="date" max={historyDateTo || undefined} value={historyDateFrom} onChange={event => { setHistoryDateFrom(event.target.value); setHistoryPage(1); }} /></label>
                <label className="sa-field"><span>To date</span><input type="date" min={historyDateFrom || undefined} value={historyDateTo} onChange={event => { setHistoryDateTo(event.target.value); setHistoryPage(1); }} /></label>
                <label className="sa-field sa-history-accounts"><span>Account numbers <small>Multiple values: comma, space, or new line</small></span><input type="text" value={historyAccountNumbers} onChange={event => { setHistoryAccountNumbers(event.target.value); setHistoryPage(1); }} placeholder="6703, 6704, 24B006" /></label>
                <button type="button" className="sa-text-button sa-history-clear" onClick={() => { setHistoryQuery(''); setHistoryActivityType('all'); setHistoryUserType('all'); setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryAccountNumbers(''); setHistoryPage(1); }}>Clear filters</button>
              </div>
              {historyBusy ? <div className="sa-loading-row"><span className="sa-loader"/> Loading audit history…</div> : <ActivityTable items={history} />}
              {!historyBusy && <div className="sa-history-footer"><span>Showing <b>{historyFirstRow}–{historyLastRow}</b> of <b>{historyTotal}</b> entries · 100 per page</span><div className="sa-pagination"><button className="sa-button sa-button-secondary" onClick={() => setHistoryPage(value => Math.max(1, value - 1))} disabled={historyBusy || historyPage <= 1}>Previous</button><span>Page <b>{historyPage}</b> of <b>{historyPageCount}</b></span><button className="sa-button sa-button-secondary" onClick={() => setHistoryPage(value => Math.min(historyPageCount, value + 1))} disabled={historyBusy || historyPage >= historyPageCount}>Next</button></div></div>}
            </section>
          </>}

          {page === 'attendance' && <>
            <div className="sa-page-heading"><div><span className="sa-eyebrow">ATTENDANCE OVERRIDE</span><h1>Change day status</h1><p>Set a student to present or cut for any date, whether locked or open.</p></div><StatusPill tone={dayIsLocked(dayDate) ? 'amber' : 'green'}>{dayIsLocked(dayDate) ? 'Date is locked' : 'Date is open'}</StatusPill></div>
            <section className="sa-card sa-day-filter-card"><div className="sa-day-filter-row"><label className="sa-field sa-date-field"><span>Attendance date</span><input type="date" value={dayDate} onChange={event => setDayDate(event.target.value)}/></label><label className="sa-search-box"><Icon name="search" size={18}/><input type="search" value={daySearch} onChange={event => setDaySearch(event.target.value)} placeholder="Find a student…"/></label><label className="sa-field sa-filter-field"><span>Current status</span><select value={dayFilter} onChange={event => setDayFilter(event.target.value)}><option value="all">All students</option><option value="present">Present</option><option value="cut">Mess cut</option><option value="no-record">No meal record</option></select></label></div>
              {dayData?.calendar?.status === 'closed' && <div className="sa-inline-alert"><Icon name="alert" size={17}/><span><b>Mess Closed</b> is set for this day. You can still override individual student statuses.</span></div>}
              <div className="sa-day-summary"><div><span className="sa-day-summary-icon"><Icon name="calendar"/></span><span><b>{dateLabel(dayDate)}</b><small>{filteredDayRows.length} students shown · {dayRows.length} total</small></span></div><span className="sa-override-note"><Icon name="shield" size={16}/> Admin override available</span></div>
              <div className="sa-table-wrap"><table className="sa-table sa-day-table"><thead><tr><th>Student</th><th>Account / room</th><th>Hostel</th><th>Current status</th><th>Set status</th></tr></thead><tbody>{filteredDayRows.map(student => { const hasMealRecord = Object.prototype.hasOwnProperty.call(dayMeals, student.id); const cut = hasMealRecord && dayMeals[student.id] === '----'; const present = hasMealRecord && !cut; return <tr key={student.id}><td><div className="sa-student-cell"><span className="sa-student-avatar">{student.full_name?.slice(0, 1).toUpperCase()}</span><span><b>{student.full_name}</b><small>{student.department || 'Department not set'}</small></span></div></td><td><span className="sa-mono">{student.account_number}</span><small className="sa-secondary-line">Room {student.room || '—'}</small></td><td>{student.hostels?.name || '—'}</td><td><StatusPill tone={cut ? 'amber' : present ? 'green' : 'neutral'}>{cut ? 'Mess cut' : present ? 'Present' : 'No meal record'}</StatusPill></td><td><div className="sa-status-actions"><button disabled={dayBusy || present} className={`sa-status-button ${present ? 'is-current' : ''}`} onClick={() => changeDayStatus(student.id, 'present')}><Icon name="check" size={15}/> Present</button><button disabled={dayBusy || cut} className={`sa-status-button is-cut ${cut ? 'is-current' : ''}`} onClick={() => changeDayStatus(student.id, 'cut')}><Icon name="close" size={15}/> Cut</button></div></td></tr>; })}</tbody></table>
                {dayBusy && !dayData && <div className="sa-loading-row"><span className="sa-loader"/> Loading students…</div>}
                {!dayBusy && filteredDayRows.length === 0 && <EmptyState title="No students found" body="Try a different search or filter."/>}
              </div>
              <div className="sa-override-footnote"><Icon name="info" size={15}/> Changes made here override the regular student lock deadline and are added to activity history.</div>
            </section>
          </>}

          {page === 'controls' && <>
            <div className="sa-page-heading"><div><span className="sa-eyebrow">MESS OPERATIONS</span><h1>Admin controls</h1><p>Adjust attendance rules, service dates, and student communications.</p></div></div>
            <div className="sa-controls-grid">
              <section className="sa-card sa-control-card"><div className="sa-control-title"><span className="sa-control-icon is-blue"><Icon name="clock"/></span><div><h2>Attendance lock time</h2><p>Set when students can no longer edit meal entries.</p></div></div>
                <form className="sa-settings-form" onSubmit={saveSettings}><label className="sa-field"><span>Lock time (IST)</span><input type="time" value={lockTime} onChange={event => setLockTime(event.target.value)} required/></label><label className="sa-field"><span>Days before meal date</span><select value={lockDays} onChange={event => setLockDays(event.target.value)}><option value={0}>Same day</option><option value={1}>1 day before</option><option value={2}>2 days before</option><option value={3}>3 days before</option><option value={4}>4 days before</option><option value={5}>5 days before</option><option value={6}>6 days before</option><option value={7}>7 days before</option></select></label><div className="sa-setting-hint"><Icon name="info" size={15}/> Students can edit until {lockDays || 0} day{Number(lockDays) === 1 ? '' : 's'} before, at {lockTime} IST.</div><button className="sa-button sa-button-primary" disabled={settingsBusy}>{settingsBusy ? 'Saving…' : 'Save lock settings'}</button></form>
              </section>

              <section className="sa-card sa-control-card"><div className="sa-control-title"><span className="sa-control-icon is-amber"><Icon name="calendar"/></span><div><h2>Mess calendar</h2><p>Close service for a date or reopen it.</p></div></div><div className="sa-settings-form"><label className="sa-field"><span>Service date</span><input type="date" value={calendarDate} onChange={event => setCalendarDate(event.target.value)}/></label><label className="sa-field"><span>Note <small>(optional)</small></span><input value={calendarNote} onChange={event => setCalendarNote(event.target.value)} placeholder="e.g. Festival holiday" maxLength={250}/></label><div className="sa-calendar-current">Current setting: <StatusPill tone={currentCalendarStatus.status === 'closed' ? 'amber' : 'green'}>{currentCalendarStatus.status === 'closed' ? 'Mess Closed' : 'Open'}</StatusPill>{currentCalendarStatus.note && <small>{currentCalendarStatus.note}</small>}</div><div className="sa-inline-actions"><button className="sa-button sa-button-warm" disabled={settingsBusy} onClick={() => setCalendarStatus('closed')}><Icon name="close" size={16}/> Mark Mess Closed</button><button className="sa-button sa-button-secondary" disabled={settingsBusy} onClick={() => setCalendarStatus('open')}>Reopen date</button><button className="sa-button sa-button-secondary" onClick={viewClosedDays}><Icon name="history" size={15}/> View closed days</button></div></div></section>

              <section className="sa-card sa-control-card sa-notification-card"><div className="sa-control-title"><span className="sa-control-icon is-violet"><Icon name="bell"/></span><div><h2>Send a notification</h2><p>Deliver a message to students in the selected group.</p></div></div><form className="sa-settings-form" onSubmit={sendNotification}><label className="sa-field"><span>Audience</span><div className="sa-audience-fields"><select aria-label="Notification hostel" value={notificationHostel} onChange={event => setNotificationHostel(event.target.value)}><option value="all">All hostels</option>{hostels.map(hostel => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}</select><select aria-label="Notification year" value={notificationYear} onChange={event => setNotificationYear(event.target.value)}><option value="all">All years</option>{years.map(year => <option key={year}>{year}</option>)}</select></div></label><label className="sa-field"><span>Title</span><input value={notificationTitle} onChange={event => setNotificationTitle(event.target.value)} maxLength={120} placeholder="Important mess update" required/></label><label className="sa-field"><span>Message</span><textarea value={notificationMessage} onChange={event => setNotificationMessage(event.target.value)} maxLength={2000} rows={4} placeholder="Write your message to students…" required/></label><div className="sa-notice-preview">This message will reach approximately <b>{students.filter(student => (notificationHostel === 'all' || student.hostel_id === notificationHostel) && (notificationYear === 'all' || student.academic_year === notificationYear)).length}</b> student{students.length === 1 ? '' : 's'}.</div><button className="sa-button sa-button-primary" disabled={notificationBusy}><Icon name="arrow" size={16}/>{notificationBusy ? 'Sending…' : 'Send notification'}</button></form></section>

              <section className="sa-card sa-control-card sa-danger-card"><div className="sa-control-title"><span className="sa-control-icon is-red"><Icon name="trash"/></span><div><h2>Clean up meal data</h2><p>Permanently remove meal entries for one month.</p></div></div><div className="sa-settings-form"><label className="sa-field"><span>Month to delete</span><input type="month" value={monthToDelete} onChange={event => setMonthToDelete(event.target.value)} required/></label><div className="sa-danger-warning"><Icon name="alert" size={17}/><span>This deletes meal-day entries for <b>all students</b> in this month. Student accounts and activity history stay intact.</span></div><button className="sa-button sa-button-danger" disabled={settingsBusy || !monthToDelete} onClick={() => setConfirm({ title: `Delete ${monthToDelete} meal data?`, message: 'Meal entries for every student in this month will be permanently removed. This action cannot be undone.', confirmText: 'Delete month data', danger: true, run: deleteSelectedMonth })}><Icon name="trash" size={16}/> Delete month</button></div></section>
            </div>
          </>}
          <footer className="sa-page-footer"><span>© 2026 DigiMessBook</span><span>Admin actions are protected and logged.</span></footer>
        </main>
      </div>

      {studentDialog && (
        <div className="sa-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setStudentDialog(null); }}>
          <section className="sa-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
            <div className="sa-modal-heading">
              <span className="sa-control-icon is-green"><Icon name={studentDialog.id ? 'edit' : 'plus'} /></span>
              <div><h2 id="student-modal-title">{studentDialog.id ? 'Edit student' : 'Add a student'}</h2><p>{studentDialog.id ? 'Update this student’s profile details.' : 'Create an account for a new mess member.'}</p></div>
              <button className="sa-modal-close" onClick={() => setStudentDialog(null)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <form className="sa-modal-form" onSubmit={saveStudent}>
              <label className="sa-field">
                <span>Student name</span>
                <input required autoFocus value={studentDialog.full_name} onChange={event => setStudentDialog({ ...studentDialog, full_name: event.target.value })} placeholder="Full name" />
              </label>
              <div className="sa-form-three">
                <label className="sa-field"><span>Account number</span><input required value={studentDialog.account_number} onChange={event => setStudentDialog({ ...studentDialog, account_number: event.target.value.toUpperCase() })} placeholder="e.g. 6703" /></label>
                <label className="sa-field"><span>Admission number</span><input value={studentDialog.admission_number} onChange={event => setStudentDialog({ ...studentDialog, admission_number: event.target.value.toUpperCase() })} placeholder="e.g. 24B015" /></label>
                <label className="sa-field"><span>Hostel</span><select required value={studentDialog.hostel_id} onChange={event => setStudentDialog({ ...studentDialog, hostel_id: event.target.value })}><option value="">Select hostel</option>{hostels.map(hostel => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}</select></label>
              </div>
              <div className="sa-form-three">
                <label className="sa-field"><span>Room number</span><input value={studentDialog.room} onChange={event => setStudentDialog({ ...studentDialog, room: event.target.value })} placeholder="Room no." /></label>
                <label className="sa-field"><span>Year</span><select value={studentDialog.academic_year} onChange={event => setStudentDialog({ ...studentDialog, academic_year: event.target.value })}><option value="">Select year</option>{studentDialog.academic_year && !yearOptions.includes(studentDialog.academic_year) && <option value={studentDialog.academic_year}>{studentDialog.academic_year}</option>}{yearOptions.map(option => <option key={option}>{option}</option>)}</select></label>
                <label className="sa-field"><span>Department</span><select value={studentDialog.department} onChange={event => setStudentDialog({ ...studentDialog, department: event.target.value })}><option value="">Select department</option>{studentDialog.department && !departmentOptions.includes(studentDialog.department) && <option value={studentDialog.department}>{studentDialog.department}</option>}{departmentOptions.map(option => <option key={option}>{option}</option>)}</select></label>
              </div>
              <div className="sa-form-three">
                <label className="sa-field"><span>Email ID</span><input type="email" autoComplete="email" value={studentDialog.email} onChange={event => setStudentDialog({ ...studentDialog, email: event.target.value })} placeholder="student@example.com" /></label>
                <label className="sa-field"><span>Mobile number</span><input type="tel" autoComplete="tel" value={studentDialog.mobile_number} onChange={event => setStudentDialog({ ...studentDialog, mobile_number: event.target.value })} placeholder="Mobile number" /></label>
                <label className="sa-field"><span>Blood group</span><select value={studentDialog.blood_group} onChange={event => setStudentDialog({ ...studentDialog, blood_group: event.target.value })}><option value="">Select group</option>{studentDialog.blood_group && !bloodGroupOptions.includes(studentDialog.blood_group) && <option value={studentDialog.blood_group}>{studentDialog.blood_group}</option>}{bloodGroupOptions.map(option => <option key={option}>{option}</option>)}</select></label>
              </div>
              <div className="sa-form-three">
                <label className="sa-field"><span>Guardian name</span><input value={studentDialog.guardian_name} onChange={event => setStudentDialog({ ...studentDialog, guardian_name: event.target.value })} placeholder="Full name" /></label>
                <label className="sa-field"><span>Guardian relation</span><input value={studentDialog.guardian_relation} onChange={event => setStudentDialog({ ...studentDialog, guardian_relation: event.target.value })} placeholder="e.g. Parent" /></label>
                <label className="sa-field"><span>Guardian Mob No</span><input type="tel" value={studentDialog.guardian_mobile_number} onChange={event => setStudentDialog({ ...studentDialog, guardian_mobile_number: event.target.value })} placeholder="Mobile number" /></label>
              </div>
              <fieldset className="sa-field sa-food-field">
                <legend>Food preference <small>Select all that apply; Veg only is exclusive.</small></legend>
                <div className="sa-food-preferences">{foodOptions.map(option => { const selected = String(studentDialog.food_preference || '').split(',').map(value => value.trim()).includes(option); return <label className={`sa-food-choice ${selected ? 'is-selected' : ''}`} key={option}><input type="checkbox" checked={selected} onChange={event => { const current = String(studentDialog.food_preference || '').split(',').map(value => value.trim()).filter(Boolean); const next = event.target.checked ? option === 'Veg only' ? ['Veg only'] : [...current.filter(value => value !== 'Veg only'), option] : current.filter(value => value !== option); setStudentDialog({ ...studentDialog, food_preference: foodOptions.filter(value => next.includes(value)).join(', ') }); }} /><span>{option}</span></label>; })}</div>
              </fieldset>
              {!studentDialog.id && <div className="sa-modal-hint"><Icon name="lock" size={16} /> Initial password is the admission number, or Mess@2026! if none is provided.</div>}
              <div className="sa-modal-actions"><button type="button" className="sa-button sa-button-secondary" onClick={() => setStudentDialog(null)}>Cancel</button><button className="sa-button sa-button-primary" disabled={studentBusy}>{studentBusy ? 'Saving…' : studentDialog.id ? 'Save changes' : 'Create student'}</button></div>
            </form>
          </section>
        </div>
      )}

      {calendarStudent && <div className="sa-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !studentCalendarSaveBusy) { setCalendarStudent(null); setStudentCalendarSelected(null); } }}><section className="sa-modal sa-student-calendar-modal" role="dialog" aria-modal="true" aria-labelledby="student-calendar-title"><div className="sa-modal-heading"><span className="sa-control-icon is-green"><Icon name="calendar"/></span><div><h2 id="student-calendar-title">Meal calendar</h2><p>{calendarStudent.full_name} · {calendarStudent.account_number}</p></div><button className="sa-modal-close" disabled={studentCalendarSaveBusy} onClick={() => { setCalendarStudent(null); setStudentCalendarSelected(null); }} aria-label="Close student calendar"><Icon name="close"/></button></div><div className="sa-student-calendar-month"><button type="button" aria-label="Previous month" onClick={() => moveStudentCalendarMonth(-1)}>‹</button><b>{studentCalendarDates[0] ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(studentCalendarDates[0]) : studentCalendarMonth}</b><button type="button" aria-label="Next month" onClick={() => moveStudentCalendarMonth(1)}>›</button></div>{studentCalendarNotice && <div className="sa-student-calendar-notice" role="status">{studentCalendarNotice}</div>}{studentCalendarError && <p className="sa-form-error" role="alert">{studentCalendarError}</p>}{studentCalendarBusy ? <div className="sa-loading-row"><span className="sa-loader"/> Loading meal days…</div> : <><div className="calendar-weekdays sa-admin-calendar-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-days sa-admin-calendar-days">{Array(studentCalendarFirstWeekday).fill(0).map((_, index) => <span className="calendar-empty" key={`calendar-empty-${index}`}/>)}{studentCalendarDates.map(date => { const key = dateKey(date); const code = studentMealCodeFor(studentCalendarDays, key); const cut = code === '----'; const previousCut = studentMealCodeFor(studentCalendarDays, shiftCalendarDateKey(key, -1)) === '----'; const nextCut = studentMealCodeFor(studentCalendarDays, shiftCalendarDateKey(key, 1)) === '----'; const adjacentCut = cut && (previousCut || nextCut); const dotColor = code === null ? '#cbd5ce' : cut ? adjacentCut ? '#d22' : '#f1ca28' : '#4caf50'; const isToday = key === data?.today; const isClosed = studentCalendarClosedDays[key] === 'closed'; return <button type="button" key={key} className={`day ${isToday ? 'is-today' : ''} ${studentCalendarSelected?.key === key ? 'is-selected' : ''} ${isClosed ? 'sa-admin-closed-day' : ''}`} disabled={studentCalendarBusy || studentCalendarSaveBusy} aria-label={`${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${isClosed ? ', mess closed' : ''}`} onClick={() => openStudentCalendarDay(date)}><span>{date.getDate()}</span><i className="day-dot" style={{ background: dotColor }}/></button>; })}</div><div className="calendar-legend sa-admin-calendar-legend"><span><i className="legend-dot present"/>Meals selected</span><span><i className="legend-dot single-cut"/>Single mess cut</span><span><i className="legend-dot adjacent-cut"/>Adjacent mess cuts</span><span><i className="legend-dot no-data"/>No meal data</span><span><i className="sa-admin-closed-dot"/>Mess Closed</span></div><div className="sa-student-calendar-note"><Icon name="shield" size={15}/> Admin can edit every date, including locked and Mess Closed days.</div></> }<div className="sa-modal-actions"><button type="button" className="sa-button sa-button-secondary" onClick={() => { setCalendarStudent(null); setStudentCalendarSelected(null); }}>Close calendar</button></div></section></div>}

      {calendarStudent && studentCalendarSelected && <div className="sa-modal-overlay sa-student-day-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !studentCalendarSaveBusy) setStudentCalendarSelected(null); }}><section className="modal-card day-modal sa-admin-day-modal" role="dialog" aria-modal="true" aria-labelledby="student-day-title"><div className="sheet-handle"/><header className="modal-header"><span className="section-icon"><Icon name="calendar"/></span><div><span className="eyebrow">MEAL SELECTION · ADMIN OVERRIDE</span><h2 id="student-day-title">{studentCalendarSelected.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h2></div><button type="button" className="icon-button modal-close" aria-label="Close day details" disabled={studentCalendarSaveBusy} onClick={() => setStudentCalendarSelected(null)}><Icon name="close"/></button></header><h3 className="modal-section-title">Select Meals</h3><div className="meal-options">{[['b', 'Breakfast', 'coffee'], ['l', 'Lunch', 'lunch'], ['t', 'Evening Tea', 'tea'], ['d', 'Dinner', 'dinner']].map(([key, label, icon]) => <label className="meal-option" key={key}><input type="checkbox" disabled={studentCalendarSaveBusy} checked={!!studentCalendarForm[key]} onChange={event => setStudentCalendarForm(current => ({ ...current, [key]: event.target.checked }))}/><Icon name={icon} size={25}/><span>{label}</span></label>)}</div><div className="day-status"><b>Day Status</b><span><i/>{studentCalendarClosedDays[studentCalendarSelected.key] === 'closed' ? 'Mess Closed · admin override is available' : 'Admin access · all dates are editable'}</span></div>{studentCalendarError && <p className="modal-notice" role="alert">{studentCalendarError}</p>}<div className="modal-actions"><button type="button" className="outline-button cancel-day-button" disabled={studentCalendarSaveBusy} onClick={() => setStudentCalendarSelected(null)}>Cancel</button><button type="button" className="outline-button update-day-button" disabled={studentCalendarSaveBusy} onClick={() => saveStudentCalendarDay(['b', 'l', 't', 'd'].map(key => studentCalendarForm[key] ? key.toUpperCase() : '-').join(''))}>{studentCalendarSaveBusy ? 'Updating…' : 'Update'}</button></div><div className="quick-actions"><button type="button" className="primary-button quick-full-day" disabled={studentCalendarSaveBusy} onClick={() => saveStudentCalendarDay('BLTD')}>Full Day</button><button type="button" className="quick-mess-cut" disabled={studentCalendarSaveBusy} onClick={() => saveStudentCalendarDay('----')}>Mess Cut</button></div></section></div>}

      {bulkDialog && <div className="sa-modal-overlay" role="presentation"><section className="sa-modal sa-bulk-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-modal-title"><div className="sa-modal-heading"><span className="sa-control-icon is-blue"><Icon name="upload"/></span><div><h2 id="bulk-modal-title">Import students</h2><p>Upload a completed student template in Excel or CSV format.</p></div><button className="sa-modal-close" disabled={studentBusy} onClick={() => { setBulkDialog(false); setBulkRows([]); setBulkResult(null); }} aria-label="Close"><Icon name="close"/></button></div>
        {!bulkAwaitConfirm && !bulkResult?.length && <><div className="sa-bulk-instructions"><b>Template columns</b><span>{bulkHeaders.join(' · ')}</span><small>Use the template in the same order. Hostel, year, department, blood group, and food preference should match the listed profile options.</small></div><label className="sa-bulk-upload"><Icon name="upload" size={21}/><b>Choose a filled student list</b><span>Excel (.xlsx) or CSV · up to 200 students</span><input type="file" accept=".xlsx,.xls,.csv" onChange={event => event.target.files?.[0] && readBulkFile(event.target.files[0])}/></label>{bulkError && <p className="sa-form-error" role="alert">{bulkError}</p>}{bulkPreview.length > 0 && <div className="sa-bulk-meta"><span>{bulkPreview.length} student{bulkPreview.length === 1 ? '' : 's'} ready to add</span><span>Review before proceeding</span></div>}<div className="sa-modal-actions"><button type="button" className="sa-button sa-button-secondary" onClick={() => { setBulkDialog(false); setBulkRows([]); }}>Cancel</button><button className="sa-button sa-button-primary" disabled={!bulkPreview.length} onClick={importStudents}>Continue</button></div></>}
        {bulkAwaitConfirm && <><div className="sa-import-confirm"><b>{bulkPreview.length} student{bulkPreview.length === 1 ? '' : 's'} will be added.</b><span>Proceed to create them one at a time, or cancel to discard this upload.</span></div><div className="sa-modal-actions"><button type="button" className="sa-button sa-button-secondary" onClick={() => { setBulkAwaitConfirm(false); setBulkRows([]); setBulkError(''); }}>Cancel upload</button><button className="sa-button sa-button-primary" onClick={proceedBulkImport}>Proceed</button></div></>}
        {(studentBusy || (bulkResult && bulkResult.length > 0)) && <><div className="sa-import-progress"><span className="sa-progress-ring" style={{ '--progress': `${bulkProgress / Math.max(bulkPreview.length, 1) * 100}%` }}><b>{bulkProgress}/{bulkPreview.length}</b></span><span><b>{studentBusy ? 'Adding students…' : 'Import complete'}</b><small>{bulkResult?.filter(row => row.ok).length || 0} succeeded · {bulkResult?.filter(row => !row.ok).length || 0} failed</small></span></div><div className="sa-import-list"><div className="sa-import-list-head"><b>Student</b><b>Acc no</b><b>Hostel</b><b>Status</b></div>{bulkResult?.map((row, index) => <div className="sa-import-list-row" key={`${row.row}-${index}`}><span>{row.full_name || '—'}{row.error && <small>{row.error}</small>}</span><span>{row.account_number || '—'}</span><span>{row.hostel || '—'}</span><b className={row.ok ? 'is-success' : 'is-failed'}>{row.ok ? 'Success' : 'Failed'}</b></div>)}</div><div className="sa-modal-actions"><button type="button" className="sa-button sa-button-secondary" disabled={studentBusy} onClick={() => { setBulkDialog(false); setBulkRows([]); setBulkResult(null); }}>Close</button></div></>}
      </section></div>}

      {closedDaysDialog && <div className="sa-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setClosedDaysDialog(false); }}><section className="sa-modal sa-closed-days-modal" role="dialog" aria-modal="true" aria-labelledby="closed-days-title"><div className="sa-modal-heading"><span className="sa-control-icon is-amber"><Icon name="calendar"/></span><div><h2 id="closed-days-title">Mess closed days</h2><p>All closed dates for {selectedTenant?.name || 'this mess'}.</p></div><button className="sa-modal-close" onClick={() => setClosedDaysDialog(false)} aria-label="Close"><Icon name="close"/></button></div>{closedDaysListBusy ? <div className="sa-loading-row"><span className="sa-loader"/> Loading closed days…</div> : closedDaysList.length ? <div className="sa-closed-days-list">{closedDaysList.map(day => <div className="sa-closed-day-row" key={day.calendar_date}><span className="sa-closed-day-icon"><Icon name="calendar" size={16}/></span><span><b>{dateLabel(day.calendar_date)}</b><small>{day.note || 'Mess service closed'}</small></span><StatusPill tone="amber">Mess Closed</StatusPill></div>)}</div> : <EmptyState title="No closed days" body="No dates are currently marked as Mess Closed."/>}<div className="sa-modal-actions"><button type="button" className="sa-button sa-button-secondary" onClick={() => setClosedDaysDialog(false)}>Close</button></div></section></div>}

      {accountInfoOpen && <div className="sa-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAccountInfoOpen(false); }}><section className="sa-modal sa-account-info-modal" role="dialog" aria-modal="true" aria-labelledby="account-info-title"><div className="sa-modal-heading"><span className="sa-control-icon is-green"><Icon name="user"/></span><div><h2 id="account-info-title">Account information</h2><p>Signed-in super-admin account details.</p></div><button className="sa-modal-close" onClick={() => setAccountInfoOpen(false)} aria-label="Close"><Icon name="close"/></button></div><div className="sa-profile-identity"><span className="sa-avatar sa-profile-avatar">{adminName.slice(0, 1).toUpperCase()}</span><span><b>{adminName}</b><small>Super admin</small></span></div><dl className="sa-account-details"><div><dt>Email</dt><dd>{session.user.email}</dd></div><div><dt>User ID</dt><dd className="sa-account-id">{session.user.id}</dd></div><div><dt>Email verified</dt><dd>{session.user.email_confirmed_at ? 'Yes' : 'Not confirmed'}</dd></div></dl><div className="sa-modal-actions"><button className="sa-button sa-button-secondary" onClick={() => setAccountInfoOpen(false)}>Close</button><button className="sa-button sa-button-primary" onClick={() => { setAccountInfoOpen(false); openPasswordChange(); }}>Change password</button></div></section></div>}

      {passwordDialogOpen && <div className="sa-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !passwordChangeBusy) setPasswordDialogOpen(false); }}><section className="sa-modal sa-password-modal" role="dialog" aria-modal="true" aria-labelledby="admin-password-title"><div className="sa-modal-heading"><span className="sa-control-icon is-blue"><Icon name="lock"/></span><div><h2 id="admin-password-title">Change password</h2><p>Verify your email before choosing a new password.</p></div><button className="sa-modal-close" disabled={passwordChangeBusy} onClick={() => setPasswordDialogOpen(false)} aria-label="Close"><Icon name="close"/></button></div>{passwordChangeMessage === 'Your password has been changed.' ? <div className="sa-password-success"><span><Icon name="check" size={21}/></span><b>Password changed</b><p>Your super-admin password was updated successfully.</p><button className="sa-button sa-button-primary" onClick={() => setPasswordDialogOpen(false)}>Done</button></div> : <form className="sa-modal-form" onSubmit={updateAdminPassword}><div className="sa-otp-address"><Icon name="shield" size={17}/><span>Verification code will be sent to <b>{session.user.email}</b>.</span></div>{!otpSent ? <button type="button" className="sa-button sa-button-primary sa-send-otp" onClick={sendPasswordOtp} disabled={passwordChangeBusy}>{passwordChangeBusy ? 'Sending code…' : 'Send email verification code'}</button> : <><div className="sa-otp-sent" role="status">{passwordChangeMessage}</div><label className="sa-field"><span>Email verification code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otpCode} onChange={event => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required/></label><label className="sa-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} value={newAdminPassword} onChange={event => setNewAdminPassword(event.target.value)} placeholder="At least 8 characters" required/></label><label className="sa-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} value={confirmAdminPassword} onChange={event => setConfirmAdminPassword(event.target.value)} placeholder="Re-enter new password" required/></label><div className="sa-otp-actions"><button type="button" className="sa-text-button" onClick={sendPasswordOtp} disabled={passwordChangeBusy}>Resend code</button><button className="sa-button sa-button-primary" disabled={passwordChangeBusy}>{passwordChangeBusy ? 'Verifying…' : 'Verify and change password'}</button></div></>}{passwordChangeError && <p className="sa-form-error" role="alert">{passwordChangeError}</p>}<div className="sa-modal-actions"><button type="button" className="sa-button sa-button-secondary" onClick={() => setPasswordDialogOpen(false)} disabled={passwordChangeBusy}>Cancel</button></div></form>}</section></div>}

      {confirm && <div className="sa-modal-overlay" role="presentation"><section className="sa-modal sa-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><span className={`sa-confirm-icon ${confirm.danger ? 'is-danger' : ''}`}><Icon name={confirm.danger ? 'alert' : 'lock'} size={23}/></span><h2 id="confirm-title">{confirm.title}</h2><p>{confirm.message}</p><div className="sa-modal-actions"><button className="sa-button sa-button-secondary" onClick={() => setConfirm(null)} disabled={studentBusy || settingsBusy}>Cancel</button><button className={`sa-button ${confirm.danger ? 'sa-button-danger' : 'sa-button-primary'}`} onClick={confirm.run} disabled={studentBusy || settingsBusy}>{studentBusy || settingsBusy ? 'Working…' : confirm.confirmText}</button></div></section></div>}
    </div>
  );
}

function ActivityTable({ items, compact = false }) {
  if (!items.length) return <EmptyState title="No activity yet" body="Admin updates will appear here as they happen."/>;
  return <div className="sa-table-wrap"><table className={`sa-table sa-activity-table ${compact ? 'is-compact' : ''}`}><thead><tr><th>Activity</th><th>User</th><th>Details</th><th>Date & time</th></tr></thead><tbody>{items.map(item => { const details = item.details || {}; const userType = item.user_type || item.actor_type || details.actor_type || (details.source === 'student' ? 'student' : 'admin'); const userName = item.user_name || (userType === 'student' ? [details.account_number, details.student_name].filter(Boolean).join(' - ') : details.actor_name) || (userType === 'student' ? 'Student' : 'Admin'); const targetStudent = userType === 'admin' && details.account_number && details.student_name ? `${details.account_number} - ${details.student_name}` : ''; const detailBody = item.action === 'auth.login' ? 'Successful sign-in' : details.status ? `${details.status === 'cut' ? 'Mess cut' : 'Present'} · ${dateLabel(details.date)}` : details.month ? `Month: ${details.month}` : details.title ? `${details.title} · ${details.recipients} recipients` : details.lock_time ? `Lock time set to ${String(details.lock_time).slice(0, 5)}` : details.note || details.row ? [details.note, details.row ? `Import row ${details.row}` : ''].filter(Boolean).join(' · ') : 'Profile or access details updated'; const detailText = [targetStudent, detailBody].filter(Boolean).join(' · '); return <tr key={item.id}><td><div className="sa-activity-name"><span className={`sa-activity-dot ${item.action?.startsWith('student') || item.action?.startsWith('meal') ? 'is-student' : item.action?.startsWith('day') ? 'is-day' : 'is-admin'}`}><Icon name={item.action?.includes('deleted') ? 'trash' : item.action?.includes('password') ? 'lock' : item.action?.includes('notification') ? 'bell' : item.action?.startsWith('day') ? 'calendar' : item.action === 'auth.login' ? 'shield' : 'edit'} size={15}/></span><b>{actionLabel(item.action)}</b></div></td><td><span className="sa-activity-user"><b>{userName}</b><small>{userType === 'student' ? 'Student' : 'Admin'}</small></span></td><td><span className="sa-activity-detail">{detailText}</span></td><td><span className="sa-activity-date">{dateTimeLabel(item.created_at)}</span></td></tr>; })}</tbody></table></div>;
}

function EmptyState({ title, body }) {
  return <div className="sa-empty-state"><span><Icon name="search" size={22}/></span><b>{title}</b><p>{body}</p></div>;
}
