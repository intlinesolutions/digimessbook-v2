import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import './StudentsListPage.css';

function getTodayInIndia() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export default function StudentsListPage() {
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState('');
  const [date, setDate] = useState(getTodayInIndia);
  const [students, setStudents] = useState(null);
  const [search, setSearch] = useState('');
  const [loadingHostels, setLoadingHostels] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

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

  async function viewStudents(event) {
    event.preventDefault();
    if (!hostelId || !date || !supabase) {
      setError('Select a hostel and date to view students.');
      return;
    }

    const currentRequest = ++requestId.current;
    setError('');
    setStudents(null);
    setSearch('');
    setLoadingStudents(true);

    try {
      const { data, error: queryError } = await supabase.rpc('students_list_rows', {
        p_hostel: hostelId,
        p_date: date,
      });

      if (currentRequest !== requestId.current) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setStudents(data || []);
      }
    } catch (queryError) {
      if (currentRequest === requestId.current) {
        setError(queryError.message || 'Unable to load the students list.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoadingStudents(false);
    }
  }

  function changeFilter(update) {
    requestId.current += 1;
    update();
    setStudents(null);
    setSearch('');
    setLoadingStudents(false);
    setError('');
  }

  const query = search.trim().toLocaleLowerCase();
  const visibleStudents = (students || []).filter(student => (
    !query || [student.account_number, student.room, student.full_name]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(query))
  ));

  return (
    <main className="students-list-page">
      <a className="students-list-back" href="/">← Back to Mess Book</a>
      <header className="students-list-header">
        <span className="students-list-eyebrow">Digi Mess Book</span>
        <h1>Students List</h1>
        <p>Student roster and mess cut status by hostel and date.</p>
      </header>

      <form className="students-list-card" onSubmit={viewStudents}>
        <div className="students-list-filters">
          <label>
            <span>Hostel</span>
            <select
              value={hostelId}
              onChange={event => changeFilter(() => setHostelId(event.target.value))}
              disabled={loadingHostels || loadingStudents || hostels.length === 0}
              required
            >
              <option value="">{loadingHostels ? 'Loading hostels…' : 'Select hostel'}</option>
              {hostels.map(hostel => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={event => changeFilter(() => setDate(event.target.value))}
              disabled={loadingStudents}
              required
            />
          </label>
          <button className="students-list-submit" type="submit" disabled={loadingStudents || loadingHostels || hostels.length === 0}>
            {loadingStudents ? 'Loading Students…' : 'View students'}
          </button>
        </div>
        {error && <p className="students-list-error" role="alert">{error}</p>}
      </form>

      {students !== null && (
        <section className="students-list-results" aria-live="polite">
          <label className="students-list-search">
            <span>Search students</span>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by acc no, room no, or name"
            />
          </label>
          {students.length === 0 ? (
            <div className="students-list-empty">No students found for this hostel and date.</div>
          ) : visibleStudents.length === 0 ? (
            <div className="students-list-empty">No students match “{search.trim()}”.</div>
          ) : (
            <>
              <div className="students-list-table-wrap">
                <table className="students-list-table">
                  <thead>
                    <tr>
                      <th scope="col">Acc no</th>
                      <th scope="col">Room no</th>
                      <th scope="col">Name</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map(student => (
                      <tr key={student.account_number}>
                        <td>{student.account_number}</td>
                        <td>{student.room || '—'}</td>
                        <td>{student.full_name}</td>
                        <td>
                          <span
                            className={`students-list-status-dot ${student.is_mess_cut === true ? 'is-cut' : student.is_mess_cut === false ? 'is-in-mess' : 'is-no-record'}`}
                            role="img"
                            aria-label={student.is_mess_cut === true ? 'Mess cut' : student.is_mess_cut === false ? 'In mess' : 'No meal record'}
                            title={student.is_mess_cut === true ? 'Mess cut' : student.is_mess_cut === false ? 'In mess' : 'No meal record'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="students-list-caption">
                Showing {visibleStudents.length} of {students.length} students · {hostels.find(hostel => hostel.id === hostelId)?.name} · {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long' })}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
