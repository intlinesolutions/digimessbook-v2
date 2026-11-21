import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const adminDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const allAccessibleHostels = 'all-accessible';

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const detail = error as Record<string, unknown>;
    const parts = [detail.message, detail.details, detail.hint, detail.code]
      .filter(value => typeof value === 'string' && value.trim()) as string[];
    return parts.join(' · ') || JSON.stringify(error);
  }
  return String(error);
}

function isMissingMonthlyChargesTable(error: unknown) {
  const detail = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const message = String(detail.message || error || '').toLowerCase();
  return detail.code === 'PGRST205'
    || (message.includes('schema cache') && message.includes('student_monthly_charges'));
}

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function fetchAllRows(buildQuery: (from: number, to: number) => any) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await buildQuery(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function requireMessAdmin(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Sign in to continue.', 401);
  const { data: { user }, error } = await adminDb.auth.getUser(token);
  if (error || !user) throw fail('Your session has expired. Sign in again.', 401);
  const metadata = user.app_metadata || {};
  if (metadata.role !== 'mess_admin' && metadata.mess_admin !== true) {
    throw fail('This account does not have mess-admin access.', 403);
  }

  const hostelNames = [...new Set((Array.isArray(metadata.mess_admin_hostels) ? metadata.mess_admin_hostels : [])
    .map((name: unknown) => String(name).trim()).filter(Boolean))];
  if (!hostelNames.length) throw fail('No hostels are assigned to this mess-admin account.', 403);

  const { data: tenant, error: tenantError } = await adminDb.from('tenants').select('id')
    .eq('slug', 'mh-nssce-demo').maybeSingle();
  if (tenantError) throw tenantError;
  if (!tenant) throw fail('The mess hostels are not configured.', 404);
  const { data: hostels, error: hostelError } = await adminDb.from('hostels').select('id,name,tenant_id')
    .eq('tenant_id', tenant.id).in('name', hostelNames).order('name');
  if (hostelError) throw hostelError;
  const scopedHostels = (hostels || []).filter(hostel => hostelNames.includes(hostel.name));
  const resolvedNames = new Set(scopedHostels.map(hostel => hostel.name));
  if (resolvedNames.size !== hostelNames.length) throw fail('The hostel access assigned to this account is invalid.', 403);
  return { user, hostels: scopedHostels, hostelIds: scopedHostels.map(hostel => hostel.id) };
}

async function getScopedStudent(studentId: string, scope: { hostelIds: string[] }) {
  if (!studentId) throw fail('Choose a student first.');
  const { data, error } = await adminDb.from('students')
    .select('id,tenant_id,hostel_id,account_number,admission_number,full_name,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,hostels(name)')
    .eq('id', studentId).in('hostel_id', scope.hostelIds).maybeSingle();
  if (error) throw error;
  if (!data) throw fail('Student not found in your hostel access range.', 404);
  return data;
}

function monthDates(month: string) {
  const start = `${month}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = new Date(next.getTime() - 86400000).toISOString().slice(0, 10);
  const mealStartDate = new Date(`${start}T00:00:00Z`);
  mealStartDate.setUTCDate(mealStartDate.getUTCDate() - 1);
  const mealEndDate = new Date(`${end}T00:00:00Z`);
  mealEndDate.setUTCDate(mealEndDate.getUTCDate() + 1);
  return { start, end, mealStart: mealStartDate.toISOString().slice(0, 10), mealEnd: mealEndDate.toISOString().slice(0, 10) };
}

async function loadStudentMonth(student: any, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw fail('Choose a valid calendar month.');
  const { start, end, mealStart, mealEnd } = monthDates(month);
  const [meals, closedDays] = await Promise.all([
    fetchAllRows((from, to) => adminDb.from('meal_days').select('meal_date,meal_code').eq('student_id', student.id)
      .gte('meal_date', mealStart).lte('meal_date', mealEnd).order('meal_date').range(from, to)),
    adminDb.from('mess_calendar').select('calendar_date,status').eq('tenant_id', student.tenant_id)
      .gte('calendar_date', start).lte('calendar_date', end),
  ]);
  if (closedDays.error) throw closedDays.error;
  return { student, meals, closedDays: closedDays.data || [] };
}

function billableDayCount(mealsByDate: Map<string, string>, month: string) {
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
    if (mealsByDate.get(shiftDateKey(date, -1)) !== '----'
      && mealsByDate.get(shiftDateKey(date, 1)) !== '----') total += 1;
  }
  return total;
}

async function loadDaysDownload(scope: { hostels: any[]; hostelIds: string[] }, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw fail('Choose a valid calendar month.');
  const { mealStart, mealEnd } = monthDates(month);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const students = await fetchAllRows((from, to) => adminDb.from('students')
    .select('id,account_number,room,full_name,hostel_id,academic_year,department,hostels(name)')
    .in('hostel_id', scope.hostelIds).order('account_number').range(from, to));
  const mealRows = await fetchAllRows((from, to) => adminDb.from('meal_days')
    .select('student_id,meal_date,meal_code,students!inner(hostel_id)')
    .in('students.hostel_id', scope.hostelIds).gte('meal_date', mealStart).lte('meal_date', mealEnd).range(from, to));
  let chargeRows = [];
  try {
    chargeRows = await fetchAllRows((from, to) => adminDb.from('student_monthly_charges')
      .select('student_id,extras_total,fine_days,fine_total,students!inner(hostel_id)')
      .in('students.hostel_id', scope.hostelIds).eq('bill_month', `${month}-01`).range(from, to));
  } catch (error) {
    if (!isMissingMonthlyChargesTable(error)) throw error;
  }
  const mealsByStudent = new Map<string, Map<string, string>>();
  for (const meal of mealRows) {
    if (!mealsByStudent.has(meal.student_id)) mealsByStudent.set(meal.student_id, new Map());
    mealsByStudent.get(meal.student_id)!.set(meal.meal_date, String(meal.meal_code || '----').trim());
  }
  const chargesByStudent = new Map((chargeRows || []).map(row => [row.student_id, row]));
  return {
    month,
    students: students.map(student => ({
      ...student,
      days: billableDayCount(mealsByStudent.get(student.id) || new Map(), month),
      dailyStatuses: Array.from({ length: daysInMonth }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const mealCode = mealsByStudent.get(student.id)?.get(date);
        return mealCode == null ? '' : mealCode === '----' ? 'X' : '·';
      }),
      finedDays: Number(chargesByStudent.get(student.id)?.fine_days || 0),
      fineTotal: Number(chargesByStudent.get(student.id)?.fine_total || 0),
      extrasTotal: Number(chargesByStudent.get(student.id)?.extras_total || 0),
    })),
  };
}

function indiaDateKey(date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDateKey(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function loadDashboard(scope: { hostels: any[]; hostelIds: string[]; user: any }) {
  const students = await fetchAllRows((from, to) => adminDb.from('students')
    .select('id,tenant_id,hostel_id,account_number,admission_number,full_name,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,hostels(name)')
    .in('hostel_id', scope.hostelIds).order('account_number').range(from, to));
  const today = indiaDateKey(new Date());
  const lastWeekStart = shiftDateKey(today, -6);
  const chartStart = shiftDateKey(today, -2);
  const chartEnd = shiftDateKey(today, 4);
  const tomorrow = shiftDateKey(today, 1);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const totalDaysThisMonth = new Date(nextMonth.getTime() - 86400000).getUTCDate();
  const mealRows = await fetchAllRows((from, to) => adminDb.from('meal_days')
    .select('meal_date,meal_code,student_id,students!inner(hostel_id)')
    .in('students.hostel_id', scope.hostelIds).gte('meal_date', lastWeekStart).lte('meal_date', chartEnd)
    .order('meal_date').order('student_id').range(from, to));
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
  const dayTotals = (date: string) => {
    const present = mealRows.filter(row => row.meal_date === date && String(row.meal_code || '').trim() !== '----').length;
    const total = students.length;
    return { present, total, percent: total ? Math.round(present / total * 100) : 0 };
  };
  return {
    hostels: scope.hostels,
    students,
    adminName: scope.user.user_metadata?.full_name || scope.user.email?.split('@')[0] || 'Mess admin',
    metrics: {
      today: dayTotals(today),
      tomorrow: dayTotals(tomorrow),
      cutThisWeek: mealRows.filter(row => row.meal_date >= lastWeekStart && row.meal_date <= today && String(row.meal_code || '').trim() === '----').length,
      extrasAmountThisMonth: null,
      totalDaysThisMonth,
      finedDaysThisMonth: null,
    },
    week,
  };
}

async function handle(request: Request) {
  const body = await request.json();
  const action = String(body.action || '');
  const scope = await requireMessAdmin(request);

  if (action === 'scope') return reply({ hostels: scope.hostels });

  if (action === 'dashboard') {
    return reply(await loadDashboard(scope));
  }

  if (action === 'student-month') {
    const student = await getScopedStudent(String(body.studentId || ''), scope);
    return reply(await loadStudentMonth(student, String(body.month || '')));
  }

  if (action === 'days-download') {
    return reply(await loadDaysDownload(scope, String(body.month || '')));
  }

  if (action === 'mess-count') {
    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail('Choose a valid date.');
    const hostelId = String(body.hostelId || '');
    const selectedHostels = hostelId === allAccessibleHostels
      ? scope.hostels
      : scope.hostels.filter(hostel => hostel.id === hostelId);
    if (!selectedHostels.length) throw fail('That hostel is outside your access range.', 403);
    const results = await Promise.all(selectedHostels.map(hostel => adminDb.rpc('mess_count_summary', {
      p_hostel: hostel.id,
      p_date: date,
    })));
    const rpcError = results.find(result => result.error)?.error;
    if (rpcError) throw rpcError;
    const rowsByMeal = new Map<string, any>();
    for (const result of results) {
      for (const row of result.data || []) {
        const current = rowsByMeal.get(row.meal) || { meal: row.meal, meal_count: 0, veg: 0, chicken: 0, fish: 0, egg: 0, beef: 0 };
        for (const key of ['meal_count', 'veg', 'chicken', 'fish', 'egg', 'beef']) current[key] += Number(row[key] || 0);
        rowsByMeal.set(row.meal, current);
      }
    }
    const mealOrder = ['Breakfast', 'Lunch', 'Tea', 'Dinner'];
    return reply({ rows: mealOrder.map(meal => rowsByMeal.get(meal)).filter(Boolean) });
  }

  if (action === 'students-list') {
    const hostelId = String(body.hostelId || '');
    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail('Choose a valid date.');
    if (!scope.hostelIds.includes(hostelId)) throw fail('That hostel is outside your access range.', 403);
    const { data, error } = await adminDb.rpc('students_list_rows', { p_hostel: hostelId, p_date: date });
    if (error) throw error;
    return reply({ students: data || [] });
  }

  throw fail('Unknown mess-admin action.');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  try {
    return await handle(request);
  } catch (error) {
    console.error('mess-admin request failed', error);
    const status = Number((error as { status?: number })?.status) || 400;
    return reply({ error: errorMessage(error) || 'The request could not be completed.' }, status);
  }
});
