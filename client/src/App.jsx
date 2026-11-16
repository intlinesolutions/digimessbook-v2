import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { supabase } from './supabase';
import MessCountPage from './MessCountPage.jsx';
import StudentsListPage from './StudentsListPage.jsx';
const SuperAdminPage = lazy(() => import('./SuperAdminPage.jsx'));

const meals = [
  ['b', 'Breakfast', 'coffee'],
  ['l', 'Lunch', 'lunch'],
  ['t', 'Evening Tea', 'tea'],
  ['d', 'Dinner', 'dinner'],
];
const foodOptions = ['Chicken', 'Fish', 'Egg', 'Beef', 'Veg only'];
const dates = Array.from({ length: 30 }, (_, i) => new Date(2026, 10, i + 1));
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const locked = (d, rules, closedDays) => {
  if (closedDays?.[keyOf(d)] === 'closed') return true;
  const lockDays = Number(rules?.lock_days_before ?? 1);
  const lockTime = String(rules?.lock_time || '19:00').slice(0, 5);
  const cutoffDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - lockDays));
  return Date.now() >= new Date(`${keyOf(cutoffDate)}T${lockTime}:00+05:30`).getTime();
};
function orderedFoodItems(value) {
  const selected = new Set((Array.isArray(value) ? value : String(value || '').split(','))
    .map(item => item.trim())
    .filter(Boolean));
  return foodOptions.filter(item => selected.has(item));
}
const orderedFoodPreference = value => orderedFoodItems(value).join(', ');
function lockDeadline(d, rules) {
  const lockDays = Number(rules?.lock_days_before ?? 1);
  const lockTime = String(rules?.lock_time || '19:00').slice(0, 5);
  const cutoff = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - lockDays));
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(cutoff);
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(`${keyOf(cutoff)}T${lockTime}:00+05:30`)).toUpperCase();
  return `${date} at ${time} IST`;
}
const isToday = d => {
  const today = new Date();
  return d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
};

function billable(days) {
  const vals = dates.map(d => days[keyOf(d)] || '----');
  let n = 0;
  for (let i = 0; i < vals.length;) {
    if (vals[i] === '----') {
      let j = i;
      while (j < vals.length && vals[j] === '----') j++;
      if (j - i === 1) n++;
      i = j;
    } else {
      n++;
      i++;
    }
  }
  return n;
}

const iconShapes = {
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.7 1.2c-.8 1.3-2.3 1.5-2.3 3.3m0 3h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  chevron: <><path d="m9 18 6-6-6-6" /></>,
  receipt: <><path d="M5 3 7 4.5 9 3l3 1.5L15 3l2 1.5L19 3v18l-2-1.5-2 1.5-3-1.5L9 21l-2-1.5L5 21V3Z" /><path d="M9 9h6m-6 4h6m-6 4h4" /></>,
  coffee: <><path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Zm13 2h2a2 2 0 1 1 0 4h-2M8 3c0 2 2 2 2 4M13 3c0 2 2 2 2 4" /></>,
  lunch: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="5" /><path d="M3 4v7m-2-7v4a2 2 0 0 0 4 0V4m-2 7v9m18-16v16m0-16c-2 2-3 5-3 8h3" /></>,
  tea: <><path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Zm12 2h2a2 2 0 1 1 0 4h-2M9 3c0 2 2 2 2 4" /></>,
  dinner: <><path d="M3 17a9 9 0 0 1 18 0H3Zm-1 3h20M12 4V2m-6 5L4 5m14 2 2-2" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  cloche: <><path d="M7 20h10M5 17h14a2 2 0 0 0 2-2c0-5-3.7-9-9-9s-9 4-9 9a2 2 0 0 0 2 2Zm7-11V4" /><circle cx="12" cy="3" r="1" /></>,
};

function Icon({ name, size = 22, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconShapes[name] || iconShapes.info}
    </svg>
  );
}

