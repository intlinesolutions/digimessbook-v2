import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localEnvPaths = [
  fileURLToPath(new URL('../supabase/.env.local', import.meta.url)),
  fileURLToPath(new URL('./.env.local', import.meta.url)),
];

function readEnvFile(path) {
  let source = '';
  try { source = readFileSync(path, 'utf8'); } catch { return {}; }
  return Object.fromEntries(source.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    return [[match[1], value]];
  }));
}

const env = localEnvPaths.reduce((values, path) => ({ ...values, ...readEnvFile(path) }), {});
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = env.VITE_SUPABASE_ANON_KEY || '';
const allAccessibleHostels = 'all-accessible';

function writeJson(response, status, data) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let source = '';
  for await (const chunk of request) {
    source += chunk;
    if (source.length > 1_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  return JSON.parse(source || '{}');
}

async function responseJson(response) {
  const source = await response.text();
  const data = source ? JSON.parse(source) : null;
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.msg || data?.error || `Supabase request failed (${response.status}).`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

async function selectRows(table, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(`/rest/v1/${table}`, supabaseUrl);
    for (const [key, value] of Object.entries(filters)) {
      for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item);
    }
    const result = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Range: `${offset}-${offset + 999}`,
      },
    }).then(responseJson);
    rows.push(...(result || []));
    if (!result || result.length < 1000) return rows;
  }
}

function inFilter(values) {
  return `in.(${values.map(value => JSON.stringify(String(value))).join(',')})`;
}

async function resolveScope(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
  const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  }).then(responseJson);
  const metadata = user?.app_metadata || {};
  if (metadata.role !== 'mess_admin' && metadata.mess_admin !== true) {
    throw Object.assign(new Error('This account does not have mess-admin access.'), { status: 403 });
  }
  const names = [...new Set((Array.isArray(metadata.mess_admin_hostels) ? metadata.mess_admin_hostels : [])
    .map(name => String(name).trim()).filter(Boolean))];
  if (!names.length) throw Object.assign(new Error('No hostels are assigned to this mess-admin account.'), { status: 403 });

  const tenants = await selectRows('tenants', { select: 'id', slug: 'eq.mh-nssce-demo', limit: '1' });
  const tenant = tenants[0];
  if (!tenant) throw Object.assign(new Error('The mess hostels are not configured.'), { status: 404 });
  const hostels = await selectRows('hostels', {
    select: 'id,name,tenant_id', tenant_id: `eq.${tenant.id}`, name: inFilter(names), order: 'name.asc',
  });
  if (new Set(hostels.map(hostel => hostel.name)).size !== names.length) {
    throw Object.assign(new Error('The hostel access assigned to this account is invalid.'), { status: 403 });
  }
  return { user, hostels, hostelIds: hostels.map(hostel => hostel.id) };
}

async function getStudent(studentId, scope) {
  if (!studentId) throw Object.assign(new Error('Choose a student first.'), { status: 400 });
  const students = await selectRows('students', {
    select: 'id,tenant_id,hostel_id,account_number,admission_number,full_name,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,hostels(name)',
    id: `eq.${studentId}`, hostel_id: inFilter(scope.hostelIds), limit: '1',
  });
  if (!students[0]) throw Object.assign(new Error('Student not found in your hostel access range.'), { status: 404 });
  return students[0];
}

