import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const appUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const defaultStudentPassword = Deno.env.get('DEFAULT_STUDENT_PASSWORD') || '';
function requireDefaultStudentPassword() {
  if (!defaultStudentPassword) {
    throw Object.assign(
      new Error('Student account setup is unavailable. Contact the system administrator.'),
      { status: 503 },
    );
  }
  return defaultStudentPassword;
}
const adminDb = createClient(appUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const emailFor = (account: string) => `${account.trim().toLowerCase()}@login.digimessbook.local`;
const resetEmailProviderKey = Deno.env.get('RESEND_API_KEY') || '';
const resetEmailFrom = Deno.env.get('PASSWORD_RESET_FROM_EMAIL') || '';
const activityGroups: Record<string, string[]> = {
  student_management: ['student.created', 'student.updated', 'student.deleted', 'student.password_reset', 'students.bulk_imported'],
  day_status: ['day.status_changed', 'day.mess_closed', 'day.opened'],
  admin_controls: ['settings.updated', 'month.deleted'],
  notifications: ['notification.sent'],
  student_updates: ['meal.created', 'meal.updated', 'student.food_preference_updated'],
  login: ['auth.login'],
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

async function requireSuperAdmin(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
  const { data: { user }, error } = await adminDb.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error('Your session has expired. Sign in again.'), { status: 401 });
  const metadata = user.app_metadata || {};
  if (metadata.role !== 'super_admin' && metadata.super_admin !== true) {
    throw Object.assign(new Error('This account does not have super-admin access.'), { status: 403 });
  }
  return user;
}

function normalizeResetIdentity(body: Record<string, unknown>) {
  return {
    accountNumber: String(body.accountNumber || '').trim().toUpperCase(),
    admissionNumber: String(body.admissionNumber || '').trim().toUpperCase(),
  };
}

async function findResetStudent(accountNumber: string, admissionNumber: string) {
  if (!/^[A-Z0-9._-]{1,40}$/.test(accountNumber) || !/^[A-Z0-9._/-]{1,40}$/.test(admissionNumber)) return null;
  const { data, error } = await adminDb.from('students')
    .select('id,user_id,account_number,admission_number,email')
    .eq('account_number', accountNumber)
    .eq('admission_number', admissionNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function claimPasswordResetEmail(studentId: string) {
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await adminDb.from('student_password_reset_throttle')
    .upsert({ student_id: studentId, last_sent_at: now }, { onConflict: 'student_id', ignoreDuplicates: true })
    .select('student_id');
  if (insertError) throw insertError;
  if (inserted?.length) return true;

  const cooldownEndedAt = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await adminDb.from('student_password_reset_throttle')
    .update({ last_sent_at: now })
    .eq('student_id', studentId)
    .lte('last_sent_at', cooldownEndedAt)
    .select('student_id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function sendStudentPasswordReset(body: Record<string, unknown>) {
  if (!resetEmailProviderKey || !resetEmailFrom || !anonKey) {
    return reply({ error: 'Password reset email is temporarily unavailable. Please contact the mess office.' }, 503);
  }
  let studentId: string | null = null;
  try {
    const { accountNumber, admissionNumber } = normalizeResetIdentity(body);
    const student = await findResetStudent(accountNumber, admissionNumber);
    if (!student?.email || !student.user_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) return reply({ ok: true });
    studentId = student.id;

    const claimed = await claimPasswordResetEmail(student.id);
    if (!claimed) return reply({ ok: true });

    const { data, error } = await adminDb.auth.admin.generateLink({ type: 'recovery', email: emailFor(student.account_number) });
    const otp = String(data?.properties?.email_otp || '');
    if (error || !/^\d{6}$/.test(otp)) {
      await adminDb.from('student_password_reset_throttle').delete().eq('student_id', student.id);
      throw error || new Error('Unable to generate the password reset code.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resetEmailProviderKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: resetEmailFrom,
        to: [student.email],
        subject: 'Your DigiMessBook password reset code',
        text: `Your DigiMessBook password reset code is ${otp}. It expires in 1 hour. If you did not request this, ignore this email.`,
        html: `<p>Your DigiMessBook password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 1 hour. If you did not request this, ignore this email.</p>`,
      }),
    });
    if (!response.ok) {
      console.error('Password reset email delivery failed with status', response.status);
      throw Object.assign(new Error('Unable to send the password reset code right now.'), { status: 502 });
    }
    return reply({ ok: true });
  } catch (resetEmailError) {
    if (studentId) await adminDb.from('student_password_reset_throttle').delete().eq('student_id', studentId);
    console.error('Student password reset request could not be completed', resetEmailError);
    return reply({ ok: true });
  }
}

async function confirmStudentPasswordReset(body: Record<string, unknown>) {
  const { accountNumber, admissionNumber } = normalizeResetIdentity(body);
  const otp = String(body.otp || '').trim();
  if (!anonKey) throw Object.assign(new Error('Password reset is temporarily unavailable. Please contact the mess office.'), { status: 503 });
  if (!/^\d{6}$/.test(otp)) throw Object.assign(new Error('The verification code is invalid or expired.'), { status: 400 });
  let student: any;
  try {
    student = await findResetStudent(accountNumber, admissionNumber);
  } catch (lookupError) {
    console.error('Student password reset identity lookup failed', lookupError);
    throw Object.assign(new Error('The verification code is invalid or expired.'), { status: 400 });
  }
  if (!student?.user_id) throw Object.assign(new Error('The verification code is invalid or expired.'), { status: 400 });

  const verifier = createClient(appUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await verifier.auth.verifyOtp({ email: emailFor(student.account_number), token: otp, type: 'recovery' });
  if (error || data.user?.id !== student.user_id) {
    throw Object.assign(new Error('The verification code is invalid or expired.'), { status: 400 });
  }

  const { error: resetError } = await adminDb.auth.admin.updateUserById(student.user_id, { password: requireDefaultStudentPassword() });
  if (resetError) {
    console.error('Student password could not be reset after OTP verification', resetError);
    throw Object.assign(new Error('Password reset could not be completed. Contact the mess office.'), { status: 500 });
  }
  await adminDb.from('student_password_reset_throttle').delete().eq('student_id', student.id);
  return reply({ ok: true });
}

async function tenantExists(tenantId: string) {
  if (!tenantId) throw Object.assign(new Error('Choose a hostel group first.'), { status: 400 });
  const { data, error } = await adminDb.from('tenants').select('id,name').eq('id', tenantId).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('The selected group was not found.'), { status: 404 });
  return data;
}

async function audit(actor: any, tenantId: string, action: string, details: Record<string, unknown>, studentId: string | null = null) {
  const actorName = actorDisplayName(actor);
  const { error } = await adminDb.from('admin_audit_log').insert({
    actor_id: actor.id,
    actor_type: 'admin',
    tenant_id: tenantId,
    student_id: studentId,
    action,
    details: { ...details, actor_name: actorName, actor_type: 'admin' },
  });
  if (error) throw error;
}

function actorDisplayName(user: any) {
  return String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin');
}

async function decorateActivities(rows: any[], tenantId: string) {
  const actorIds = [...new Set(rows.map(row => row.actor_id).filter(Boolean))];
  const studentByUser = new Map<string, any>();
  if (actorIds.length) {
    const { data, error } = await adminDb.from('students').select('user_id,account_number,full_name')
      .eq('tenant_id', tenantId).in('user_id', actorIds);
    if (error) throw error;
    for (const student of data || []) studentByUser.set(student.user_id, student);
  }
  const adminIds = [...new Set(rows
    .filter(row => row.actor_id && !studentByUser.has(row.actor_id) && !row.details?.actor_name)
    .map(row => row.actor_id))];
  const adminNames = new Map<string, string>();
  const adminResults = await Promise.all(adminIds.map(id => adminDb.auth.admin.getUserById(id)));
  adminResults.forEach((result, index) => {
    if (!result.error && result.data?.user) adminNames.set(adminIds[index], actorDisplayName(result.data.user));
  });
  return rows.map(row => {
    const details = row.details || {};
    const student = studentByUser.get(row.actor_id);
    const isStudent = row.actor_type === 'student' || details.actor_type === 'student' || details.source === 'student' || !!student;
    const account = details.account_number || student?.account_number;
    const studentName = details.student_name || student?.full_name;
    return {
      ...row,
      user_type: isStudent ? 'student' : 'admin',
      user_name: isStudent
        ? [account, studentName].filter(Boolean).join(' - ') || 'Student'
        : details.actor_name || adminNames.get(row.actor_id) || 'Admin',
    };
  });
}

function buildHistoryQuery(tenantId: string, filters: Record<string, unknown>, withCount = false) {
  const auditLog = adminDb.from('admin_audit_log');
  let query = withCount
    ? auditLog.select('id,actor_id,actor_type,student_id,action,details,created_at', { count: 'exact' })
    : auditLog.select('id,actor_id,actor_type,student_id,action,details,created_at');
  query = query.eq('tenant_id', tenantId);
  const activityType = String(filters.activityType || 'all');
  if (activityType !== 'all') {
    const actions = activityGroups[activityType];
    if (!actions) throw Object.assign(new Error('Choose a valid activity type.'), { status: 400 });
    query = query.in('action', actions);
  }
  const userType = String(filters.userType || 'all');
  if (userType !== 'all') {
    if (!['admin', 'student'].includes(userType)) throw Object.assign(new Error('Choose a valid user type.'), { status: 400 });
    query = query.eq('actor_type', userType);
  }
  const search = String(filters.search || '').replace(/[^a-zA-Z0-9@._ /-]/g, ' ').trim().slice(0, 80);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or([
      `action.ilike.${pattern}`,
      `details->>actor_name.ilike.${pattern}`,
      `details->>account_number.ilike.${pattern}`,
      `details->>student_name.ilike.${pattern}`,
      `details->>date.ilike.${pattern}`,
      `details->>month.ilike.${pattern}`,
    ].join(','));
  }
  if (Array.isArray(filters.accountNumbers)) {
    const accounts = [...new Set(filters.accountNumbers.map(value => String(value).trim().toUpperCase())
      .filter(value => /^[A-Z0-9._-]{1,40}$/.test(value)))].slice(0, 100);
    if (accounts.length) query = query.in('details->>account_number', accounts);
  }
  const dateFrom = String(filters.dateFrom || '');
  const dateTo = String(filters.dateTo || '');
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) throw Object.assign(new Error('Choose a valid start date.'), { status: 400 });
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) throw Object.assign(new Error('Choose a valid end date.'), { status: 400 });
  if (dateFrom && dateTo && dateFrom > dateTo) throw Object.assign(new Error('Start date must be before or equal to end date.'), { status: 400 });
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00+05:30`);
  if (dateTo) {
    const exclusiveEnd = new Date(`${dateTo}T00:00:00+05:30`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    query = query.lt('created_at', exclusiveEnd.toISOString());
  }
  return query;
}

async function loadDashboard(tenantId: string) {
  const tenant = await tenantExists(tenantId);
  const now = new Date();
  const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const tomorrowDate = new Date(`${today}T00:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const weekStartKey = weekStart.toISOString().slice(0, 10);

  const [hostelResult, studentRows, settingsResult, calendarResult, activityResult, activityCountResult, mealDays] = await Promise.all([
    adminDb.from('hostels').select('id,name').eq('tenant_id', tenantId).order('name'),
    fetchAllRows((from, to) => adminDb.from('students').select('id,user_id,tenant_id,hostel_id,account_number,admission_number,full_name,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,role,hostels(name)')
      .eq('tenant_id', tenantId).order('account_number').range(from, to)),
    adminDb.from('mess_settings').select('lock_days_before,lock_time,timezone').eq('tenant_id', tenantId).maybeSingle(),
    adminDb.from('mess_calendar').select('calendar_date,status,note').eq('tenant_id', tenantId)
      .gte('calendar_date', monthStart).lte('calendar_date', monthEnd).order('calendar_date'),
    adminDb.from('admin_audit_log').select('id,actor_id,actor_type,student_id,action,details,created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
    adminDb.from('admin_audit_log').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).gte('created_at', `${today}T00:00:00+05:30`)
      .lt('created_at', `${tomorrow}T00:00:00+05:30`),
    fetchAllRows((from, to) => adminDb.from('meal_days').select('meal_date,meal_code,student_id,students!inner(tenant_id)')
      .eq('students.tenant_id', tenantId).gte('meal_date', weekStartKey).lte('meal_date', today)
      .order('meal_date').order('student_id').range(from, to)),
  ]);
  for (const result of [hostelResult, settingsResult, calendarResult, activityResult, activityCountResult]) {
    if (result.error) throw result.error;
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${weekStartKey}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    const rows = mealDays.filter(row => row.meal_date === date);
    return {
      date,
      label: new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(day),
      present: rows.filter(row => row.meal_code.trim() !== '----').length,
      cut: rows.filter(row => row.meal_code.trim() === '----').length,
    };
  });
  const todayRows = mealDays.filter(row => row.meal_date === today);
  const latestActivity = await decorateActivities(activityResult.data || [], tenantId);
  return {
    tenant,
    tenants: [tenant],
    hostels: hostelResult.data || [],
    students: studentRows,
    settings: settingsResult.data || { lock_days_before: 1, lock_time: '19:00:00', timezone: 'Asia/Kolkata' },
    closedDays: calendarResult.data || [],
    activities: latestActivity,
    week,
    stats: {
      students: studentRows.length,
      hostels: hostelResult.data?.length || 0,
      presentToday: todayRows.filter(row => row.meal_code.trim() !== '----').length,
      cutThisWeek: mealDays.filter(row => row.meal_date >= weekStartKey && row.meal_code.trim() === '----').length,
      changesToday: activityCountResult.count || 0,
    },
    today,
  };
}

