import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { invokeMessAdmin } from './messAdminApi';
import DaysDownloadPage from './DaysDownloadPage';
import './MessAdminPage.css';

const allHostels = 'all';
const months = [-1, 0, 1];
const dashboardActions = [
  { id: 'mess-count', label: 'Mess Count', description: 'Meal totals and preferences', icon: '▦' },
  { id: 'students-list', label: 'Students List', description: 'Daily roster and mess status', icon: '☷' },
  { id: 'extras', label: 'Extras Management', description: 'Extras records and amounts', icon: '✦', disabled: true },
  { id: 'fines', label: 'Fine Management', description: 'Fined days and records', icon: '₹', disabled: true },
  { id: 'student-profile', label: 'Student Profile', description: 'Search and view student details', icon: '♙' },
  { id: 'days-download', label: 'Days Download', description: 'Review and download monthly student days', icon: '⇩' },
];
const profileFields = [
  ['Account number', 'account_number'], ['Admission number', 'admission_number'], ['Hostel', 'hostel_name'],
  ['Room', 'room'], ['Academic year', 'academic_year'], ['Department', 'department'],
  ['Email', 'email'], ['Mobile number', 'mobile_number'], ['Blood group', 'blood_group'],
  ['Food preference', 'food_preference'], ['Guardian', 'guardian_name'], ['Guardian relation', 'guardian_relation'],
  ['Guardian mobile', 'guardian_mobile_number'],
];

function getCurrentMonthKey() {
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

function calendarDates(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, index) => new Date(Date.UTC(year, monthNumber - 1, index + 1)));
}

function getMealMap(meals = []) {
  return Object.fromEntries(meals.map(row => [row.meal_date, String(row.meal_code || '----').trim()]));
}

function getBillableDays(meals, month) {
  const days = getMealMap(meals);
  const dates = calendarDates(month);
  return dates.reduce((total, date) => {
    const dateKey = date.toISOString().slice(0, 10);
    if (!Object.prototype.hasOwnProperty.call(days, dateKey)) return total;
    if (days[dateKey] !== '----') return total + 1;
    const prev = new Date(date);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);
    const prevCut = days[prev.toISOString().slice(0, 10)] === '----';
    const nextCut = days[next.toISOString().slice(0, 10)] === '----';
    return total + (!prevCut && !nextCut ? 1 : 0);
  }, 0);
}