function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(new Error('Choose a valid calendar month.'), { status: 400 });
  const start = `${month}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const endDate = new Date(next.getTime() - 86400000);
  const end = endDate.toISOString().slice(0, 10);
  const mealStartDate = new Date(`${start}T00:00:00Z`);
  mealStartDate.setUTCDate(mealStartDate.getUTCDate() - 1);
  const mealEndDate = new Date(endDate);
  mealEndDate.setUTCDate(mealEndDate.getUTCDate() + 1);
  return { start, end, mealStart: mealStartDate.toISOString().slice(0, 10), mealEnd: mealEndDate.toISOString().slice(0, 10) };
}

async function loadStudentMonth(student, month) {
  const { start, end, mealStart, mealEnd } = monthRange(month);
  const [meals, closedDays] = await Promise.all([
    selectRows('meal_days', {
      select: 'meal_date,meal_code', student_id: `eq.${student.id}`,
      meal_date: [`gte.${mealStart}`, `lte.${mealEnd}`], order: 'meal_date.asc',
    }),
    selectRows('mess_calendar', {
      select: 'calendar_date,status', tenant_id: `eq.${student.tenant_id}`,
      calendar_date: [`gte.${start}`, `lte.${end}`], order: 'calendar_date.asc',
    }),
  ]);
  return { student, meals, closedDays };
}

function countBillableDays(mealsByDate, month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  let total = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (!mealsByDate.has(date)) continue;
    if (mealsByDate.get(date) !== '----') {
      total += 1;
      continue;
    }
    const previous = shiftDateKey(date, -1);
    const next = shiftDateKey(date, 1);
    if (mealsByDate.get(previous) !== '----' && mealsByDate.get(next) !== '----') total += 1;
  }
  return total;
}

async function loadDaysDownload(scope, month) {
  const { mealStart, mealEnd } = monthRange(month);
  const students = await selectRows('students', {
    select: 'id,account_number,room,full_name,hostel_id,academic_year,department,hostels(name)',
    hostel_id: inFilter(scope.hostelIds), order: 'account_number.asc',
  });
  const mealRows = await selectRows('meal_days', {
    select: 'student_id,meal_date,meal_code,students!inner(hostel_id)',
    'students.hostel_id': inFilter(scope.hostelIds),
    meal_date: [`gte.${mealStart}`, `lte.${mealEnd}`],
  });
  const mealsByStudent = new Map();
  for (const meal of mealRows) {
    if (!mealsByStudent.has(meal.student_id)) mealsByStudent.set(meal.student_id, new Map());
    mealsByStudent.get(meal.student_id).set(meal.meal_date, String(meal.meal_code || '----').trim());
  }
  return {
    month,
    students: students.map(student => ({
      ...student,
      days: countBillableDays(mealsByStudent.get(student.id) || new Map(), month),
      finedDays: null,
      extrasTotal: null,
    })),
  };
}

async function mealsForStudents(studentIds, date) {
  const meals = [];
  for (let index = 0; index < studentIds.length; index += 150) {
    const ids = studentIds.slice(index, index + 150);
    meals.push(...await selectRows('meal_days', {
      select: 'student_id,meal_code', student_id: inFilter(ids), meal_date: `eq.${date}`,
    }));
  }
  return meals;
}

function indiaDateKey(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDateKey(dateKey, amount) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function loadDashboard(scope) {
  const students = await selectRows('students', {
    select: 'id,tenant_id,hostel_id,account_number,admission_number,full_name,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,hostels(name)',
    hostel_id: inFilter(scope.hostelIds), order: 'account_number.asc',
  });
  const today = indiaDateKey();
  const tomorrow = shiftDateKey(today, 1);
  const lastWeekStart = shiftDateKey(today, -6);
  const chartStart = shiftDateKey(today, -2);
  const chartEnd = shiftDateKey(today, 4);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const totalDaysThisMonth = new Date(nextMonth.getTime() - 86400000).getUTCDate();
  const mealRows = await selectRows('meal_days', {
    select: 'meal_date,meal_code,student_id,students!inner(hostel_id)',
    'students.hostel_id': inFilter(scope.hostelIds),
    meal_date: [`gte.${lastWeekStart}`, `lte.${chartEnd}`], order: 'meal_date.asc',
  });
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateKey(chartStart, index);
    const rows = mealRows.filter(row => row.meal_date === date);
    return {
      date,
      label: `${new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(`${date}T00:00:00Z`))} ${Number(date.slice(-2))}`,
      isToday: date === today,
      present: rows.filter(row => String(row.meal_code || '').trim() !== '----').length,
      cut: rows.filter(row => String(row.meal_code || '').trim() === '----').length,
    };
  });
  const dayTotals = date => {
    const present = mealRows.filter(row => row.meal_date === date && String(row.meal_code || '').trim() !== '----').length;
    const total = students.length;
    return { present, total, percent: total ? Math.round(present / total * 100) : 0 };
  };
  return {
    hostels: scope.hostels, students,
    adminName: scope.user.user_metadata?.full_name || scope.user.email?.split('@')[0] || 'Mess admin',
    metrics: {
      today: dayTotals(today), tomorrow: dayTotals(tomorrow),
      cutThisWeek: mealRows.filter(row => row.meal_date >= lastWeekStart && row.meal_date <= today && String(row.meal_code || '').trim() === '----').length,
      extrasAmountThisMonth: null, totalDaysThisMonth, finedDaysThisMonth: null,
    },
    week,
  };
}

async function handleAction(request, body) {
  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw Object.assign(new Error('Local mess-admin API is not configured. Check client/.env.local and supabase/.env.local.'), { status: 503 });
  }
  const scope = await resolveScope(request);
  if (body.action === 'scope') return { hostels: scope.hostels };

  if (body.action === 'dashboard') {
    return loadDashboard(scope);
  }

  if (body.action === 'student-month') {
    const student = await getStudent(String(body.studentId || ''), scope);
    return loadStudentMonth(student, String(body.month || ''));
  }

  if (body.action === 'days-download') {
    return loadDaysDownload(scope, String(body.month || ''));
  }

  if (body.action === 'students-list') {
    const hostelId = String(body.hostelId || '');
    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error('Choose a valid date.'), { status: 400 });
    if (!scope.hostelIds.includes(hostelId)) throw Object.assign(new Error('That hostel is outside your access range.'), { status: 403 });
    const students = await selectRows('students', {
      select: 'id,account_number,room,full_name', hostel_id: `eq.${hostelId}`, order: 'account_number.asc',
    });
    const meals = await mealsForStudents(students.map(student => student.id), date);
    const statusByStudent = new Map(meals.map(row => [row.student_id, String(row.meal_code || '----').trim() === '----']));
    return { students: students.map(student => ({ ...student, is_mess_cut: statusByStudent.get(student.id) ?? true })) };
  }

  if (body.action === 'mess-count') {
    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error('Choose a valid date.'), { status: 400 });
    const hostelId = String(body.hostelId || '');
    const hostels = hostelId === allAccessibleHostels
      ? scope.hostels
      : scope.hostels.filter(hostel => hostel.id === hostelId);
    if (!hostels.length) throw Object.assign(new Error('That hostel is outside your access range.'), { status: 403 });
    const students = await selectRows('students', {
      select: 'id,food_preference', hostel_id: inFilter(hostels.map(hostel => hostel.id)),
    });
    const meals = await mealsForStudents(students.map(student => student.id), date);
    const mealByStudent = new Map(meals.map(row => [row.student_id, String(row.meal_code || '----').trim()]));
    const totals = [
      { meal: 'Breakfast', index: 0, code: 'B' }, { meal: 'Lunch', index: 1, code: 'L' },
      { meal: 'Tea', index: 2, code: 'T' }, { meal: 'Dinner', index: 3, code: 'D' },
    ].map(({ meal, index, code }) => {
      const row = { meal, meal_count: 0, veg: 0, chicken: 0, fish: 0, egg: 0, beef: 0 };
      for (const student of students) {
        if ((mealByStudent.get(student.id) || '----').charAt(index) !== code) continue;
        row.meal_count += 1;
        const preferences = String(student.food_preference || '').split(',').map(value => value.trim().toLowerCase());
        for (const preference of ['veg only', 'chicken', 'fish', 'egg', 'beef']) {
          if (preferences.includes(preference)) row[preference === 'veg only' ? 'veg' : preference] += 1;
        }
      }
      return row;
    });
    return { rows: totals };
  }

  throw Object.assign(new Error('Unknown mess-admin action.'), { status: 400 });
}

export function messAdminDevApi() {
  return {
    name: 'mess-admin-local-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/__mess-admin') return next();
        if (request.method === 'OPTIONS') return writeJson(response, 200, { ok: true });
        if (request.method !== 'POST') return writeJson(response, 405, { error: 'Method not allowed.' });
        try {
          const body = await readJson(request);
          const data = await handleAction(request, body);
          return writeJson(response, 200, data);
        } catch (error) {
          const status = Number(error?.status) || 400;
          return writeJson(response, status, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