function validateStudent(input: Record<string, unknown>) {
  const account = String(input.account_number || '').trim().toUpperCase();
  const fullName = String(input.full_name || '').trim();
  const hostelId = String(input.hostel_id || '').trim();
  if (!account || !fullName || !hostelId) throw Object.assign(new Error('Account number, student name, and hostel are required.'), { status: 400 });
  if (!/^[a-zA-Z0-9._-]+$/.test(account)) throw Object.assign(new Error('Account numbers may contain letters, numbers, dots, underscores, and hyphens.'), { status: 400 });
  if (account.length > 40 || fullName.length > 120 || String(input.room || '').length > 80
    || String(input.academic_year || '').length > 30 || String(input.department || '').length > 100
    || String(input.admission_number || '').length > 40 || String(input.email || '').length > 254
    || String(input.mobile_number || '').length > 30 || String(input.guardian_name || '').length > 120
    || String(input.guardian_relation || '').length > 80 || String(input.guardian_mobile_number || '').length > 30
    || String(input.blood_group || '').length > 10 || String(input.food_preference || '').length > 200) {
    throw Object.assign(new Error('One of the student fields is too long.'), { status: 400 });
  }
  const contactEmail = String(input.email || '').trim().toLowerCase();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw Object.assign(new Error('Enter a valid student email address.'), { status: 400 });
  }
  return {
    account_number: account,
    admission_number: String(input.admission_number || '').trim().toUpperCase(),
    full_name: fullName,
    hostel_id: hostelId,
    room: String(input.room || '').trim(),
    academic_year: String(input.academic_year || '').trim(),
    department: String(input.department || '').trim(),
    email: contactEmail,
    mobile_number: String(input.mobile_number || '').trim(),
    guardian_name: String(input.guardian_name || '').trim(),
    guardian_relation: String(input.guardian_relation || '').trim(),
    guardian_mobile_number: String(input.guardian_mobile_number || '').trim(),
    blood_group: String(input.blood_group || '').trim().toUpperCase(),
    food_preference: String(input.food_preference || '').trim(),
  };
}