function CampusIllustration() {
  return (
    <svg className="campus-illustration" viewBox="0 0 520 260" fill="none" aria-hidden="true">
      <path d="M0 214c81-41 116 28 201-3 90-33 140-26 202 2 49 22 86-5 117-21v68H0v-46Z" fill="#CDEDAF" />
      <path d="M0 232c89-29 134 13 224-5 77-15 151-27 296-4v37H0v-28Z" fill="#9FD565" />
      <path d="m87 211 156-88 179 88v9H87v-9Z" fill="#7DBE50" />
      <path d="m111 205 132-70 154 70v56H111v-56Z" fill="#F8FFF5" stroke="#70AD4A" strokeWidth="4" />
      <path d="m104 205 139-77 161 77" stroke="#4E9639" strokeWidth="5" strokeLinejoin="round" />
      <path d="M143 211h35v-23h-35v23Zm54 0h35v-23h-35v23Zm54 0h35v-23h-35v23Zm54 0h35v-23h-35v23Z" fill="#A6D591" />
      <path d="M140 235h35v-20h-35v20Zm57 0h35v-20h-35v20Zm57 0h35v-20h-35v20Zm57 0h35v-20h-35v20Z" fill="#A6D591" />
      <path d="M41 211c0-19 13-34 29-34s29 15 29 34M50 210c0-14 8-24 20-24s20 10 20 24M401 211c0-23 15-41 34-41s34 18 34 41m-56 0c0-16 10-28 22-28s22 12 22 28" stroke="#5A9D3D" strokeWidth="4" />
      <path d="M0 243h520" stroke="#6AAE45" strokeWidth="4" />
    </svg>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function App() {
  const [student, setStudent] = useState(null);
  const [acc, setAcc] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotAccountNumber, setForgotAccountNumber] = useState('');
  const [forgotAdmissionNumber, setForgotAdmissionNumber] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotComplete, setForgotComplete] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [foodOpen, setFoodOpen] = useState(false);
  const [food, setFood] = useState([]);
  const [foodError, setFoodError] = useState('');
  const [savingFood, setSavingFood] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState('');
  const [messRules, setMessRules] = useState({ lock_days_before: 1, lock_time: '19:00:00', timezone: 'Asia/Kolkata' });
  const [closedDays, setClosedDays] = useState({});
  const [summaryModal, setSummaryModal] = useState('');
  const [summaryMonthIsCurrent, setSummaryMonthIsCurrent] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [rangeError, setRangeError] = useState('');
  const [savingRange, setSavingRange] = useState(false);
  const noticeTimer = useRef(null);
  const welcomeNameRef = useRef(null);

  const isDateLocked = date => locked(date, messRules, closedDays);
  const total = useMemo(() => student ? billable(student.days) : 0, [student]);
  const selectedRangeDates = rangeStart && rangeEnd
    ? dates.filter(date => date >= rangeStart && date <= rangeEnd)
    : [];
  const rangeReady = selectedRangeDates.length >= 2 && selectedRangeDates.every(date => !isDateLocked(date));

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    if (student?.studentId) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [student?.studentId]);

  useEffect(() => {
    const element = welcomeNameRef.current;
    if (!element) return undefined;
    let frame = 0;
    const fitName = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        element.style.removeProperty('font-size');
        const availableWidth = element.clientWidth;
        const naturalWidth = element.scrollWidth;
        const baseSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
        if (availableWidth > 0 && naturalWidth > availableWidth) {
          element.style.fontSize = `${baseSize * availableWidth / naturalWidth}px`;
        }
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitName);
    if (element.parentElement) observer?.observe(element.parentElement);
    window.addEventListener('resize', fitName);
    fitName();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fitName);
      window.cancelAnimationFrame(frame);
    };
  }, [student?.name]);

  useEffect(() => {
    if (!student?.studentId || !supabase) return undefined;
    let active = true;
    const pollNotifications = async () => {
      const { data: rows, error: fetchError } = await supabase.from('student_notifications')
        .select('id,title,message,created_at,read_at').eq('student_id', student.studentId)
        .order('created_at', { ascending: false }).limit(20);
      if (active && !fetchError) setNotifications(rows || []);
    };
    const intervalId = window.setInterval(pollNotifications, 15000);
    return () => { active = false; window.clearInterval(intervalId); };
  }, [student?.studentId]);

  function dismissNotice() {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = null;
    setNotice('');
  }

  async function removeReadNotification(notificationId) {
    if (!supabase || !student?.studentId) return;
    setNotificationError('');
    const { error: deleteError } = await supabase.from('student_notifications').delete()
      .eq('id', notificationId).eq('student_id', student.studentId);
    if (deleteError) {
      setNotificationError(deleteError.message || 'Unable to remove this notification.');
      return;
    }
    setNotifications(current => current.filter(item => item.id !== notificationId));
  }

  function showNotice(message) {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => {
      setNotice('');
      noticeTimer.current = null;
    }, 5000);
  }

  async function login(event) {
    event.preventDefault();
    setError('');
    if (!acc.trim() || !password) {
      setError('Please enter all fields');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured. Copy .env.example to .env.local and add the local API values.');
      return;
    }

    setBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: `${acc.trim().toLowerCase()}@login.digimessbook.local`,
        password,
      });
      if (authError) throw authError;
      supabase.functions.invoke('super-admin', { body: { action: 'record-login' } })
        .then(({ error: activityError }) => { if (activityError) console.warn('Unable to record the student login activity.', activityError); })
        .catch(activityError => console.warn('Unable to record the student login activity.', activityError));

      const { data: profile, error: profileError } = await supabase
        .from('students')
        .select('id,tenant_id,account_number,admission_number,full_name,hostel_id,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,hostels(name)')
        .eq('user_id', auth.user.id)
        .single();
      if (profileError) throw profileError;

      const { data: mealRows, error: mealError } = await supabase
        .from('meal_days')
        .select('meal_date,meal_code')
        .eq('student_id', profile.id)
        .gte('meal_date', '2026-11-01')
        .lte('meal_date', '2026-11-30')
        .order('meal_date');
      if (mealError) throw mealError;

      const { data: notificationRows, error: notificationReadError } = await supabase
        .from('student_notifications')
        .select('id,title,message,created_at,read_at')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const [settingsResult, closedDaysResult] = await Promise.all([
        supabase.from('mess_settings').select('lock_days_before,lock_time,timezone').eq('tenant_id', profile.tenant_id).maybeSingle(),
        supabase.from('mess_calendar').select('calendar_date,status').eq('tenant_id', profile.tenant_id)
          .gte('calendar_date', '2026-11-01').lte('calendar_date', '2026-11-30'),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (closedDaysResult.error) throw closedDaysResult.error;

      const days = Object.fromEntries(mealRows.map(row => [row.meal_date, row.meal_code.trim()]));
      setStudent({
        id: profile.account_number,
        name: profile.full_name,
        admissionNumber: profile.admission_number,
        room: profile.room,
        year: profile.academic_year,
        department: profile.department,
        hostel: profile.hostels?.name || 'MH NSSCE',
        email: profile.email,
        mobileNumber: profile.mobile_number,
        guardianName: profile.guardian_name,
        guardianRelation: profile.guardian_relation,
        guardianMobileNumber: profile.guardian_mobile_number,
        bloodGroup: profile.blood_group,
        foodPreference: profile.food_preference,
        days,
        studentId: profile.id,
      });
      setNotifications(notificationReadError ? [] : (notificationRows || []));
      setNotificationError('');
      setMessRules(settingsResult.data || { lock_days_before: 1, lock_time: '19:00:00', timezone: 'Asia/Kolkata' });
      setClosedDays(Object.fromEntries((closedDaysResult.data || []).map(day => [day.calendar_date, day.status])));
      if (!profile.food_preference) setFoodOpen(true);
    } catch (loginError) {
      setError(loginError.message === 'Invalid login credentials'
        ? 'Account number or password is incorrect'
        : loginError.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  function openForgotPassword() {
    setError('');
    setForgotAccountNumber(acc);
    setForgotAdmissionNumber('');
    setForgotOtp('');
    setForgotOtpSent(false);
    setForgotComplete(false);
    setForgotError('');
    setForgotMessage('');
    setForgotMode(true);
  }

  function closeForgotPassword() {
    setError('');
    setForgotMode(false);
    setForgotOtp('');
    setForgotOtpSent(false);
    setForgotComplete(false);
    setForgotError('');
    setForgotMessage('');
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    setForgotError('');
    setForgotMessage('');
    if (!supabase) {
      setForgotError('Password reset is unavailable. Please contact the mess office.');
      return;
    }
    if (!forgotAccountNumber.trim() || !forgotAdmissionNumber.trim()) {
      setForgotError('Enter your account number and admission number.');
      return;
    }
    if (forgotOtpSent && !/^\d{6}$/.test(forgotOtp.trim())) {
      setForgotError('Enter the six-digit OTP sent to your registered email.');
      return;
    }

    setForgotBusy(true);
    try {
      const action = forgotOtpSent ? 'confirm-student-password-reset' : 'request-student-password-reset';
      const body = {
        action,
        accountNumber: forgotAccountNumber.trim(),
        admissionNumber: forgotAdmissionNumber.trim(),
        ...(forgotOtpSent ? { otp: forgotOtp.trim() } : {}),
      };
      const { data, error: resetError } = await supabase.functions.invoke('super-admin', { body });
      if (resetError || data?.error) throw resetError || new Error(data.error);
      if (forgotOtpSent) {
        setForgotComplete(true);
        setForgotOtp('');
        setForgotMessage('Your password has been reset. Sign in using the default student password.');
      } else {
        setForgotOtpSent(true);
        setForgotMessage('If these details match a student record with an email on file, an OTP will be sent there.');
      }
    } catch {
      setForgotError(forgotOtpSent
        ? 'Unable to verify that OTP. Check the code and try again.'
        : 'Unable to send an OTP right now. Please try again later or contact the mess office.');
    } finally {
      setForgotBusy(false);
    }
  }

  function openDay(date) {
    setSelected(date);
    const value = student.days[keyOf(date)] || '----';
    setForm(Object.fromEntries(meals.map(([key]) => [
      key,
      value[['b', 'l', 't', 'd'].indexOf(key)] === key.toUpperCase(),
    ])));
    dismissNotice();
  }

  async function saveDay(value) {
    if (isDateLocked(selected) || !supabase) return;
    dismissNotice();
    setNotice('Updating...');
    const date = keyOf(selected);
    const { error: saveError } = await supabase.from('meal_days').upsert({
      student_id: student.studentId,
      meal_date: date,
      meal_code: value,
    }, { onConflict: 'student_id,meal_date' });
    if (saveError) {
      setNotice(saveError.message);
      return;
    }
    setStudent(current => ({ ...current, days: { ...current.days, [date]: value } }));
    showNotice('Successfully updated');
    setTimeout(() => setSelected(null), 700);
  }

  function chooseRangeDate(date) {
    if (isDateLocked(date) || savingRange) return;
    setRangeError('');
    if (!rangeStart || rangeEnd) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }
    if (date < rangeStart) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }
    if (date.getTime() === rangeStart.getTime()) {
      setRangeError('Choose an end date after the start date to select multiple days.');
      return;
    }
    const proposedRange = dates.filter(item => item >= rangeStart && item <= date);
    if (proposedRange.some(locked)) {
      setRangeError('The selected range includes a locked day. Choose unlocked days only.');
      return;
    }
    setRangeEnd(date);
  }

  async function saveDayRange(value) {
    const range = rangeStart && rangeEnd
      ? dates.filter(date => date >= rangeStart && date <= rangeEnd)
      : [];
    if (range.length < 2 || range.some(locked)) {
      setRangeError('Choose a range of at least two unlocked days.');
      return;
    }
    if (!supabase) {
      setRangeError('Supabase is not configured.');
      return;
    }
    setRangeError('');
    setSavingRange(true);
    const rows = range.map(date => ({
      student_id: student.studentId,
      meal_date: keyOf(date),
      meal_code: value,
    }));
    try {
      const { error: saveError } = await supabase
        .from('meal_days')
        .upsert(rows, { onConflict: 'student_id,meal_date' });
      if (saveError) {
        setRangeError(saveError.message);
        return;
      }
      const updatedDays = Object.fromEntries(range.map(date => [keyOf(date), value]));
      setStudent(current => ({ ...current, days: { ...current.days, ...updatedDays } }));
      setSummaryModal('');
      setRangeStart(null);
      setRangeEnd(null);
      showNotice('Successfully updated');
    } catch (saveError) {
      setRangeError(saveError.message || 'Unable to update the selected days.');
    } finally {
      setSavingRange(false);
    }
  }

  async function saveFood() {
    setFoodError('');
    if (!food.length) {
      setFoodError('Please select at least one preference.');
      return;
    }
    if (!supabase) {
      setFoodError('Supabase is not configured.');
      return;
    }
    const value = food.includes('Veg only')
      ? 'Veg only'
      : foodOptions.filter(item => item !== 'Veg only' && food.includes(item)).join(', ');
    setSavingFood(true);
    try {
      const { data: savedProfile, error: saveError } = await supabase
        .from('students')
        .update({ food_preference: value })
        .eq('id', student.studentId)
        .select('id,food_preference')
        .single();
      if (saveError) throw saveError;
      if (!savedProfile) throw new Error('The preference was not saved. Please try again.');
      const savedPreference = savedProfile.food_preference || '';
      setStudent(current => ({ ...current, foodPreference: savedPreference }));
      setFood(orderedFoodItems(savedPreference));
      setFoodOpen(false);
      showNotice('Preference saved');
    } catch (saveError) {
      setFoodError(saveError.message || 'Unable to save food preference.');
    } finally {
      setSavingFood(false);
    }
  }

  function openFoodPreferences() {
    setFood(orderedFoodItems(student.foodPreference));
    setFoodError('');
    dismissNotice();
    setFoodOpen(true);
    setDrawerOpen(false);
  }

  function openPanel(panel) {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordMessage('');
    setActivePanel(panel);
    setDrawerOpen(false);
  }

  function closePanel() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordMessage('');
    setActivePanel('');
  }

  async function updatePassword(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Enter your current password and choose a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Your new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    if (!supabase) {
      setPasswordError('Password support is unavailable because Supabase is not configured.');
      return;
    }

    setPasswordBusy(true);
    try {
      const email = `${student.id.trim().toLowerCase()}@login.digimessbook.local`;
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error(verifyError.message === 'Invalid login credentials'
          ? 'Current password is incorrect.'
          : verifyError.message);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Your password has been updated.');
    } catch (updateError) {
      setPasswordError(updateError.message || 'Unable to update your password. Please try again.');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function logout() {
    setDrawerOpen(false);
    dismissNotice();
    if (supabase) {
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) {
        setNotice(logoutError.message || 'Unable to sign out. Please try again.');
        return;
      }
    }
    setStudent(null);
    setNotifications([]);
    setSelected(null);
    setFoodOpen(false);
    setFood([]);
    setActivePanel('');
    dismissNotice();
  }

  function goToCalendar() {
    setDrawerOpen(false);
    document.getElementById('calendar-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openSummaryModal(panel) {
    if (panel === 'multiple-days') {
      setRangeStart(null);
      setRangeEnd(null);
      setRangeError('');
    }
    if (panel === 'total-bill') {
      const today = new Date();
      setSummaryMonthIsCurrent(today.getFullYear() === dates[0].getFullYear()
        && today.getMonth() === dates[0].getMonth());
    }
    setSummaryModal(panel);
  }

  function closeSummaryModal() {
    if (savingRange) return;
    setSummaryModal('');
    setRangeStart(null);
    setRangeEnd(null);
    setRangeError('');
  }

  const pathname = window.location.pathname.replace(/\/+$/, '');
  if (pathname === '/mess-count') return <MessCountPage />;
  if (pathname === '/students-list') return <StudentsListPage />;
  if (pathname === '/super-admin' || pathname.startsWith('/super-admin/')) {
    return <Suspense fallback={<main className="sa-gate"><p>Loading super-admin workspace…</p></main>}><SuperAdminPage /></Suspense>;
  }

  if (!student) {
    return (
      <main className="login-screen">
        <div className="login-shell">
          <section className="login-visual" aria-label="Digi Mess Book">
            <div className="login-blob login-blob-top" />
            <div className="login-blob login-blob-side" />
            <div className="login-brand">
              <span className="login-brand-icon"><Icon name="cloche" size={54} /></span>
              <h1>DigiMessBook</h1>
              <p>NSSCE Hostel Mess</p>
            </div>
            <CampusIllustration />
          </section>

          <section className="login-panel">
            <form className="login-form" onSubmit={forgotMode ? submitForgotPassword : login}>
              <div className="login-heading">
                <span className="eyebrow">{forgotMode ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</span>
                <h2>{forgotMode ? 'Reset your password' : 'Sign in to your mess book'}</h2>
                <p>{forgotMode
                  ? 'Verify your student details with an OTP sent to your registered email.'
                  : 'Manage your meals and keep your calendar up to date.'}</p>
              </div>

              {forgotMode ? (
                <>
                  <label className="field-label" htmlFor="reset-account-number">Account Number</label>
                  <div className="login-input-row">
                    <Icon name="account" />
                    <input
                      id="reset-account-number"
                      autoComplete="username"
                      placeholder="Enter your account number"
                      value={forgotAccountNumber}
                      onChange={event => setForgotAccountNumber(event.target.value)}
                      disabled={forgotBusy || forgotComplete}
                    />
                  </div>

                  <label className="field-label" htmlFor="reset-admission-number">Admission Number</label>
                  <div className="login-input-row">
                    <Icon name="account" />
                    <input
                      id="reset-admission-number"
                      autoComplete="off"
                      placeholder="Enter your admission number"
                      value={forgotAdmissionNumber}
                      onChange={event => setForgotAdmissionNumber(event.target.value)}
                      disabled={forgotBusy || forgotComplete}
                    />
                  </div>

                  {forgotOtpSent && !forgotComplete && (
                    <>
                      <label className="field-label" htmlFor="reset-otp">OTP</label>
                      <div className="login-input-row">
                        <Icon name="lock" />
                        <input
                          id="reset-otp"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          placeholder="Enter the six-digit OTP"
                          value={forgotOtp}
                          onChange={event => setForgotOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={forgotBusy}
                        />
                      </div>
                    </>
                  )}

                  {forgotError && <p className="login-error" role="alert">{forgotError}</p>}
                  {forgotMessage && <p className="login-success" role="status">{forgotMessage}</p>}
                  {!forgotComplete && (
                    <button className="primary-button login-submit" type="submit" disabled={forgotBusy}>
                      {forgotBusy ? 'Please wait…' : forgotOtpSent ? 'Reset password' : 'Send OTP'}
                      {!forgotBusy && <Icon name="arrow" size={20} />}
                    </button>
                  )}
                  <p className="login-help">
                    <button type="button" className="text-button" onClick={closeForgotPassword}>
                      Back to login
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <label className="field-label" htmlFor="account-number">Account Number</label>
                  <div className="login-input-row">
                    <Icon name="account" />
                    <input
                      id="account-number"
                      autoComplete="username"
                      placeholder="Enter your account number"
                      value={acc}
                      onChange={event => setAcc(event.target.value)}
                    />
                  </div>

                  <label className="field-label" htmlFor="account-password">Password</label>
                  <div className="login-input-row">
                    <Icon name="lock" />
                    <input
                      id="account-password"
                      autoComplete="current-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(value => !value)}
                    >
                      <Icon name="eye" size={20} />
                    </button>
                  </div>

                  {error && <p className="login-error" role="alert">{error}</p>}
                  <button className="primary-button login-submit" type="submit" disabled={busy}>
                    {busy ? 'Signing in…' : 'Login'}
                    {!busy && <Icon name="arrow" size={20} />}
                  </button>

                  <p className="login-help">
                    Forgot password?{' '}
                    <button type="button" className="text-button" onClick={openForgotPassword}>
                      Get Help
                    </button>
                  </p>
                </>
              )}
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {drawerOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}

      <aside className={`sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon"><Icon name="cloche" size={27} /></span>
          <span>DigiMessBook</span>
          <button type="button" className="sidebar-close icon-button" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
            <Icon name="close" />
          </button>
        </div>

        <div className="sidebar-account">
          <span className="avatar">{student.name?.trim().charAt(0).toUpperCase() || 'S'}</span>
          <span className="sidebar-account-copy">
            <b>{student.name}</b>
            <small>Acc. No: {student.id}</small>
          </span>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-label">MENU</span>
          <button type="button" className="nav-item is-active" onClick={() => setDrawerOpen(false)}>
            <Icon name="home" /><span>Home</span>
          </button>
          <button type="button" className="nav-item" onClick={() => openPanel('profile')}>
            <Icon name="user" /><span>My Profile</span>
          </button>
          <button type="button" className="nav-item" onClick={openFoodPreferences}>
            <Icon name="cloche" /><span>Food Preference</span>
          </button>
          <span className="nav-label nav-label-spaced">DASHBOARDS</span>
          <a className="nav-item nav-link" href="/mess-count" onClick={() => setDrawerOpen(false)}>
            <Icon name="calendar" /><span>Mess Count</span>
          </a>
          <a className="nav-item nav-link" href="/students-list" onClick={() => setDrawerOpen(false)}>
            <Icon name="user" /><span>Students List</span>
          </a>
          <span className="nav-label nav-label-spaced">SUPPORT</span>
          <button type="button" className="nav-item" onClick={() => openPanel('support')}>
            <Icon name="lock" /><span>Change Password</span>
          </button>
          <button type="button" className="nav-item" onClick={() => openPanel('help')}>
            <Icon name="help" /><span>Help &amp; Feedback</span>
          </button>
          <button type="button" className="nav-item" onClick={() => openPanel('about')}>
            <Icon name="info" /><span>About DigiMessBook</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="nav-item logout-item" onClick={logout}>
            <Icon name="logout" /><span>Logout</span>
          </button>
          <small>MH NSSCE · Hostel Mess</small>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-inner">
            <button type="button" className="icon-button menu-trigger" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
              <Icon name="menu" size={25} />
            </button>
            <span className="mobile-brand"><Icon name="cloche" size={23} />DigiMessBook</span>
            <span className="topbar-context">Student dashboard</span>
            <div className="notification-wrap">
              <button type="button" className="icon-button notification-button" aria-label={`Notifications${notifications.some(item => !item.read_at) ? `, ${notifications.filter(item => !item.read_at).length} unread` : ''}`} aria-expanded={notificationsOpen} onClick={async () => {
                const opening = !notificationsOpen;
                setNotificationsOpen(opening);
                setNotificationError('');
                let currentNotifications = notifications;
                if (opening && supabase) {
                  const { data: latestNotifications, error: fetchError } = await supabase.from('student_notifications')
                    .select('id,title,message,created_at,read_at').eq('student_id', student.studentId)
                    .order('created_at', { ascending: false }).limit(20);
                  if (!fetchError) {
                    currentNotifications = latestNotifications || [];
                    setNotifications(currentNotifications);
                  } else setNotificationError(fetchError.message || 'Unable to load notifications.');
                }
                const unreadIds = currentNotifications.filter(item => !item.read_at).map(item => item.id);
                if (opening && unreadIds.length && supabase) {
                  const readAt = new Date().toISOString();
                  const { error: readError } = await supabase.from('student_notifications').update({ read_at: readAt }).in('id', unreadIds);
                  if (!readError) setNotifications(currentNotifications.map(item => unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item));
                  else setNotificationError(readError.message || 'Unable to mark notifications as read.');
                }
              }}>
                <Icon name="bell" />
                {notifications.some(item => !item.read_at) && <i />}
              </button>
              {notificationsOpen && (
                <div className="notification-popover" role="status" aria-label="Your notifications">
                  <b>{notifications.length ? 'Notifications' : 'You’re all caught up'}</b>
                  {notificationError && <p className="student-notification-error" role="alert">{notificationError}</p>}
                  {notifications.length ? notifications.map(item => (
                    <div className="student-notification" key={item.id}>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      <div className="student-notification-footer"><small>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(item.created_at))}</small>{item.read_at && <button type="button" className="student-notification-remove" onClick={() => removeReadNotification(item.id)}>Remove</button>}</div>
                    </div>
                  )) : <p>Meal updates and reminders will appear here.</p>}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="welcome-row">
            <div>
              <p className="greeting">{getGreeting()},</p>
              <h1 ref={welcomeNameRef} className="welcome-student-name">{student.name} <span aria-hidden="true">👋</span></h1>
              <p className="welcome-meta">{student.hostel} <span>·</span> Room {student.room}</p>
            </div>
            <div className="welcome-account"><span className="avatar avatar-small">{student.name?.trim().charAt(0).toUpperCase() || 'S'}</span><span>Account<b>{student.id}</b></span></div>
          </section>

          <section className="surface-card calendar-card" id="calendar-card">
              {notice && (
                <div className={`notice-banner ${notice === 'Updating...' ? 'is-pending' : ''} ${notice === 'Successfully updated' || notice === 'Preference saved' || notice === 'Updating...' ? '' : 'is-error'}`} role="status" aria-live="polite">
                  <span>{notice}</span>
                  <button type="button" aria-label="Dismiss message" onClick={dismissNotice}><Icon name="close" size={17} /></button>
                </div>
              )}
              <div className="section-heading calendar-heading">
                <div>
                  <span className="section-icon"><Icon name="calendar" /></span>
                  <div><h2>Meal Calendar</h2><p>Choose a day to view or update your meals</p></div>
                </div>
                <span className="month-pill">November 2026</span>
              </div>

              <div className="calendar-weekdays" aria-hidden="true">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
              </div>
              <div className="calendar-days">
                {Array(dates[0].getDay()).fill(0).map((_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}
                {dates.map((date, index) => {
                  const v = student.days[keyOf(date)] || '----';
                  const cut = v === '----';
                  const prevCut = index > 0 && (student.days[keyOf(dates[index - 1])] || '') === '----';
                  const nextCut = index < dates.length - 1 && (student.days[keyOf(dates[index + 1])] || '') === '----';
                  const adj = cut && (prevCut || nextCut);
                  return (
                    <button
                      type="button"
                      key={keyOf(date)}
                      className={`day ${isDateLocked(date) ? 'locked' : ''} ${isToday(date) ? 'is-today' : ''} ${selected && keyOf(selected) === keyOf(date) ? 'is-selected' : ''}`}
                      aria-label={`${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${isDateLocked(date) ? ', locked' : ''}`}
                      onClick={() => openDay(date)}
                    >
                      <span>{date.getDate()}</span>
                      <i className="day-dot" style={{ background: cut ? (adj ? '#d22' : '#f1ca28') : '#4caf50' }} />
                    </button>
                  );
                })}
              </div>

              <div className="calendar-legend" aria-label="Calendar status key">
                <span><i className="legend-dot present" />Meals selected</span>
                <span><i className="legend-dot single-cut" />Single mess cut</span>
                <span><i className="legend-dot adjacent-cut" />Adjacent mess cuts</span>
              </div>
          </section>

          <div className="dashboard-lower-grid">
            <section className="surface-card summary-card" aria-labelledby="summary-title">
              <div className="summary-heading">
                <span className="summary-heading-icon"><Icon name="calendar" size={42} /></span>
                <h2 id="summary-title">Mess Summary <span>– November at a glance</span></h2>
              </div>
              <div className="summary-items">
                <button type="button" className="summary-item summary-billable" onClick={goToCalendar}>
                  <span className="summary-item-icon"><Icon name="lunch" size={38} /></span>
                  <span className="summary-item-divider" />
                  <span className="summary-item-copy"><b>{total}</b><span>Billable Days</span></span>
                  <Icon name="chevron" className="summary-item-chevron" size={30} />
                </button>
                <button type="button" className="summary-item summary-extras" onClick={() => openSummaryModal('extra-dishes')}>
                  <span className="summary-item-icon"><Icon name="cloche" size={38} /></span>
                  <span className="summary-item-divider" />
                  <span className="summary-item-copy"><b>₹ 0</b><span>Extra Dishes</span></span>
                  <Icon name="chevron" className="summary-item-chevron" size={30} />
                </button>
                <button type="button" className="summary-item summary-total" onClick={() => openSummaryModal('total-bill')}>
                  <span className="summary-item-icon"><Icon name="receipt" size={38} /></span>
                  <span className="summary-item-divider" />
                  <span className="summary-item-copy"><b>N/A</b><span>Total Bill</span></span>
                  <Icon name="chevron" className="summary-item-chevron" size={30} />
                </button>
              </div>
              <p className="summary-hint">Select an item to see more details</p>
            </section>

            <div className="dashboard-secondary-column">
              <button type="button" className="outline-button multiple-days-button" onClick={() => openSummaryModal('multiple-days')}>
                <Icon name="calendar" size={24} />
                <span>Update Multiple Days</span>
                <Icon name="chevron" className="multiple-days-chevron" size={22} />
              </button>

              <div className="dashboard-preference-row">
                <section className="surface-card preference-card">
                  <div className="preference-card-header">
                    <div className="preference-card-heading">
                      <span className="section-icon"><Icon name="cloche" /></span>
                      <div className="preference-card-copy"><h2>Food Preference</h2><p>Your selected meal options</p></div>
                    </div>
                    <button type="button" className="outline-button preference-action" onClick={openFoodPreferences}>
                      <Icon name="edit" size={17} />Edit
                    </button>
                  </div>
                  <div className="preference-value-row">
                    <p className="preference-value">{orderedFoodPreference(student.foodPreference) || 'Not set yet'}</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>

        <nav className="bottom-nav" aria-label="Quick navigation">
          <button type="button" className="bottom-nav-item is-active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Icon name="home" /><span>Home</span></button>
          <button type="button" className="bottom-nav-item" onClick={goToCalendar}><Icon name="calendar" /><span>History</span></button>
          <button type="button" className="bottom-nav-item" onClick={() => openPanel('profile')}><Icon name="user" /><span>Profile</span></button>
        </nav>
      </div>

      {selected && (
        <div className="modal-backdrop">
          <section className="modal-card day-modal" role="dialog" aria-modal="true" aria-labelledby="day-modal-title">
            <div className="sheet-handle" />
            <header className="modal-header">
              <span className="section-icon"><Icon name="calendar" /></span>
              <div><span className="eyebrow">MEAL SELECTION</span><h2 id="day-modal-title">{selected.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h2></div>
              <button type="button" className="icon-button modal-close" aria-label="Close day details" onClick={() => setSelected(null)}><Icon name="close" /></button>
            </header>
            <h3 className="modal-section-title">Select Meals</h3>
            <div className="meal-options">
              {meals.map(([key, label, icon]) => (
                <label className="meal-option" key={key}>
                  <input type="checkbox" disabled={isDateLocked(selected)} checked={!!form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.checked }))} />
                  <Icon name={icon} size={25} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="day-status">
              <b>Day Status</b>
              <span><i />{closedDays[keyOf(selected)] === 'closed' ? 'Mess Closed · contact the mess administrator' : isDateLocked(selected) ? `Locked · deadline was ${lockDeadline(selected, messRules)}` : `Editable until ${lockDeadline(selected, messRules)}`}</span>
            </div>
            {notice && <p className={`modal-notice ${notice === 'Updating...' ? 'is-pending' : ''}`} role="status">{notice}</p>}
            <div className="modal-actions">
              <button type="button" className="outline-button cancel-day-button" onClick={() => setSelected(null)}>Cancel</button>
              <button type="button" className="outline-button update-day-button" disabled={isDateLocked(selected)} onClick={() => saveDay(meals.map(([key]) => form[key] ? key.toUpperCase() : '-').join(''))}>Update</button>
            </div>
            <div className="quick-actions">
              <button type="button" className="primary-button quick-full-day" disabled={isDateLocked(selected)} onClick={() => saveDay('BLTD')}>Full Day</button>
              <button type="button" className="quick-mess-cut" disabled={isDateLocked(selected)} onClick={() => saveDay('----')}>Mess Cut</button>
            </div>
          </section>
        </div>
      )}

      {foodOpen && (
        <div className="modal-backdrop">
          <section className="modal-card food-modal" role="dialog" aria-modal="true" aria-labelledby="food-modal-title">
            <div className="sheet-handle" />
            <header className="modal-header">
              <span className="section-icon"><Icon name="cloche" /></span>
              <div><span className="eyebrow">YOUR MEAL PLAN</span><h2 id="food-modal-title">Food Preference</h2></div>
              <button type="button" className="icon-button modal-close" aria-label="Close food preferences" disabled={!student.foodPreference || savingFood} onClick={() => student.foodPreference && setFoodOpen(false)}><Icon name="close" /></button>
            </header>
            <p className="modal-intro">Select the foods you would like included in your mess preference.</p>
            <div className="food-options">
              {foodOptions.map(item => (
                <label className="food-option" key={item}>
                  <span>{item}</span>
                  <input
                    type="checkbox"
                    disabled={savingFood}
                    checked={food.includes(item)}
                    onChange={event => {
                      setFoodError('');
                      setFood(current => event.target.checked
                        ? item === 'Veg only' ? [item] : [...current.filter(value => value !== 'Veg only'), item]
                        : current.filter(value => value !== item));
                    }}
                  />
                </label>
              ))}
            </div>
            {foodError && <p className="food-error" role="alert">{foodError}</p>}
            <div className="modal-actions">
              <button type="button" className="outline-button" disabled={savingFood} onClick={() => student.foodPreference && setFoodOpen(false)}>Cancel</button>
              <button type="button" className="primary-button" disabled={savingFood} onClick={saveFood}>{savingFood ? 'Saving…' : 'Save'}</button>
            </div>
          </section>
        </div>
      )}

      {summaryModal && (
        <div className="modal-backdrop">
          <section className="modal-card summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-modal-title">
            <div className="sheet-handle" />
            <header className="modal-header">
              <span className="section-icon"><Icon name={summaryModal === 'total-bill' ? 'receipt' : summaryModal === 'multiple-days' ? 'calendar' : 'cloche'} /></span>
              <div>
                <span className="eyebrow">NOVEMBER 2026</span>
                <h2 id="summary-modal-title">{summaryModal === 'extra-dishes' ? 'Extra Dishes' : summaryModal === 'total-bill' ? 'Total Bill' : 'Update Multiple Days'}</h2>
              </div>
              <button type="button" className="icon-button modal-close" aria-label="Close summary details" disabled={summaryModal === 'multiple-days' && savingRange} onClick={closeSummaryModal}><Icon name="close" /></button>
            </header>

            {summaryModal === 'extra-dishes' && (
              <div className="summary-empty-state">
                <span className="summary-empty-icon"><Icon name="cloche" size={29} /></span>
                <h3>No extra dishes recorded</h3>
                <p>Extra dish selections for November 2026 will appear here.</p>
              </div>
            )}

            {summaryModal === 'total-bill' && (
              <div className="summary-bill-details">
                <div className="summary-bill-amount"><span>Total for November</span><b>{summaryMonthIsCurrent ? 'N/A' : 'Not uploaded'}</b></div>
                {summaryMonthIsCurrent ? (
                  <p className="summary-bill-message">Bill not generated yet</p>
                ) : (
                  <div className="summary-empty-state summary-bill-empty">
                    <p>No bill has been uploaded for November 2026 yet. The bill split-up will appear here when available.</p>
                  </div>
                )}
              </div>
            )}

            {summaryModal === 'multiple-days' && (
              <div className="range-picker">
                <p className="range-instructions">Select a start and end date. Locked days are unavailable, and every day between your choices will be included.</p>
                <div className="range-selection-status" aria-live="polite">
                  {rangeStart && rangeEnd
                    ? `${rangeStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${rangeEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${selectedRangeDates.length} days`
                    : rangeStart
                      ? `Start: ${rangeStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Choose an end date.`
                      : 'Choose an available start date.'}
                </div>
                <div className="range-weekdays" aria-hidden="true">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
                </div>
                <div className="range-days" aria-label="Select a continuous date range">
                  {Array(dates[0].getDay()).fill(0).map((_, index) => <span className="range-empty" key={`range-empty-${index}`} />)}
                  {dates.map(date => {
                    const isStart = !!rangeStart && keyOf(rangeStart) === keyOf(date);
                    const isEnd = !!rangeEnd && keyOf(rangeEnd) === keyOf(date);
                    const isInRange = !!rangeStart && !!rangeEnd && date > rangeStart && date < rangeEnd;
                    const unavailable = isDateLocked(date);
                    return (
                      <button
                        type="button"
                        key={keyOf(date)}
                        className={`range-day ${unavailable ? 'is-locked' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''} ${isInRange ? 'is-in-range' : ''}`}
                        disabled={unavailable || savingRange}
                        aria-pressed={isStart || isEnd || isInRange}
                        aria-label={`${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${unavailable ? ', locked' : ''}`}
                        onClick={() => chooseRangeDate(date)}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
                {rangeError && <p className="range-error" role="alert">{rangeError}</p>}
                <div className="range-modal-actions">
                  <button type="button" className="outline-button range-cancel" disabled={savingRange} onClick={closeSummaryModal}>Cancel</button>
                  <button type="button" className="primary-button range-full-day" disabled={!rangeReady || savingRange} onClick={() => saveDayRange('BLTD')}>{savingRange ? 'Updating…' : 'Full Day'}</button>
                  <button type="button" className="outline-button range-mess-cut" disabled={!rangeReady || savingRange} onClick={() => saveDayRange('----')}>Mess Cut</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activePanel && (
        <div className="modal-backdrop">
          <section className={`modal-card info-modal ${activePanel === 'support' && passwordMessage ? 'password-updated-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
            <div className="sheet-handle" />
            <header className="modal-header">
              <span className="section-icon"><Icon name={activePanel === 'profile' ? 'user' : activePanel === 'support' ? 'lock' : activePanel === 'help' ? 'help' : 'info'} /></span>
              <div><span className="eyebrow">DIGIMESSBOOK</span><h2 id="info-modal-title">{activePanel === 'profile' ? 'My Profile' : activePanel === 'support' ? 'Change Password' : activePanel === 'help' ? 'Help & Feedback' : 'About DigiMessBook'}</h2></div>
              <button type="button" className="icon-button modal-close" aria-label="Close" onClick={closePanel}><Icon name="close" /></button>
            </header>
            {activePanel === 'profile' ? (
              <div className="profile-details">
                <div className="profile-identity"><span className="avatar avatar-large">{student.name?.trim().charAt(0).toUpperCase() || 'S'}</span><div><b>{student.name}</b><span>{student.hostel}</span></div></div>
                <dl>{[
                  ['Admission number', student.admissionNumber],
                  ['Account number', student.id],
                  ['Hostel', student.hostel],
                  ['Room number', student.room],
                  ['Email ID', student.email],
                  ['Mobile number', student.mobileNumber],
                  ['Year', student.year],
                  ['Department', student.department],
                  ['Guardian name', student.guardianName],
                  ['Guardian relation', student.guardianRelation],
                  ['Guardian mobile number', student.guardianMobileNumber],
                  ['Blood group', student.bloodGroup],
                  ['Food preference', orderedFoodPreference(student.foodPreference) || 'Not set'],
                ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
                <button type="button" className="outline-button profile-edit" onClick={() => { setActivePanel(''); openFoodPreferences(); }}>Edit food preference</button>
              </div>
            ) : activePanel === 'support' ? (
              passwordMessage ? (
                <div className="password-support-complete" role="status">{passwordMessage}</div>
              ) : (
                <div className="info-copy">
                  <p>Change your password securely from your signed-in account.</p>
                  <form className="support-password-form" onSubmit={updatePassword}>
                    <label className="field-label" htmlFor="current-password">Current password</label>
                    <input
                      className="support-password-input"
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={event => setCurrentPassword(event.target.value)}
                      required
                    />
                    <label className="field-label" htmlFor="new-password">New password</label>
                    <input
                      className="support-password-input"
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      value={newPassword}
                      onChange={event => setNewPassword(event.target.value)}
                      required
                    />
                    <label className="field-label" htmlFor="confirm-new-password">Confirm new password</label>
                    <input
                      className="support-password-input"
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      required
                    />
                    {passwordError && <p className="password-support-error" role="alert">{passwordError}</p>}
                    <button className="primary-button support-password-submit" type="submit" disabled={passwordBusy}>
                      {passwordBusy ? 'Updating…' : 'Update password'}
                    </button>
                  </form>
                </div>
              )
            ) : activePanel === 'help' ? (
              <div className="info-copy"><p>For help with your account, meal preferences, or mess calendar, contact the MH NSSCE hostel mess office.</p><p>Your selected meals are saved to your student account when you choose <b>Update</b>.</p></div>
            ) : (
              <div className="info-copy"><p>DigiMessBook helps NSSCE hostel residents manage daily meal selections and food preferences.</p><p className="about-hostel">{student.hostel} · Student meal calendar</p></div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