function formatDate(dateKey) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`));
}

function pageFromPath(pathname) {
  const path = pathname.replace(/\/+$/, '');
  if (path.endsWith('/students')) return 'students';
  if (path.endsWith('/days-download')) return 'days-download';
  return 'home';
}

async function callMessAdmin(action, payload = {}) {
  if (!supabase) throw new Error('Supabase is not configured. Add the API URL and anon key to client/.env.local.');
  const { data, error } = await invokeMessAdmin(supabase, action, payload);
  if (error) {
    let message = error.message || 'Unable to complete the request.';
    try {
      const detail = await error.context?.json();
      if (detail?.error) message = detail.error;
    } catch { /* keep the client error */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function MessAdminPage() {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState(allHostels);
  const [yearFilter, setYearFilter] = useState(allHostels);
  const [departmentFilter, setDepartmentFilter] = useState(allHostels);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailPanel, setDetailPanel] = useState('profile');
  const [detailMonth, setDetailMonth] = useState(getCurrentMonthKey);
  const [monthData, setMonthData] = useState(null);
  const [monthBusy, setMonthBusy] = useState(false);
  const [monthError, setMonthError] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const data = await callMessAdmin('dashboard');
      setDashboard(data);
    } catch (loadError) {
      setDashboard(null);
      setError(loadError.message || 'Unable to load the mess-admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      setError('Supabase is not configured. Add the API URL and anon key to client/.env.local.');
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setSessionReady(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onHistoryChange = () => {
      setPage(pageFromPath(window.location.pathname));
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', onHistoryChange);
    return () => window.removeEventListener('popstate', onHistoryChange);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (session) loadDashboard();
    else setDashboard(null);
  }, [loadDashboard, session]);

  useEffect(() => {
    if (!selectedStudent || !['calendar', 'bills'].includes(detailPanel)) return undefined;
    let active = true;
    setMonthBusy(true);
    setMonthError('');
    callMessAdmin('student-month', { studentId: selectedStudent.id, month: detailMonth })
      .then(data => { if (active) setMonthData(data); })
      .catch(loadError => { if (active) { setMonthData(null); setMonthError(loadError.message || 'Unable to load this student’s month.'); } })
      .finally(() => { if (active) setMonthBusy(false); });
    return () => { active = false; };
  }, [detailMonth, detailPanel, selectedStudent]);

  const students = dashboard?.students || [];
  const hostels = dashboard?.hostels || [];
  const years = useMemo(() => [...new Set(students.map(student => student.academic_year).filter(Boolean))].sort(), [students]);
  const departments = useMemo(() => [...new Set(students.map(student => student.department).filter(Boolean))].sort(), [students]);
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return students.filter(student => {
      const matchesQuery = !query || [student.account_number, student.admission_number, student.full_name, student.room, student.department, student.email, student.mobile_number, student.guardian_name, student.guardian_mobile_number]
        .some(value => String(value || '').toLocaleLowerCase().includes(query));
      return matchesQuery
        && (hostelFilter === allHostels || student.hostel_id === hostelFilter)
        && (yearFilter === allHostels || student.academic_year === yearFilter)
        && (departmentFilter === allHostels || student.department === departmentFilter);
    });
  }, [departmentFilter, hostelFilter, search, students, yearFilter]);

  async function signIn(event) {
    event.preventDefault();
    setError('');
    const username = account.trim().toLowerCase();
    if (!username || !password) {
      setError('Enter your username and password.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured. Add the API URL and anon key to client/.env.local.');
      return;
    }
    setLoginBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: `${username}@demo.digimessbook.local`, password });
      if (authError) throw new Error(authError.message === 'Invalid login credentials' ? 'Username or password is incorrect.' : authError.message);
      setPassword('');
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in. Try again.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function signOut() {
    setMobileMenuOpen(false);
    await supabase?.auth.signOut();
    setSelectedStudent(null);
    setError('');
  }

  function openStudent(student, panel) {
    setSelectedStudent(student);
    setDetailPanel(panel);
    setDetailMonth(getCurrentMonthKey());
    setMonthData(null);
    setMonthError('');
  }

  function openInNewTab(path) {
    window.open(path, '_blank', 'noopener,noreferrer');
  }

  function navigate(nextPage) {
    const path = nextPage === 'students' ? '/mess-admin/students'
      : nextPage === 'days-download' ? '/mess-admin/days-download' : '/mess-admin';
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setPage(nextPage);
    setMobileMenuOpen(false);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function activateAction(action) {
    if (action.disabled) return;
    if (action.id === 'student-profile') {
      navigate('students');
      return;
    }
    if (action.id === 'days-download') {
      navigate('days-download');
      return;
    }
    setMobileMenuOpen(false);
    if (action.id === 'mess-count') openInNewTab('/mess-count');
    if (action.id === 'students-list') openInNewTab('/students-list');
  }

  const currentMonth = getCurrentMonthKey();
  const monthChoices = useMemo(() => months.map(offset => {
    const key = shiftMonth(currentMonth, offset);
    return { key, label: monthTitle(key), relative: offset === -1 ? 'Previous month' : offset === 0 ? 'Current month' : 'Next month' };
  }), [currentMonth]);
  const metrics = dashboard?.metrics || {};
  const week = dashboard?.week || [];
  const maxDailyEntries = Math.max(1, ...week.map(day => day.present + day.cut));

  if (!sessionReady) {
    return <main className="ma-gate"><span className="ma-spinner" /><p>Checking mess-admin session…</p></main>;
  }

  if (session && !dashboard && loading) {
    return <main className="ma-gate"><span className="ma-spinner" /><p>Loading your hostel dashboard…</p></main>;
  }

  if (!session || !dashboard) {
    const signedIn = !!session;
    return (
      <main className="ma-login-page">
        <section className="ma-login-card">
          <a className="ma-back-link" href="/">← Back to Mess Book</a>
          <div className="ma-login-brand"><span className="ma-brand-icon">DM</span><span><b>DigiMessBook</b><small>Hostel mess operations</small></span></div>
          <span className="ma-eyebrow">MESS ADMIN</span>
          <h1>{signedIn ? 'Dashboard unavailable' : 'Sign in to your dashboard'}</h1>
          <p className="ma-login-copy">{signedIn ? 'This account could not open a mess-admin dashboard. Check the access message below or sign out to use another account.' : 'Use your mess-admin account to view students and daily operations for your assigned hostels.'}</p>
          {error && <div className="ma-alert" role="alert">{error}</div>}
          {signedIn ? (
            <button className="ma-primary-button ma-wide-button" onClick={signOut}>Sign out</button>
          ) : (
            <form className="ma-login-form" onSubmit={signIn}>
              <label><span>Username</span><input autoComplete="username" value={account} onChange={event => setAccount(event.target.value)} placeholder="messadmin-mh1" required /></label>
              <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter password" required /></label>
              <button className="ma-primary-button ma-wide-button" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button>
            </form>
          )}
          <small className="ma-login-footnote">Your dashboard only shows hostels assigned to your account.</small>
        </section>
      </main>
    );
  }

  return (
    <div className="ma-app-shell">
      <aside className={`ma-sidebar ${mobileMenuOpen ? 'is-mobile-open' : ''}`}>
        <div className="ma-sidebar-brand-row"><a className="ma-sidebar-brand" href="/mess-admin"><span className="ma-brand-icon">DM</span><span><b>DigiMessBook</b><small>Mess admin</small></span></a><button type="button" className="ma-sidebar-close" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>×</button></div>
        <nav className="ma-sidebar-nav" aria-label="Mess admin navigation">
          <button className={`ma-nav-item ${page === 'home' ? 'is-active' : ''}`} onClick={() => navigate('home')}><span className="ma-nav-icon">⌂</span><span>Home</span></button>
          {dashboardActions.map(action => <button key={action.id} type="button" className={`ma-nav-item ${(page === 'students' && action.id === 'student-profile') || (page === 'days-download' && action.id === 'days-download') ? 'is-active' : ''}`} disabled={action.disabled} onClick={() => activateAction(action)} title={action.disabled ? `${action.label} will be available later` : undefined}><span className="ma-nav-icon">{action.icon}</span><span>{action.label}</span>{action.disabled && <small>Soon</small>}</button>)}
        </nav>
        <div className="ma-sidebar-scope"><span>HOSTEL ACCESS</span><b>{hostels.map(hostel => hostel.name).join(' · ')}</b></div>
      </aside>

      {mobileMenuOpen && <button type="button" className="ma-menu-backdrop" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} />}
      <div className="ma-main">
        <header className="ma-topbar">
          <div className="ma-topbar-heading"><button type="button" className="ma-mobile-menu-toggle" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(open => !open)}><span aria-hidden="true">☰</span></button><div className="ma-top-context"><span>MESS OPERATIONS</span><b>{page === 'home' ? 'Dashboard' : page === 'students' ? 'Student Profile' : 'Days Download'}</b></div></div>
          <div className="ma-account"><span className="ma-account-avatar">{(dashboard.adminName || 'M').slice(0, 1).toUpperCase()}</span><span><b>{dashboard.adminName || 'Mess admin'}</b><small>{hostels.map(hostel => hostel.name).join(', ')}</small></span><button type="button" onClick={signOut}>Sign out</button></div>
        </header>
        <div className="ma-content">
          {error && <div className="ma-alert ma-page-alert" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

          {page === 'home' ? (
            <>
              <section className="ma-welcome-row">
                <div><span className="ma-eyebrow">MESS OPERATIONS</span><h1>Good day, {dashboard.adminName || 'Mess admin'}</h1><p>Student services for {hostels.map(hostel => hostel.name).join(', ')}.</p></div>
                <span className="ma-scope-chip">{hostels.length} hostel{hostels.length === 1 ? '' : 's'} assigned</span>
              </section>

              <section className="ma-metrics-grid" aria-label="Mess dashboard statistics">
                {[
                  ['Today', metrics.today || { present: 0, total: students.length, percent: 0 }],
                  ['Tomorrow', metrics.tomorrow || { present: 0, total: students.length, percent: 0 }],
                ].map(([label, value]) => <article className="ma-metric-card ma-attendance-metric" key={label}>
                  <div className="ma-attendance-copy"><span className="ma-metric-label">{label} · Present &amp; total</span><strong>{value.present}</strong><small>Total: {value.total}</small></div>
                  <span className="ma-donut" style={{ '--ma-percent': `${value.percent}%` }}><b>{value.percent}%</b></span>
                </article>)}
                <article className="ma-metric-card"><span className="ma-metric-label">Mess cut this week</span><strong>{metrics.cutThisWeek ?? '—'}</strong><small>Student cut entries · last 7 days</small></article>
                <article className="ma-metric-card"><span className="ma-metric-label">Extras amount this month</span><strong className="ma-metric-untracked">{metrics.extrasAmountThisMonth == null ? 'Not tracked' : `₹${metrics.extrasAmountThisMonth}`}</strong><small>{metrics.extrasAmountThisMonth == null ? 'Extras records are not set up yet' : 'Recorded extras'}</small></article>
                <article className="ma-metric-card"><span className="ma-metric-label">Total days this month</span><strong>{metrics.totalDaysThisMonth ?? '—'}</strong><small>Calendar days · {monthTitle(currentMonth)}</small></article>
                <article className="ma-metric-card"><span className="ma-metric-label">Fined days this month</span><strong className="ma-metric-untracked">{metrics.finedDaysThisMonth == null ? 'Not tracked' : metrics.finedDaysThisMonth}</strong><small>{metrics.finedDaysThisMonth == null ? 'Fine records are not set up yet' : 'Recorded fine days'}</small></article>
              </section>

              <section className="ma-dashboard-grid">
                <article className="ma-panel ma-chart-panel">
                  <div className="ma-panel-heading"><div><span className="ma-eyebrow">SEVEN-DAY OVERVIEW</span><h2>Meal attendance</h2><p>Two days before today through four days ahead</p></div><span className="ma-live-chip"><i /> Live data</span></div>
                  <div className="ma-chart-legend"><span><i className="is-present" />Present</span><span><i className="is-cut" />Mess cut</span></div>
                  <div className="ma-chart" role="img" aria-label="Present and mess cut student meal entries over the last 7 days">
                    {week.map(day => {
                      const total = day.present + day.cut;
                      const presentHeight = total ? day.present / maxDailyEntries * 100 : 0;
                      const cutHeight = total ? day.cut / maxDailyEntries * 100 : 0;
                      return <div className="ma-chart-column" key={day.date} title={`${formatDate(day.date)}: ${day.present} present, ${day.cut} cuts`}>
                        <div className="ma-chart-bars"><span className="is-present" style={{ height: `${presentHeight}%` }} /><span className="is-cut" style={{ height: `${cutHeight}%` }} /></div>
                        <span className={`ma-chart-label ${day.isToday ? 'is-today' : ''}`} aria-current={day.isToday ? 'date' : undefined}>{day.label}</span>
                      </div>;
                    })}
                  </div>
                  <div className="ma-chart-footer"><span>Today is highlighted</span><b>2 days before · 4 days ahead</b></div>
                </article>

                <article className="ma-panel ma-actions-panel">
                  <div className="ma-panel-heading"><div><span className="ma-eyebrow">MESS ADMIN TOOLS</span><h2>Quick actions</h2><p>Open a workspace for your hostels.</p></div><span className="ma-action-mark">✦</span></div>
                  <div className="ma-action-grid">
                    {dashboardActions.map(action => <button key={action.id} type="button" className="ma-action-card" disabled={action.disabled} onClick={() => activateAction(action)}>
                      <span className={`ma-action-icon is-${action.id}`}>{action.icon}</span><span><b>{action.label}</b><small>{action.disabled ? 'Coming soon' : action.description}</small></span><i>{action.disabled ? '⌁' : '↗'}</i>
                    </button>)}
                  </div>
                </article>
              </section>
              <footer className="ma-footer"><span>© 2026 DigiMessBook</span><span>Student details are read-only. Extras and fine records are not set up yet.</span></footer>
            </>
          ) : page === 'students' ? (
            <>
              <div className="ma-subpage-heading"><button className="ma-back-home" onClick={() => navigate('home')}>← Home</button><div><span className="ma-eyebrow">STUDENT DIRECTORY</span><h1>Student Profile</h1><p>Search students and review their profile, mess calendar, summary, and bill status.</p></div><span className="ma-count-pill">{filteredStudents.length} of {students.length} students</span></div>
              <section className="ma-student-section">
                <div className="ma-student-card">
                  <div className="ma-filters">
                    <label className="ma-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, account, room, or contact" aria-label="Search students" /></label>
                    <select aria-label="Filter by hostel" value={hostelFilter} onChange={event => setHostelFilter(event.target.value)}><option value={allHostels}>All accessible hostels</option>{hostels.map(hostel => <option key={hostel.id} value={hostel.id}>{hostel.name}</option>)}</select>
                    <select aria-label="Filter by year" value={yearFilter} onChange={event => setYearFilter(event.target.value)}><option value={allHostels}>All years</option>{years.map(year => <option key={year}>{year}</option>)}</select>
                    <select aria-label="Filter by department" value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}><option value={allHostels}>All departments</option>{departments.map(department => <option key={department}>{department}</option>)}</select>
                  </div>
                  <div className="ma-table-wrap">
                    <table className="ma-table"><thead><tr><th>Student</th><th>Account no.</th><th>Hostel / room</th><th>Year</th><th>Department</th><th>View details</th></tr></thead>
                      <tbody>{filteredStudents.map(student => <tr key={student.id}>
                        <td><div className="ma-student-cell"><span className="ma-student-avatar">{student.full_name?.slice(0, 1).toUpperCase() || 'S'}</span><span><b>{student.full_name}</b><small>{student.food_preference || 'No food preference'}</small></span></div></td>
                        <td><span className="ma-mono">{student.account_number}</span></td>
                        <td><b>{student.hostels?.name || '—'}</b><small className="ma-secondary">Room {student.room || '—'}</small></td>
                        <td>{student.academic_year || '—'}</td><td>{student.department || '—'}</td>
                        <td><div className="ma-row-actions"><button onClick={() => openStudent(student, 'profile')}>Profile</button><button onClick={() => openStudent(student, 'calendar')}>Calendar &amp; summary</button><button onClick={() => openStudent(student, 'bills')}>Bills</button></div></td>
                      </tr>)}</tbody>
                    </table>
                    {loading && <div className="ma-empty"><span className="ma-spinner" />Loading students…</div>}
                    {!loading && filteredStudents.length === 0 && <div className="ma-empty">{students.length ? 'No students match these filters.' : 'No students are assigned to your hostels yet.'}</div>}
                  </div>
                  <div className="ma-table-footer"><span>Read-only student records</span><span>{hostels.map(hostel => hostel.name).join(' · ')}</span></div>
                </div>
              </section>
              <footer className="ma-footer"><span>© 2026 DigiMessBook</span><span>Student profile, calendar, and bill details are read-only.</span></footer>
            </>
          ) : (
            <DaysDownloadPage hostels={hostels} onHome={() => navigate('home')} callMessAdmin={callMessAdmin} />
          )}
        </div>
      </div>

      {selectedStudent && (
        <div className="ma-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedStudent(null); }}>
          <section className="ma-modal" role="dialog" aria-modal="true" aria-labelledby="ma-modal-title">
            <header className="ma-modal-header"><span className="ma-student-avatar ma-large-avatar">{selectedStudent.full_name?.slice(0, 1).toUpperCase() || 'S'}</span><span className="ma-modal-title"><span className="ma-eyebrow">STUDENT RECORD</span><h2 id="ma-modal-title">{selectedStudent.full_name}</h2><small>{selectedStudent.account_number} · {selectedStudent.hostels?.name || 'Hostel'} · Room {selectedStudent.room || '—'}</small></span><button className="ma-close-button" onClick={() => setSelectedStudent(null)} aria-label="Close student details">×</button></header>
            <nav className="ma-detail-tabs" aria-label="Student detail views">
              <button className={detailPanel === 'profile' ? 'is-active' : ''} onClick={() => setDetailPanel('profile')}>See profile</button>
              <button className={detailPanel === 'calendar' ? 'is-active' : ''} onClick={() => setDetailPanel('calendar')}>Calendar &amp; summary</button>
              <button className={detailPanel === 'bills' ? 'is-active' : ''} onClick={() => setDetailPanel('bills')}>See bills</button>
            </nav>
            {detailPanel === 'profile' ? (
              <div className="ma-profile-grid">{profileFields.map(([label, field]) => {
                const value = field === 'hostel_name' ? selectedStudent.hostels?.name : selectedStudent[field];
                return <div className="ma-profile-field" key={field}><span>{label}</span><b>{value || '—'}</b></div>;
              })}</div>
            ) : (
              <div className="ma-month-view">
                <div className="ma-month-heading"><div><span className="ma-eyebrow">{detailPanel === 'bills' ? 'MONTHLY BILL' : 'MEAL CALENDAR'}</span><h3>{monthTitle(detailMonth)}</h3></div><label>Month<select aria-label="Select calendar month" value={detailMonth} onChange={event => { setDetailMonth(event.target.value); setMonthData(null); }}>
                  {monthChoices.map(option => <option value={option.key} key={option.key}>{option.label} · {option.relative}</option>)}
                  {!monthChoices.some(option => option.key === detailMonth) && <option value={detailMonth}>{monthTitle(detailMonth)}</option>}
                </select></label></div>
                {monthError && <div className="ma-alert">{monthError}</div>}
                {monthBusy ? <div className="ma-empty"><span className="ma-spinner" />Loading monthly details…</div> : monthData && detailPanel === 'calendar' ? (
                  <>
                    <div className="ma-month-summary"><div><span>Billable days</span><b>{getBillableDays(monthData.meals, detailMonth)}</b></div><div><span>Calendar status</span><b>Read only</b></div></div>
                    <div className="ma-calendar-grid ma-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
                    <div className="ma-calendar-grid ma-calendar-days">
                      {Array.from({ length: calendarDates(detailMonth)[0].getUTCDay() }, (_, index) => <span className="ma-calendar-empty" key={`empty-${index}`} />)}
                      {calendarDates(detailMonth).map(date => {
                        const dateKey = date.toISOString().slice(0, 10);
                        const meal = getMealMap(monthData.meals)[dateKey];
                        const closed = monthData.closedDays?.some(day => day.calendar_date === dateKey && day.status === 'closed');
                        return <div className={`ma-calendar-day ${meal === '----' ? 'is-cut' : meal ? 'is-in-mess' : ''} ${closed ? 'is-closed' : ''}`} key={dateKey}><b>{date.getUTCDate()}</b><small>{closed ? 'Closed' : meal === '----' ? 'Cut' : meal ? meal : '—'}</small></div>;
                      })}
                    </div>
                    <div className="ma-calendar-legend"><span><i className="is-meal" /> Meal selection</span><span><i className="is-cut" /> Mess cut</span><span><i className="is-closed" /> Mess closed</span></div>
                  </>
                ) : monthData ? (
                  <>
                    <div className="ma-bill-status"><span className="ma-bill-icon">₹</span><div><span>Total bill for {monthTitle(detailMonth)}</span><b>N/A</b></div></div>
                    <div className="ma-month-summary"><div><span>Billable days</span><b>{getBillableDays(monthData.meals, detailMonth)}</b></div><div><span>Bill status</span><b className="ma-status-pending">Not generated</b></div></div>
                    <p className="ma-bill-note">Bill not generated yet. The bill amount will appear here when it is uploaded.</p>
                  </>
                ) : null}
                <p className="ma-readonly-note">Student data is shown read-only.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