async function createStudent(input: Record<string, unknown>, tenantId: string) {
  const fields = validateStudent(input);
  const { data: hostel, error: hostelError } = await adminDb.from('hostels').select('id')
    .eq('id', fields.hostel_id).eq('tenant_id', tenantId).maybeSingle();
  if (hostelError) throw hostelError;
  if (!hostel) throw new Error('The selected hostel does not belong to this group.');
  const { data: created, error: authError } = await adminDb.auth.admin.createUser({
    email: emailFor(fields.account_number),
    password: requireDefaultStudentPassword(),
    email_confirm: true,
    user_metadata: { account_number: fields.account_number, full_name: fields.full_name },
  });
  if (authError || !created.user) throw authError || new Error('Unable to create the student login.');
  const { data: student, error } = await adminDb.from('students').insert({
    ...fields,
    tenant_id: tenantId,
    user_id: created.user.id,
    role: 'student',
  }).select('id,user_id,account_number,admission_number,full_name,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,hostel_id,hostels(name)').single();
  if (error) {
    await adminDb.auth.admin.deleteUser(created.user.id);
    throw error;
  }
  return student;
}

async function saveStudent(input: Record<string, unknown>, tenantId: string) {
  const fields = validateStudent(input);
  const studentId = String(input.id || '');
  if (!studentId) return createStudent(input, tenantId);
  const { data: current, error: currentError } = await adminDb.from('students')
    .select('id,user_id,account_number,tenant_id').eq('id', studentId).eq('tenant_id', tenantId).maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error('Student not found in the selected group.');
  const { data: hostel, error: hostelError } = await adminDb.from('hostels').select('id')
    .eq('id', fields.hostel_id).eq('tenant_id', tenantId).maybeSingle();
  if (hostelError) throw hostelError;
  if (!hostel) throw new Error('The selected hostel does not belong to this group.');
  const accountChanged = fields.account_number !== current.account_number;
  if (accountChanged) {
    const { error: emailError } = await adminDb.auth.admin.updateUserById(current.user_id, { email: emailFor(fields.account_number), email_confirm: true });
    if (emailError) throw emailError;
  }
  const { error: updateError } = await adminDb.from('students').update(fields).eq('id', studentId).eq('tenant_id', tenantId);
  if (updateError) {
    if (accountChanged) await adminDb.auth.admin.updateUserById(current.user_id, { email: emailFor(current.account_number), email_confirm: true });
    throw updateError;
  }
  const { data: saved, error } = await adminDb.from('students').select('id,user_id,account_number,admission_number,full_name,room,academic_year,department,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group,food_preference,hostel_id,hostels(name)')
    .eq('id', studentId).single();
  if (error) throw error;
  return saved;
}

async function getStudent(studentId: string, tenantId: string) {
  const { data, error } = await adminDb.from('students').select('id,user_id,account_number,full_name,tenant_id')
    .eq('id', studentId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Student not found in the selected group.'), { status: 404 });
  return data;
}

async function recordLogin(request: Request, tenantId: string) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
  const { data: { user }, error: authError } = await adminDb.auth.getUser(token);
  if (authError || !user) throw Object.assign(new Error('Your session has expired. Sign in again.'), { status: 401 });
  const { data: student, error: studentError } = await adminDb.from('students')
    .select('id,tenant_id,account_number,full_name').eq('user_id', user.id).maybeSingle();
  if (studentError) throw studentError;
  const loginAt = user.last_sign_in_at || new Date().toISOString();
  const loginTenantId = student?.tenant_id || tenantId;
  if (!loginTenantId) throw Object.assign(new Error('Choose a hostel group first.'), { status: 400 });
  if (!student) {
    const metadata = user.app_metadata || {};
    if (metadata.role !== 'super_admin' && metadata.super_admin !== true) {
      throw Object.assign(new Error('This account does not have admin access.'), { status: 403 });
    }
    await tenantExists(loginTenantId);
  }
  const { data: existing, error: existingError } = await adminDb.from('admin_audit_log').select('id')
    .eq('tenant_id', loginTenantId).eq('actor_id', user.id).eq('action', 'auth.login')
    .eq('details->>login_at', loginAt).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { recorded: false };
  const actorType = student ? 'student' : 'admin';
  const details = student
    ? { actor_type: actorType, account_number: student.account_number, student_name: student.full_name, source: 'student', login_at: loginAt }
    : { actor_type: actorType, actor_name: actorDisplayName(user), login_at: loginAt };
  const { error } = await adminDb.from('admin_audit_log').insert({
    tenant_id: loginTenantId, actor_id: user.id, actor_type: actorType,
    student_id: student?.id || null, action: 'auth.login', details,
  });
  if (error && error.code !== '23505') throw error;
  return { recorded: !error };
}

async function handle(request: Request) {
  const body = await request.json();
  const action = String(body.action || '');
  const tenantId = String(body.tenantId || '');
  if (action === 'record-login') return reply(await recordLogin(request, tenantId));
  if (action === 'request-student-password-reset') return sendStudentPasswordReset(body);
  if (action === 'confirm-student-password-reset') return confirmStudentPasswordReset(body);
  const actor = await requireSuperAdmin(request);

  if (action === 'tenants') {
    const { data, error } = await adminDb.from('tenants').select('id,name').order('name');
    if (error) throw error;
    return reply({ tenants: data || [] });
  }
  if (action === 'dashboard') return reply(await loadDashboard(tenantId));
  if (action === 'history') {
    await tenantExists(tenantId);
    const page = Math.max(1, Math.floor(Number(body.page) || 1));
    const filters = { ...body, search: String(body.search || '') };
    const query = buildHistoryQuery(tenantId, filters, true);
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id')
      .range((page - 1) * 100, page * 100 - 1);
    if (error) throw error;
    return reply({ activities: await decorateActivities(data || [], tenantId), total: count || 0, page, pageSize: 100 });
  }
  if (action === 'history-export') {
    await tenantExists(tenantId);
    const activities = await fetchAllRows((from, to) => buildHistoryQuery(tenantId, body)
      .order('created_at', { ascending: false }).order('id').range(from, to));
    return reply({ activities: await decorateActivities(activities, tenantId) });
  }
  if (action === 'day-status') {
    await tenantExists(tenantId);
    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error('Choose a valid date.'), { status: 400 });
    const [students, meals, calendar] = await Promise.all([
      fetchAllRows((from, to) => adminDb.from('students').select('id,account_number,full_name,room,academic_year,department,hostel_id,hostels(name)')
        .eq('tenant_id', tenantId).order('account_number').range(from, to)),
      fetchAllRows((from, to) => adminDb.from('meal_days').select('student_id,meal_code').eq('meal_date', date).order('student_id').range(from, to)),
      adminDb.from('mess_calendar').select('status,note').eq('tenant_id', tenantId).eq('calendar_date', date).maybeSingle(),
    ]);
    if (calendar.error) throw calendar.error;
    return reply({ students, meals, calendar: calendar.data });
  }
  if (action === 'student-calendar') {
    await tenantExists(tenantId);
    const student = await getStudent(String(body.studentId || ''), tenantId);
    const month = String(body.month || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(new Error('Choose a valid calendar month.'), { status: 400 });
    const start = `${month}-01`;
    const next = new Date(`${start}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const end = new Date(next.getTime() - 86400000).toISOString().slice(0, 10);
    const [meals, closedDays] = await Promise.all([
      fetchAllRows((from, to) => adminDb.from('meal_days').select('meal_date,meal_code')
        .eq('student_id', student.id).gte('meal_date', start).lte('meal_date', end).order('meal_date').range(from, to)),
      adminDb.from('mess_calendar').select('calendar_date,status').eq('tenant_id', tenantId)
        .gte('calendar_date', start).lte('calendar_date', end),
    ]);
    if (closedDays.error) throw closedDays.error;
    return reply({ student, meals, closedDays: closedDays.data || [] });
  }
  if (action === 'save-student-meal') {
    await tenantExists(tenantId);
    const student = await getStudent(String(body.studentId || ''), tenantId);
    const date = String(body.date || '');
    const mealCode = String(body.mealCode || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[B-][L-][T-][D-]$/.test(mealCode)) {
      throw Object.assign(new Error('Choose a valid date and meal selection.'), { status: 400 });
    }
    const { error } = await adminDb.from('meal_days').upsert({
      student_id: student.id, meal_date: date, meal_code: mealCode,
    }, { onConflict: 'student_id,meal_date' });
    if (error) throw error;
    await audit(actor, tenantId, 'day.status_changed', {
      account_number: student.account_number, student_name: student.full_name, date,
      status: mealCode === '----' ? 'cut' : 'present', meal_code: mealCode, override: true, source: 'admin-calendar',
    }, student.id);
    return reply({ ok: true, mealCode });
  }
  if (action === 'save-student') {
    await tenantExists(tenantId);
    const saved = await saveStudent(body.student || {}, tenantId);
    const isNew = !body.student?.id;
    await audit(actor, tenantId, isNew ? 'student.created' : 'student.updated', {
      account_number: saved.account_number, student_name: saved.full_name,
    }, saved.id);
    return reply({ student: saved });
  }
  if (action === 'delete-student') {
    await tenantExists(tenantId);
    const student = await getStudent(String(body.studentId || ''), tenantId);
    const { error } = await adminDb.auth.admin.deleteUser(student.user_id);
    if (error) throw error;
    await audit(actor, tenantId, 'student.deleted', {
      account_number: student.account_number, student_name: student.full_name,
    });
    return reply({ ok: true });
  }
  if (action === 'reset-password' || action === 'bulk-reset-password') {
    await tenantExists(tenantId);
    const ids = action === 'reset-password' ? [String(body.studentId || '')] : body.studentIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 500) throw Object.assign(new Error('Select between 1 and 500 students.'), { status: 400 });
    const results = [];
    for (const id of ids) {
      let accountNumber = '';
      try {
        const student = await getStudent(String(id), tenantId);
        accountNumber = student.account_number;
        const { error } = await adminDb.auth.admin.updateUserById(student.user_id, { password: requireDefaultStudentPassword() });
        if (error) throw error;
        await audit(actor, tenantId, 'student.password_reset', {
          account_number: student.account_number, student_name: student.full_name,
        }, student.id);
        results.push({ id, account_number: accountNumber, ok: true });
      } catch (error) {
        results.push({ id, account_number: accountNumber, ok: false, error: errorMessage(error) });
      }
    }
    return reply({ results });
  }
  if (action === 'bulk-import') {
    await tenantExists(tenantId);
    const rows = body.rows;
    if (!Array.isArray(rows) || !rows.length || rows.length > 200) throw Object.assign(new Error('Paste between 1 and 200 student rows at a time.'), { status: 400 });
    const outcomes = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      try {
        const fields = validateStudent(row);
        const { data: existing, error } = await adminDb.from('students')
          .select('id,admission_number,email,mobile_number,guardian_name,guardian_relation,guardian_mobile_number,blood_group')
          .eq('tenant_id', tenantId)
          .eq('account_number', fields.account_number).maybeSingle();
        if (error) throw error;
        const profileFields = ['admission_number', 'email', 'mobile_number', 'guardian_name', 'guardian_relation', 'guardian_mobile_number', 'blood_group'];
        const suppliedOrExistingProfile = Object.fromEntries(profileFields.map(field => [
          field,
          Object.prototype.hasOwnProperty.call(row, field) ? row[field] : existing?.[field] || '',
        ]));
        const student = await saveStudent({ ...fields, ...suppliedOrExistingProfile, id: existing?.id, hostel_id: row.hostel_id || fields.hostel_id }, tenantId);
        await audit(actor, tenantId, 'students.bulk_imported', {
          account_number: student.account_number, student_name: student.full_name, row: index + 1,
        }, student.id);
        outcomes.push({ row: index + 1, account_number: student.account_number, ok: true });
      } catch (error) {
        outcomes.push({ row: index + 1, account_number: row.account_number || '', ok: false, error: errorMessage(error) });
      }
    }
    return reply({ results: outcomes });
  }
  if (action === 'set-day-status') {
    await tenantExists(tenantId);
    const date = String(body.date || '');
    const status = String(body.status || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['present', 'cut'].includes(status)) {
      throw Object.assign(new Error('Choose a valid date and status.'), { status: 400 });
    }
    const student = await getStudent(String(body.studentId || ''), tenantId);
    const mealCode = status === 'cut' ? '----' : 'BLTD';
    const { error } = await adminDb.from('meal_days').upsert({ student_id: student.id, meal_date: date, meal_code: mealCode }, { onConflict: 'student_id,meal_date' });
    if (error) throw error;
    await audit(actor, tenantId, 'day.status_changed', {
      account_number: student.account_number, student_name: student.full_name, date, status,
      override: true,
    }, student.id);
    return reply({ ok: true, mealCode });
  }
  if (action === 'save-settings') {
    await tenantExists(tenantId);
    const lockDays = Number(body.lock_days_before);
    const lockTime = String(body.lock_time || '');
    if (!Number.isInteger(lockDays) || lockDays < 0 || lockDays > 7 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(lockTime)) {
      throw Object.assign(new Error('Enter a lock time and a number of days from 0 to 7.'), { status: 400 });
    }
    const { error } = await adminDb.from('mess_settings').upsert({
      tenant_id: tenantId, lock_days_before: lockDays, lock_time: `${lockTime}:00`, timezone: 'Asia/Kolkata', updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });
    if (error) throw error;
    await audit(actor, tenantId, 'settings.updated', { lock_days_before: lockDays, lock_time: lockTime });
    return reply({ ok: true });
  }
  if (action === 'set-calendar-day') {
    await tenantExists(tenantId);
    const date = String(body.date || '');
    const status = String(body.status || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['open', 'closed'].includes(status)) {
      throw Object.assign(new Error('Choose a valid date.'), { status: 400 });
    }
    const note = String(body.note || '').trim().slice(0, 250);
    if (status === 'closed') {
      const { data: affected, error } = await adminDb.rpc('admin_close_mess_day', {
        p_tenant_id: tenantId,
        p_calendar_date: date,
        p_note: note,
        p_actor: actor.id,
      });
      if (error) throw error;
      return reply({ ok: true, affected: Number(affected || 0) });
    }
    const { error } = await adminDb.from('mess_calendar').upsert({
      tenant_id: tenantId, calendar_date: date, status, note, updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,calendar_date' });
    if (error) throw error;
    await audit(actor, tenantId, 'day.opened', { date, note });
    return reply({ ok: true, affected: 0 });
  }
  if (action === 'calendar-status') {
    await tenantExists(tenantId);
    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error('Choose a valid date.'), { status: 400 });
    const { data, error } = await adminDb.from('mess_calendar').select('status,note')
      .eq('tenant_id', tenantId).eq('calendar_date', date).maybeSingle();
    if (error) throw error;
    return reply({ calendar: data || { status: 'open', note: '' } });
  }
  if (action === 'closed-days') {
    await tenantExists(tenantId);
    const closedDays = await fetchAllRows((from, to) => adminDb.from('mess_calendar')
      .select('calendar_date,note,updated_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'closed')
      .order('calendar_date', { ascending: false })
      .range(from, to));
    return reply({ closedDays });
  }
  if (action === 'delete-month') {
    await tenantExists(tenantId);
    const month = String(body.month || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(new Error('Choose a valid month.'), { status: 400 });
    const start = `${month}-01`;
    const endDate = new Date(`${start}T00:00:00Z`);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    endDate.setUTCDate(0);
    const end = endDate.toISOString().slice(0, 10);
    const ids = await fetchAllRows((from, to) => adminDb.from('students').select('id').eq('tenant_id', tenantId).order('id').range(from, to));
    const studentIds = ids.map(row => row.id);
    for (let index = 0; index < studentIds.length; index += 500) {
      const { error } = await adminDb.from('meal_days').delete().in('student_id', studentIds.slice(index, index + 500)).gte('meal_date', start).lte('meal_date', end);
      if (error) throw error;
    }
    await audit(actor, tenantId, 'month.deleted', { month, start, end, students: studentIds.length });
    return reply({ ok: true, month });
  }
  if (action === 'send-notification') {
    await tenantExists(tenantId);
    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    if (!title || !message || title.length > 120 || message.length > 2000) {
      throw Object.assign(new Error('Enter a title and message (up to 120 and 2,000 characters).'), { status: 400 });
    }
    const recipients = await fetchAllRows((from, to) => {
      let query = adminDb.from('students').select('id,account_number,full_name').eq('tenant_id', tenantId);
      if (body.hostelId) query = query.eq('hostel_id', String(body.hostelId));
      if (body.academicYear) query = query.eq('academic_year', String(body.academicYear));
      return query.order('id').range(from, to);
    });
    if (!recipients?.length) throw Object.assign(new Error('No students match this notification audience.'), { status: 400 });
    for (let index = 0; index < recipients.length; index += 500) {
      const rows = recipients.slice(index, index + 500).map(student => ({
        tenant_id: tenantId, student_id: student.id, title, message,
      }));
      const { error: insertError } = await adminDb.from('student_notifications').insert(rows);
      if (insertError) throw insertError;
    }
    await audit(actor, tenantId, 'notification.sent', {
      title, message, recipients: recipients.length, hostel_id: body.hostelId || null,
      academic_year: body.academicYear || null,
    });
    return reply({ ok: true, recipients: recipients.length });
  }
  throw Object.assign(new Error('Unknown super-admin action.'), { status: 400 });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  try {
    return await handle(request);
  } catch (error) {
    console.error('super-admin request failed', error);
    const status = Number((error as { status?: number })?.status) || 400;
    return reply({ error: errorMessage(error) || 'The request could not be completed.' }, status);
  }
});
