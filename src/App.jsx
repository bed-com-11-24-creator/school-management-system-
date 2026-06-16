import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, BookOpen, Users, CreditCard, CheckSquare,
  Bell, FileText, MessageSquare, LogOut, Menu, Settings,
  UserPlus, Trash2, Plus, Check, AlertTriangle, Wifi, WifiOff,
  Printer, Download, RefreshCw, Send, Lock, Unlock, Save,
  ChevronRight, Play, Award, BarChart2, Eye, Archive, LayoutGrid
} from 'lucide-react';
import { getOfflineQueue, queueOfflineOperation, syncOfflineData } from './offlineDb';
import { FeeManagementDashboard } from './components/FeeManagementDashboard';
import { TeacherManagement } from './components/TeacherManagement';
import { TeacherAttendancePanel } from './components/TeacherAttendancePanel';
import { AlumniManagement } from './components/AlumniManagement';
import { StudentSubjectRegistration } from './components/StudentSubjectRegistration';
import { ClassSubjectRoster } from './components/ClassSubjectRoster';
import { ClassSubjectsAssignment } from './components/ClassSubjectsAssignment';

const API_HOST = 'http://localhost:5000';

// All available subjects across the school
const ALL_SUBJECTS = [
  'Mathematics', 'English', 'Chichewa', 'Social Studies', 'Bible Knowledge',
  'Life Skills', 'Expressive Arts', 'Primary Science', 'Agriculture'
];

const ALL_CLASSES = ['Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 'Standard 5', 'Standard 6', 'Standard 7', 'Standard 8'];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: grade letter from score
// ─────────────────────────────────────────────────────────────────────────────
function getGradeLetter(score) {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function getGradeColor(score) {
  if (score >= 70) return 'var(--color-teacher)';
  if (score >= 50) return '#f59e0b';
  return 'var(--color-danger)';
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [token, setToken] = useState(localStorage.getItem('sms_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('sms_user') || 'null'));
  const [branding, setBranding] = useState(JSON.parse(localStorage.getItem('sms_branding') || 'null'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(getOfflineQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [parentStudentId, setParentStudentId] = useState(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/pay/student/')) {
      const parts = path.split('/');
      setParentStudentId(parts[parts.length - 1]);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); triggerAutoSync(); };
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdate = () => setOfflineCount(getOfflineQueue().length);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-updated', handleQueueUpdate);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-updated', handleQueueUpdate);
    };
  }, [token]);

  const triggerAutoSync = async () => {
    if (!token || !navigator.onLine) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    setSuccessMessage('Restored connection! Synchronizing offline edits...');
    const result = await syncOfflineData(token, API_HOST);
    setSyncing(false);
    if (result && result.succeeded > 0) {
      setSuccessMessage(`Offline Sync Complete: ${result.succeeded} entries uploaded successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      window.dispatchEvent(new Event('refresh-data'));
    }
  };

  const triggerAlert = (msg, isError = true) => {
    if (isError) { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 5000); }
    else { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 5000); }
  };

  const handleLogout = () => {
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_branding');
    setToken(''); setUser(null); setBranding(null); setCurrentTab('dashboard');
  };

  if (parentStudentId) {
    return (
      <ParentPaymentPortal
        studentId={parentStudentId}
        apiHost={API_HOST}
        onClose={() => { setParentStudentId(null); window.history.pushState({}, '', '/'); }}
      />
    );
  }

  if (!token) {
    return (
      <LoginPortal
        apiHost={API_HOST} setToken={setToken} setUser={setUser}
        setBranding={setBranding} triggerAlert={triggerAlert}
      />
    );
  }

  return (
    <div className={`dashboard-layout ${user?.role}`}>
      {/* Network indicator */}
      <div className={`network-indicator ${isOnline ? 'online' : 'offline'}`}>
        {isOnline ? (
          <>
            <Wifi size={16} /><span>Online</span>
            {offlineCount > 0 && (
              <button className="sync-btn" onClick={triggerAutoSync} disabled={syncing}>
                <RefreshCw size={12} className={syncing ? 'pulse' : ''} />
                <span>({offlineCount} pending)</span>
              </button>
            )}
          </>
        ) : (
          <><WifiOff size={16} /><span>Offline mode ({offlineCount} queued)</span></>
        )}
      </div>

      {errorMessage && (
        <div className="glass-panel warning" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000, background: '#ef4444', color: '#fff' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertTriangle size={18} /><strong>{errorMessage}</strong>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="glass-panel teacher" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000, background: '#10b981', color: '#fff' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Check size={18} /><strong>{successMessage}</strong>
          </div>
        </div>
      )}

      {user.role === 'admin' && (
        <AdminDashboard
          user={user} token={token} branding={branding} setBranding={setBranding}
          currentTab={currentTab} setCurrentTab={setCurrentTab}
          handleLogout={handleLogout} apiHost={API_HOST} triggerAlert={triggerAlert}
        />
      )}
      {user.role === 'headteacher' && (
        <HeadteacherDashboard
          user={user} token={token} branding={branding}
          currentTab={currentTab} setCurrentTab={setCurrentTab}
          handleLogout={handleLogout} apiHost={API_HOST} triggerAlert={triggerAlert}
        />
      )}
      {user.role === 'teacher' && (
        <TeacherDashboard
          user={user} token={token} branding={branding}
          currentTab={currentTab} setCurrentTab={setCurrentTab}
          handleLogout={handleLogout} apiHost={API_HOST} triggerAlert={triggerAlert}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PORTAL
// ─────────────────────────────────────────────────────────────────────────────
function LoginPortal({ apiHost, setToken, setUser, setBranding, triggerAlert }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return triggerAlert('Please enter both email and password');
    setLoading(true);
    try {
      const response = await fetch(`${apiHost}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      setLoading(false);
      if (!response.ok) return triggerAlert(data.message || 'Login failed');
      localStorage.setItem('sms_token', data.token);
      localStorage.setItem('sms_user', JSON.stringify(data.user));
      localStorage.setItem('sms_branding', JSON.stringify(data.branding));
      setToken(data.token); setUser(data.user); setBranding(data.branding);
      triggerAlert('Login successful!', false);
    } catch (err) {
      setLoading(false);
      triggerAlert('Network error. Is the server running?');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem', background: '#090d16' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', background: 'linear-gradient(to right, #00f2fe, #d946ef)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Malawi School Manager
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Central Ecosystem Login Portal</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>School Email Address</label>
            <input type="email" placeholder="e.g. admin@school.mw" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Account Password</label>
            <input type="password" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary admin" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Protected by database constraints lock system.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: TEACHERS LIST PANEL (used by Admin & Headteacher)
// ─────────────────────────────────────────────────────────────────────────────
function TeachersListPanel({ teachers, roleTheme = 'admin' }) {
  if (!teachers || teachers.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.9rem' }}>
        No teaching staff registered yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {teachers.map(t => (
        <div key={t.id} style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: '8px',
          padding: '0.9rem 1.1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <strong style={{ fontSize: '0.95rem' }}>{t.full_name}</strong>
              <span className={`status-pill ${t.role === 'headteacher' ? 'pending' : 'success'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}>
                {t.role === 'headteacher' ? 'Head Teacher' : 'Teacher'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.email}</div>
            {t.assigned_subjects && t.assigned_subjects.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {t.assigned_subjects.map(subj => (
                  <span key={subj} style={{
                    background: roleTheme === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(217,70,239,0.15)',
                    color: roleTheme === 'admin' ? 'var(--color-admin)' : 'var(--color-head)',
                    fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                    border: `1px solid ${roleTheme === 'admin' ? 'rgba(99,102,241,0.3)' : 'rgba(217,70,239,0.3)'}`
                  }}>{subj}</span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No subjects assigned</span>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <div>Classes:</div>
            <strong style={{ color: '#fff' }}>{(t.assigned_classes || []).join(', ') || '—'}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT CARD COMPONENT (printable)
// ─────────────────────────────────────────────────────────────────────────────
function ReportCard({ student, scores, branding, isApproved, onClose }) {
  const subjectScores = scores.filter(s => s.student_id === student.id);
  const average = subjectScores.length > 0
    ? Math.round(subjectScores.reduce((sum, s) => sum + s.score, 0) / subjectScores.length)
    : 0;

  // class position is passed in from parent context
  const position = student.class_position || '—';

  const handlePrint = () => {
    const el = document.getElementById('report-card-printable');
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Report Card - ${student.full_name}</title>
          <style>
            body { font-family: 'Georgia', serif; margin: 40px; color: #000; background: #fff; }
            h1 { font-size: 1.4rem; margin: 0; } h2 { font-size: 1.1rem; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 0.9rem; }
            th { background: #f0f0f0; }
            .grade-A { color: #16a34a; font-weight: bold; }
            .grade-B { color: #2563eb; font-weight: bold; }
            .grade-C { color: #d97706; font-weight: bold; }
            .grade-D { color: #ea580c; font-weight: bold; }
            .grade-F { color: #dc2626; font-weight: bold; }
            .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 12px; margin-bottom: 16px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.85rem; margin-bottom: 1rem; }
            .meta-item { display: flex; gap: 4px; } .meta-label { color: #666; }
            .summary { display: flex; gap: 40px; margin-top: 1.2rem; padding: 12px; background: #f8f8f8; border: 1px solid #ccc; }
            .sum-box { text-align: center; }
            .sum-num { font-size: 1.8rem; font-weight: bold; }
            .stamp { border: 3px solid #1a237e; color: #1a237e; padding: 6px 16px; display: inline-block; transform: rotate(-3deg); font-weight: bold; font-size: 0.85rem; margin-top: 8px; }
            .sig-line { border-top: 1px solid #666; width: 200px; margin-top: 40px; padding-top: 4px; font-size: 0.8rem; color: #555; }
          </style>
        </head>
        <body>${el.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', zIndex: 3000, overflowY: 'auto', padding: '2rem 1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '720px' }}>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1rem' }}>
          <button className="btn btn-secondary" onClick={handlePrint} style={{ fontSize: '0.85rem' }}>
            <Printer size={14} /> Print Report Card
          </button>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.85rem' }}>
            Close
          </button>
        </div>

        {/* Report Card Body */}
        <div id="report-card-printable" style={{
          background: '#fff', color: '#111', borderRadius: '8px',
          padding: '2.5rem', fontFamily: 'Georgia, serif'
        }}>
          {/* School Header */}
          <div style={{ textAlign: 'center', borderBottom: '3px double #333', paddingBottom: '1rem', marginBottom: '1.2rem' }}>
            {branding?.logo && (
              <img src={branding.logo} alt="Logo" style={{ height: 64, marginBottom: '0.5rem' }} />
            )}
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '0.05em' }}>
              {branding?.name || 'MALAWI SCHOOL'}
            </h1>
            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.3rem', whiteSpace: 'pre-line' }}>
              {branding?.letterhead}
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Academic Progress Report Card
            </div>
            <div style={{ fontSize: '0.85rem', color: '#444', marginTop: '0.2rem' }}>
              {branding?.academic_headers?.term} | {branding?.academic_headers?.year} | {branding?.academic_headers?.exam_type}
            </div>
          </div>

          {/* Student Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.88rem', marginBottom: '1.2rem', padding: '0.8rem', background: '#f8f8f8', border: '1px solid #ddd', borderRadius: '4px' }}>
            {[
              ['Student Name', student.full_name],
              ['Roll Number', student.roll_number],
              ['Class / Form', student.class_name],
              ['Parent / Guardian', student.parent_name || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: '0.4rem' }}>
                <span style={{ color: '#666', minWidth: '120px' }}>{label}:</span>
                <strong>{val}</strong>
              </div>
            ))}
          </div>

          {/* Scores Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.2rem' }}>
            <thead>
              <tr style={{ background: '#e8e8e8' }}>
                <th style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'left' }}>Subject</th>
                <th style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'center', width: '80px' }}>Score (%)</th>
                <th style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'center', width: '60px' }}>Grade</th>
                <th style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'left' }}>Teacher's Remarks</th>
              </tr>
            </thead>
            <tbody>
              {subjectScores.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #ccc', padding: '1rem', textAlign: 'center', color: '#888' }}>
                    No scores recorded yet.
                  </td>
                </tr>
              ) : (
                subjectScores.map((s, idx) => {
                  const grade = getGradeLetter(s.score);
                  const gradeColors = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626' };
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ border: '1px solid #ccc', padding: '8px 12px' }}>{s.subject}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'center', fontWeight: '700' }}>{s.score}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px 12px', textAlign: 'center', fontWeight: '800', color: gradeColors[grade] }}>{grade}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px 12px', fontSize: '0.82rem', color: '#444' }}>{s.teacher_remarks || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Summary Row */}
          <div style={{ display: 'flex', gap: '2rem', padding: '1rem', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '1.5rem' }}>
            {[
              ['Total Subjects', subjectScores.length],
              ['Overall Average', `${average}%`],
              ['Overall Grade', getGradeLetter(average)],
              ['Class Position', position],
            ].map(([label, val]) => (
              <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#111' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
            <div>
              <div style={{ borderTop: '1px solid #666', width: '180px', paddingTop: '4px', fontSize: '0.78rem', color: '#555' }}>
                Class Teacher's Signature
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              {isApproved ? (
                <div style={{
                  border: '3px solid #1a237e', color: '#1a237e', padding: '6px 16px',
                  display: 'inline-block', transform: 'rotate(-2deg)',
                  fontWeight: '800', fontSize: '0.85rem', letterSpacing: '0.08em'
                }}>
                  ✓ APPROVED BY HEADTEACHER
                </div>
              ) : (
                <div style={{ color: '#999', fontSize: '0.8rem', fontStyle: 'italic' }}>Pending Headteacher Approval</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ borderTop: '1px solid #666', width: '180px', paddingTop: '4px', fontSize: '0.78rem', color: '#555', marginLeft: 'auto' }}>
                Headteacher's Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard({ user, token, branding, setBranding, currentTab, setCurrentTab, handleLogout, apiHost, triggerAlert }) {
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [notificationConfigs, setNotificationConfigs] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [classesWithFees, setClassesWithFees] = useState([]);
  const [updatingFees, setUpdatingFees] = useState(false);

  // Teacher registration form
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherRole, setTeacherRole] = useState('teacher');
  const [teacherSex, setTeacherSex] = useState('M');
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);

  // Student form
  const [studentName, setStudentName] = useState('');
  const [studentSex, setStudentSex] = useState('M');
  const [studentDisability, setStudentDisability] = useState('');
  const [studentClass, setStudentClass] = useState('Standard 1');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [lastRegisteredStudent, setLastRegisteredStudent] = useState(null);

  // Term / Year filters for viewing historical logs
  const [viewTerm, setViewTerm] = useState(branding?.academic_headers?.term || 'Term 2');
  const [viewYear, setViewYear] = useState(branding?.academic_headers?.year || '2026');

  // Branding
  const [brandName, setBrandName] = useState(branding?.name || '');
  const [brandLogo, setBrandLogo] = useState(branding?.logo || '');
  const [brandLetterhead, setBrandLetterhead] = useState(branding?.letterhead || '');
  const [academicHeaders, setAcademicHeaders] = useState({
    term: branding?.academic_headers?.term || 'Term 2',
    year: branding?.academic_headers?.year || '2026',
    exam_type: branding?.academic_headers?.exam_type || 'Terminal Exams'
  });

  // Payment simulation
  const [paymentGateway, setPaymentGateway] = useState('airtel_money');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentPin, setPaymentPin] = useState('');
  const [showPaySimulation, setShowPaySimulation] = useState(false);
  const [simStep, setSimStep] = useState(1);

  const fetchData = async () => {
    try {
      const [billRes, studRes, teachRes, configRes, outboxRes, classFeesRes] = await Promise.all([
        fetch(`${apiHost}/api/billing/status`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiHost}/api/students?term=${encodeURIComponent(viewTerm + ' ' + viewYear)}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiHost}/api/teachers`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiHost}/api/notifications/config`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiHost}/api/notifications/outbox`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiHost}/api/classes-with-fees`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (billRes.ok) { const d = await billRes.json(); setSchool(d.school); setTransactions(d.transactions); }
      if (studRes.ok) setStudents(await studRes.json());
      if (teachRes.ok) {
        const teacherPayload = await teachRes.json();
        setTeachers(Array.isArray(teacherPayload) ? teacherPayload : teacherPayload.teachers || []);
      }
      if (configRes.ok) setNotificationConfigs(await configRes.json());
      if (outboxRes.ok) setOutbox(await outboxRes.json());
      if (classFeesRes.ok) {
        const d = await classFeesRes.json();
        setClassesWithFees(d.classes || []);
      }
    } catch (err) { triggerAlert('Failed to load dashboard data.'); }
  };

  const handleSaveClassFees = async (e) => {
    e.preventDefault();
    setUpdatingFees(true);
    try {
      const response = await fetch(`${apiHost}/api/class-fees/bulk`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fees: classesWithFees })
      });
      if (response.ok) {
        triggerAlert('Class fees saved successfully!', false);
        fetchData();
      } else {
        const data = await response.json();
        triggerAlert(data.message || 'Failed to save class fees');
      }
    } catch (err) {
      triggerAlert('Network error saving class fees');
    } finally {
      setUpdatingFees(false);
    }
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('refresh-data', fetchData);
    return () => window.removeEventListener('refresh-data', fetchData);
  }, [token, viewTerm, viewYear]);

  const toggleSubjectSelection = (subject) => {
    setTeacherSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const toggleClassSelection = (cls) => {
    setTeacherClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const handleRegisterTeacher = async (e) => {
    e.preventDefault();
    if (teacherSubjects.length === 0) return triggerAlert('Please assign at least one subject to this teacher');
    try {
      const response = await fetch(`${apiHost}/api/auth/register-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: teacherName, email: teacherEmail, password: teacherPassword,
          full_name: teacherName, role: teacherRole,
          sex: teacherSex,
          assigned_subjects: teacherSubjects,
          assigned_classes: teacherClasses
        })
      });
      const data = await response.json();
      if (!response.ok) return triggerAlert(data.message || 'Registration failed');
      triggerAlert(`${teacherRole === 'headteacher' ? 'Headteacher' : 'Teacher'} account created successfully!`, false);
      setTeacherName(''); setTeacherEmail(''); setTeacherPassword('');
      setTeacherSubjects([]); setTeacherClasses([]);
      fetchData();
    } catch (err) { triggerAlert('Failed to register user.'); }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiHost}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          full_name: studentName, 
          class_name: studentClass, 
          parent_name: parentName, 
          parent_phone: parentPhone,
          sex: studentSex,
          disability: studentDisability || null,
          amount_paid: parseFloat(initialPayment || 0)
        })
      });
      const data = await response.json();
      if (!response.ok) return triggerAlert(data.message || 'Failed to add student');
      triggerAlert(`${studentName} registered successfully!`, false);
      setLastRegisteredStudent(data.student);
      setStudentName(''); 
      setStudentSex('M');
      setStudentDisability('');
      setParentName(''); 
      setParentPhone('');
      setInitialPayment('');
      fetchData();
    } catch (err) { triggerAlert('Network error adding student'); }
  };

  const handleDeleteStudent = async (id, name) => {
    if (!window.confirm(`Delete ${name}? This will decrement the billing counter.`)) return;
    try {
      const response = await fetch(`${apiHost}/api/students/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) { triggerAlert('Student removed. Invoice updated.', false); fetchData(); }
      else triggerAlert('Failed to remove student');
    } catch (err) { console.error(err); }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiHost}/api/school/branding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: brandName, logo: brandLogo, letterhead: brandLetterhead, academic_headers: academicHeaders })
      });
      if (response.ok) {
        const updated = { name: brandName, logo: brandLogo, letterhead: brandLetterhead, academic_headers: academicHeaders };
        localStorage.setItem('sms_branding', JSON.stringify(updated));
        setBranding(updated);
        triggerAlert('Branding configuration saved!', false);
      } else triggerAlert('Failed to update branding');
    } catch (err) { console.error(err); }
  };

  const handleSaveNotifConfig = async (e, configIndex) => {
    e.preventDefault();
    const conf = notificationConfigs[configIndex];
    try {
      const response = await fetch(`${apiHost}/api/notifications/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify([conf])
      });
      if (response.ok) triggerAlert('Template saved!', false);
      else triggerAlert('Failed to save notification parameters');
    } catch (err) { console.error(err); }
  };

  const handleBroadcastNotification = async (type) => {
    try {
      const response = await fetch(`${apiHost}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ template_type: type })
      });
      const data = await response.json();
      if (response.ok) { triggerAlert(`Broadcast dispatched! ${data.count} alerts sent.`, false); fetchData(); }
      else triggerAlert(data.message || 'Broadcast failed');
    } catch (err) { console.error(err); }
  };

  const handleSimulatePayment = () => {
    if (!paymentPhone) return triggerAlert('Mobile wallet number required');
    setSimStep(2);
  };

  const handleConfirmPin = async () => {
    if (!paymentPin || paymentPin.length < 4) return triggerAlert('4-Digit wallet PIN required');
    try {
      const response = await fetch(`${apiHost}/api/billing/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ gateway: paymentGateway, phone_number: paymentPhone, amount: school.balance_due })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSimStep(3);
        setTimeout(() => { setShowPaySimulation(false); setSimStep(1); setPaymentPhone(''); setPaymentPin(''); fetchData(); }, 3000);
      } else { triggerAlert(data.message || 'Payment simulation failed'); setSimStep(1); }
    } catch (err) { triggerAlert('Payment server error'); }
  };

  return (
    <>
      <aside className="sidebar">
        <div>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--color-admin)', fontWeight: '800' }}>ADMIN PORTAL</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.full_name || 'Administrator'}</span>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              ['dashboard', LayoutDashboard, 'Overview & Branding'],
              ['fees', CreditCard, 'Fee Management'],
              ['class-subjects', BookOpen, 'Class Subjects'],
              ['subjects', Users, 'Student Registration'],
              ['class-rosters', LayoutGrid, 'Class Rosters'],
              ['teachers', UserPlus, 'Teacher Management'],
              ['alumni', Archive, 'Alumni Records'],
              ['billing', CreditCard, 'Invoicing & Licensing'],
              ['notifications', Bell, 'Parent Notifications'],
            ].map(([tab, Icon, label]) => (
              <button key={tab} className={`btn ${currentTab === tab ? 'btn-primary admin' : 'btn-secondary'}`}
                style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setCurrentTab(tab)}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--color-danger)' }} onClick={handleLogout}>
          <LogOut size={18} /> Log Out
        </button>
      </aside>

      <main className="main-content">
        <header className="branding-header">
          <div className="branding-logo-title">
            {branding?.logo
              ? <img src={branding.logo} alt="Logo" />
              : <div style={{ height: 60, width: 60, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border-glass)' }}>🏫</div>
            }
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{branding?.name || 'Malawi School System'}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{branding?.academic_headers?.term} | {branding?.academic_headers?.year} | {branding?.academic_headers?.exam_type}</p>
            </div>
          </div>
          <div>
            {school?.is_locked
              ? <span className="status-pill danger" style={{ animation: 'pulse 1.5s infinite' }}>Account Suspended</span>
              : <span className="status-pill success">Account Active</span>
            }
          </div>
        </header>

        {/* ── OVERVIEW & BRANDING ── */}
        {currentTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-panel admin">
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--color-admin)' }}>Title & Branding Configuration</h2>
              <form onSubmit={handleSaveBranding} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>School Official Registered Name</label>
                  <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>School Logo (Base64 / URL)</label>
                  <input type="text" placeholder="data:image/png;base64,..." value={brandLogo} onChange={(e) => setBrandLogo(e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Letterhead Details</label>
                  <textarea rows={3} placeholder="P.O Box, email, contact..." value={brandLetterhead} onChange={(e) => setBrandLetterhead(e.target.value)} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', margin: '0.5rem 0', color: 'var(--color-admin)' }}>Academic Calendar Headers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[['Active Term', 'term'], ['Academic Year', 'year'], ['Examination Type', 'exam_type']].map(([lbl, key]) => (
                      <div key={key}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lbl}</label>
                        <input type="text" value={academicHeaders[key]} onChange={(e) => setAcademicHeaders({ ...academicHeaders, [key]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary admin"><Save size={16} /> Save Branding Config</button>
                </div>
              </form>
            </div>

            <div className="glass-panel admin">
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-admin)' }}>Class Fees Configuration</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Define the termly fee amount for each class. These fees will automatically establish the default balances for student registrations.
              </p>
              <form onSubmit={handleSaveClassFees} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.2rem' }}>
                  {classesWithFees.map((cls, idx) => (
                    <div key={cls.id} style={{ 
                      background: 'rgba(29, 78, 216, 0.03)', 
                      border: '1px solid var(--border-glass)', 
                      borderRadius: '8px', 
                      padding: '1.2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                      boxShadow: 'var(--shadow-card)'
                    }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{cls.class_name}</strong>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Termly Fee (MK)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                          value={cls.fee_amount || ''} 
                          onChange={(e) => {
                            const updated = [...classesWithFees];
                            updated[idx] = { ...cls, fee_amount: e.target.value };
                            setClassesWithFees(updated);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary admin" disabled={updatingFees}>
                    <Save size={16} /> {updatingFees ? 'Saving...' : 'Save Class Fees'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {currentTab === 'fees' && (
          <div>
            <FeeManagementDashboard token={token} schoolId={user.school_id} triggerAlert={triggerAlert} />
          </div>
        )}

        {currentTab === 'class-subjects' && (
          <div>
            <ClassSubjectsAssignment token={token} triggerAlert={triggerAlert} />
          </div>
        )}

        {currentTab === 'subjects' && (
          <div>
            <StudentSubjectRegistration token={token} schoolId={user.school_id} triggerAlert={triggerAlert} />
          </div>
        )}

        {currentTab === 'class-rosters' && (
          <div>
            <ClassSubjectRoster token={token} triggerAlert={triggerAlert} />
          </div>
        )}

        {currentTab === 'teachers' && (
          <div>
            <TeacherManagement token={token} schoolId={user.school_id} triggerAlert={triggerAlert} />
          </div>
        )}

        {currentTab === 'alumni' && (
          <div>
            <AlumniManagement token={token} schoolId={user.school_id} triggerAlert={triggerAlert} />
          </div>
        )}

        {/* ── STUDENTS ── */}
        {currentTab === 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Student Directory</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-admin)' }}>{students.length}</span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="timetable-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Student Name</th>
                      <th>Roll Number</th>
                      <th>Class</th>
                      <th>Sex</th>
                      <th>Disability</th>
                      <th>Parent Name</th>
                      <th>Parent Contact</th>
                      <th>Fee Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students registered.</td></tr>
                    ) : students.map(s => (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'left', fontWeight: '600' }}>{s.full_name}</td>
                        <td><code>{s.roll_number}</code></td>
                        <td>{s.class_name}</td>
                        <td>{s.sex || 'M'}</td>
                        <td>{s.disability || 'None'}</td>
                        <td>{s.parent_name || '-'}</td>
                        <td>{s.parent_phone || '-'}</td>
                        <td>
                          {parseFloat(s.balance || 0) > 0 ? (
                            <span style={{ 
                              border: '2px solid var(--color-danger)', 
                              color: 'var(--color-danger)', 
                              background: 'rgba(220, 38, 38, 0.08)',
                              padding: '0.25rem 0.6rem', 
                              borderRadius: '6px', 
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              display: 'inline-block'
                            }}>
                              MK {parseFloat(s.balance).toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ 
                              border: '2px solid var(--color-teacher)', 
                              color: 'var(--color-teacher)', 
                              background: 'rgba(5, 150, 105, 0.08)',
                              padding: '0.25rem 0.6rem', 
                              borderRadius: '6px', 
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              display: 'inline-block'
                            }}>
                              Complete
                            </span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem', color: 'var(--color-danger)' }} onClick={() => handleDeleteStudent(s.id, s.full_name)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel admin">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: 'var(--color-admin)' }}>Register New Student</h3>
              <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  ['Full Name', 'text', studentName, setStudentName, 'Full Name'],
                  ['Parent / Guardian Name', 'text', parentName, setParentName, 'Parent Name'],
                  ['Parent Mobile Number', 'text', parentPhone, setParentPhone, '+265999XXXXXX'],
                ].map(([lbl, type, val, setter, ph]) => (
                  <div key={lbl}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lbl}</label>
                    <input type={type} value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sex</label>
                  <select value={studentSex} onChange={(e) => setStudentSex(e.target.value)}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Disability Details</label>
                  <input type="text" placeholder="e.g. None or Visual (difficulty seeing)" value={studentDisability} onChange={(e) => setStudentDisability(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assigned Class</label>
                  <select value={studentClass} onChange={(e) => setStudentClass(e.target.value)}>
                    {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Initial Fee Payment (MK)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    placeholder="0.00" 
                    value={initialPayment} 
                    onChange={(e) => setInitialPayment(e.target.value)} 
                  />
                </div>

                {/* Live Preview Indicator */}
                {(() => {
                  const selectedClassFeeObj = classesWithFees.find(c => c.class_name === studentClass);
                  const selectedClassFee = selectedClassFeeObj ? parseFloat(selectedClassFeeObj.fee_amount) : 0;
                  const paid = parseFloat(initialPayment || 0);
                  const liveBalance = selectedClassFee - paid;

                  return (
                    <div style={{
                      border: liveBalance > 0 ? '2px solid var(--color-danger)' : '2px solid var(--color-teacher)',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      background: liveBalance > 0 ? 'rgba(220, 38, 38, 0.03)' : 'rgba(5, 150, 105, 0.03)',
                      marginTop: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Class Fee:</span>
                        <strong>MK {selectedClassFee.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Initial Payment:</span>
                        <strong>MK {paid.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingTop: '0.3rem', borderTop: '1px solid var(--border-glass)', marginTop: '0.2rem' }}>
                        <span style={{ fontWeight: '700' }}>Live Balance:</span>
                        <strong style={{ color: liveBalance > 0 ? 'var(--color-danger)' : 'var(--color-teacher)' }}>
                          {liveBalance > 0 ? `MK ${liveBalance.toFixed(2)}` : 'Complete'}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                <button type="submit" className="btn btn-primary admin" style={{ width: '100%', marginTop: '0.5rem' }}>
                  <Plus size={16} /> Register Student
                </button>
              </form>
            </div>

            {/* Success Feedback Modal */}
            {lastRegisteredStudent && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 3000
              }}>
                <div className="glass-panel admin" style={{ width: '100%', maxWidth: '420px', padding: '2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', color: 'var(--color-teacher)', marginBottom: '1rem' }}>🎉</div>
                  <h3 style={{ color: 'var(--color-admin)', fontSize: '1.3rem', marginBottom: '0.5rem' }}>Student Registered!</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    <strong>{lastRegisteredStudent.full_name}</strong> has been enrolled in <strong>{lastRegisteredStudent.class_name}</strong>.
                  </p>
                  
                  <div style={{
                    border: lastRegisteredStudent.balance > 0 ? '2px solid var(--color-danger)' : '2px solid var(--color-teacher)',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: lastRegisteredStudent.balance > 0 ? 'rgba(220,38,38,0.03)' : 'rgba(5,150,105,0.03)',
                    marginBottom: '1.5rem',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Class Fee:</span>
                      <strong>MK {parseFloat(lastRegisteredStudent.fee_amount || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Amount Paid:</span>
                      <strong>MK {parseFloat(lastRegisteredStudent.amount_paid || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-glass)' }}>
                      <span style={{ fontWeight: '700' }}>Balance:</span>
                      <strong style={{ color: lastRegisteredStudent.balance > 0 ? 'var(--color-danger)' : 'var(--color-teacher)' }}>
                        {lastRegisteredStudent.balance > 0 ? `MK ${parseFloat(lastRegisteredStudent.balance).toFixed(2)}` : 'Complete'}
                      </strong>
                    </div>
                  </div>
                  
                  <button className="btn btn-primary admin" style={{ width: '100%' }} onClick={() => setLastRegisteredStudent(null)}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BILLING ── */}
        {currentTab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div className="glass-panel admin">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--color-admin)' }}>Billing & Licensing Panel</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                  {[
                    ['Total Enrolled Students', `${school?.student_count || 0} Students`],
                    ['Term Licensing Flat Rate', 'K500 / Student'],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-glass)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                      <strong>{val}</strong>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-glass)', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Lockout Status</span>
                    {school?.is_locked
                      ? <span className="status-pill danger">LOCKED</span>
                      : <span className="status-pill success">UNLOCKED</span>
                    }
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', color: 'var(--color-admin)' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>Outstanding Total</span>
                    <strong style={{ fontSize: '1.6rem', fontWeight: '800' }}>K{school?.balance_due || 0}.00</strong>
                  </div>
                </div>
                {school?.balance_due > 0 && (
                  <button className="btn btn-primary admin" style={{ width: '100%' }} onClick={() => setShowPaySimulation(true)}>
                    Settle License Invoice Now
                  </button>
                )}
              </div>

              <div className="glass-panel">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#fff' }}>Payments Ledger</h2>
                <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                  {transactions.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '2rem' }}>No transaction history.</p>
                  ) : transactions.map(tx => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--border-glass)', fontSize: '0.9rem' }}>
                      <div>
                        <strong>{tx.gateway.toUpperCase().replace('_', ' ')}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ref: {tx.transaction_ref} | {new Date(tx.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--color-teacher)', fontWeight: '700' }}>+ K{tx.amount}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.phone_number}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {showPaySimulation && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                <div className="glass-panel admin" style={{ width: '100%', maxWidth: '380px', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                  {simStep === 1 && (
                    <div>
                      <h3 style={{ fontSize: '1.2rem', color: 'var(--color-admin)', marginBottom: '1rem' }}>Local Payment Gateway</h3>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        {['airtel_money', 'tnm_mpamba'].map(gw => (
                          <button key={gw} className={`btn ${paymentGateway === gw ? 'btn-primary admin' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setPaymentGateway(gw)}>
                            {gw === 'airtel_money' ? 'Airtel Money' : 'TNM Mpamba'}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Phone Number</label>
                        <input type="text" placeholder="0999123456" value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPaySimulation(false)}>Cancel</button>
                        <button className="btn btn-primary admin" style={{ flex: 1 }} onClick={handleSimulatePayment}>Request Push</button>
                      </div>
                    </div>
                  )}
                  {simStep === 2 && (
                    <div>
                      <div className="pulse" style={{ fontSize: '3rem', color: 'var(--color-admin)', marginBottom: '1rem' }}>📲</div>
                      <h3 style={{ fontSize: '1.1rem', color: 'var(--color-admin)', marginBottom: '1rem' }}>Enter Wallet PIN</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Authorize payment of <strong>K{school.balance_due}</strong>
                      </p>
                      <div style={{ marginBottom: '1.5rem' }}>
                        <input type="password" placeholder="4-Digit PIN" maxLength={4} style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }} value={paymentPin} onChange={(e) => setPaymentPin(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSimStep(1)}>Back</button>
                        <button className="btn btn-primary admin" style={{ flex: 1 }} onClick={handleConfirmPin}>Authorize</button>
                      </div>
                    </div>
                  )}
                  {simStep === 3 && (
                    <div>
                      <div style={{ fontSize: '3rem', color: 'var(--color-teacher)', marginBottom: '1rem' }}>✅</div>
                      <h3 style={{ color: 'var(--color-teacher)' }}>Payment Authorized</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>School account unlocked successfully.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {currentTab === 'notifications' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel admin">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-admin)' }}>Parent Alert Templates</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Placeholders: <code>{'{parent_name}'}</code> <code>{'{student_name}'}</code> <code>{'{school_name}'}</code> <code>{'{balance_due}'}</code> <code>{'{payment_link}'}</code> <code>{'{academic_header}'}</code> <code>{'{score_details}'}</code>
                </p>
                {notificationConfigs.map((cfg, idx) => (
                  <form key={cfg.id} onSubmit={(e) => handleSaveNotifConfig(e, idx)} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <strong style={{ fontSize: '0.95rem', textTransform: 'capitalize', color: 'var(--color-admin)' }}>{cfg.template_type.replace('_', ' ')}</strong>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <select style={{ padding: '0.2rem 0.5rem', width: 'auto' }} value={cfg.channel} onChange={(e) => { const u = [...notificationConfigs]; u[idx].channel = e.target.value; setNotificationConfigs(u); }}>
                          <option value="sms">SMS</option>
                          <option value="whatsapp">WhatsApp</option>
                        </select>
                        <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.85rem' }}>
                          <input type="checkbox" checked={cfg.is_enabled} style={{ width: 'auto' }} onChange={(e) => { const u = [...notificationConfigs]; u[idx].is_enabled = e.target.checked; setNotificationConfigs(u); }} />
                          Active
                        </label>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '1rem' }}>
                      <textarea rows={2} value={cfg.message_template} onChange={(e) => { const u = [...notificationConfigs]; u[idx].message_template = e.target.value; setNotificationConfigs(u); }} required />
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Time Limit (Days)</label>
                        <input type="number" value={cfg.time_limit_days} onChange={(e) => { const u = [...notificationConfigs]; u[idx].time_limit_days = parseInt(e.target.value) || 0; setNotificationConfigs(u); }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => handleBroadcastNotification(cfg.template_type)}>
                        <Send size={12} /> Test Broadcast
                      </button>
                      <button type="submit" className="btn btn-primary admin" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Save Parameters</button>
                    </div>
                  </form>
                ))}
              </div>
            </div>
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: '#fff' }}>Dispatch Log</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '450px' }}>
                {outbox.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', paddingTop: '2rem' }}>Outbox is empty.</p>
                ) : outbox.map(log => (
                  <div key={log.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                      <span>To: <strong>{log.recipient_phone}</strong></span>
                      <span>{log.channel.toUpperCase()}</span>
                    </div>
                    <p style={{ fontStyle: 'italic', margin: '0.4rem 0' }}>"{log.message_content}"</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>{new Date(log.sent_at).toLocaleTimeString()}</span>
                      <span style={{ color: 'var(--color-teacher)', fontWeight: '700' }}>✓ SENT</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STAFF MANAGEMENT ── */}
        {currentTab === 'teachers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
            {/* Teachers List */}
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Academic Staff Directory</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-admin)' }}>{teachers.length}</span>
                </div>
              </div>
              <div className="glass-panel warning" style={{ marginBottom: '1.5rem', background: 'rgba(245, 158, 11, 0.05)' }}>
                <h4 style={{ color: 'var(--color-warning)', fontSize: '0.9rem' }}>Constraint: One Headteacher per school</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>A partial unique index <code>unique_headteacher_per_school</code> is enforced in PostgreSQL.</p>
              </div>
              <TeachersListPanel teachers={teachers} roleTheme="admin" />
            </div>

            {/* Register Teacher Form */}
            <div className="glass-panel admin">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: 'var(--color-admin)' }}>Register Academic Staff</h3>
              <form onSubmit={handleRegisterTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  ['Full Name', 'text', teacherName, setTeacherName, ''],
                  ['Email Address', 'email', teacherEmail, setTeacherEmail, 'e.g. phiri@school.mw'],
                  ['Initial Password', 'password', teacherPassword, setTeacherPassword, ''],
                ].map(([lbl, type, val, setter, ph]) => (
                  <div key={lbl}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lbl}</label>
                    <input type={type} value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} required />
                  </div>
                ))}

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Role Assignment</label>
                  <select value={teacherRole} onChange={(e) => setTeacherRole(e.target.value)}>
                    <option value="teacher">Teacher (Unlimited)</option>
                    <option value="headteacher">Headteacher (One per school)</option>
                  </select>
                </div>

                {/* Subject Assignment */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                    Assigned Subjects <span style={{ color: 'var(--color-admin)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {ALL_SUBJECTS.map(subj => (
                      <button key={subj} type="button"
                        onClick={() => toggleSubjectSelection(subj)}
                        style={{
                          padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer',
                          border: teacherSubjects.includes(subj) ? '1px solid var(--color-admin)' : '1px solid var(--border-glass)',
                          background: teacherSubjects.includes(subj) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                          color: teacherSubjects.includes(subj) ? 'var(--color-admin)' : 'var(--text-muted)',
                          transition: 'all 0.15s'
                        }}>
                        {teacherSubjects.includes(subj) ? '✓ ' : ''}{subj}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Class Assignment */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                    Assigned Classes
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {ALL_CLASSES.map(cls => (
                      <button key={cls} type="button"
                        onClick={() => toggleClassSelection(cls)}
                        style={{
                          padding: '0.3rem 0.7rem', fontSize: '0.78rem', borderRadius: '4px', cursor: 'pointer',
                          border: teacherClasses.includes(cls) ? '1px solid var(--color-admin)' : '1px solid var(--border-glass)',
                          background: teacherClasses.includes(cls) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                          color: teacherClasses.includes(cls) ? 'var(--color-admin)' : 'var(--text-muted)',
                        }}>
                        {teacherClasses.includes(cls) ? '✓ ' : ''}{cls}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary admin" style={{ width: '100%', marginTop: '0.5rem' }}>
                  Register Staff Member
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADTEACHER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function HeadteacherDashboard({ user, token, branding, currentTab, setCurrentTab, handleLogout, apiHost, triggerAlert }) {
  const [unapprovedReports, setUnapprovedReports] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);
  const [academicTerm, setAcademicTerm] = useState('Term 2');
  const [academicYear, setAcademicYear] = useState('2026');
  const [teachers, setTeachers] = useState([]);
  const [allScores, setAllScores] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [viewingReport, setViewingReport] = useState(null); // student object

  const fetchData = async () => {
    try {
      const [scoresRes, teachRes, studRes] = await Promise.all([
        fetch(`${apiHost}/api/scores?term=${encodeURIComponent(academicTerm + ' ' + academicYear)}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiHost}/api/teachers`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiHost}/api/students`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (scoresRes.ok) {
        const data = await scoresRes.json();
        setUnapprovedReports(data.filter(r => !r.headteacher_approved));
        setAllScores(data);
      }
      if (teachRes.ok) {
        const data = await teachRes.json();
        setTeachers(Array.isArray(data) ? data : data.teachers || []);
      }
      if (studRes.ok) setAllStudents(await studRes.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('refresh-data', fetchData);
    return () => window.removeEventListener('refresh-data', fetchData);
  }, [token, academicTerm, academicYear]);

  const toggleSelectReport = (id) => {
    setSelectedReports(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const handleApproveSelected = async () => {
    if (selectedReports.length === 0) return;
    try {
      const response = await fetch(`${apiHost}/api/scores/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ report_ids: selectedReports })
      });
      if (response.ok) {
        triggerAlert(`Approved ${selectedReports.length} report cards. Parent alerts fired!`, false);
        setSelectedReports([]);
        fetchData();
      } else triggerAlert('Failed to approve report cards');
    } catch (err) { console.error(err); }
  };

  const handleApproveAllPending = async () => {
    try {
      const response = await fetch(`${apiHost}/api/scores/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ approve_all: true, term: `${academicTerm} ${academicYear}`, report_ids: [] })
      });
      if (response.ok) {
        triggerAlert(`All pending report cards for ${academicTerm} ${academicYear} approved! Parent alerts fired!`, false);
        setSelectedReports([]);
        fetchData();
      } else triggerAlert('Failed to approve report cards');
    } catch (err) { console.error(err); }
  };

  const handlePrintAllForClass = (className, clsStudents) => {
    const win = window.open('', '_blank');
    let htmlContent = `
      <html>
        <head>
          <title>${className} Report Cards</title>
          <style>
            body { font-family: 'Georgia', serif; margin: 40px; color: #000; background: #fff; }
            h1 { font-size: 1.4rem; margin: 0; } h2 { font-size: 1.1rem; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 0.9rem; }
            th { background: #f0f0f0; }
            .grade-A { color: #16a34a; font-weight: bold; }
            .grade-B { color: #2563eb; font-weight: bold; }
            .grade-C { color: #d97706; font-weight: bold; }
            .grade-D { color: #ea580c; font-weight: bold; }
            .grade-F { color: #dc2626; font-weight: bold; }
            .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 12px; margin-bottom: 16px; }
            .summary { display: flex; gap: 40px; margin-top: 1.2rem; padding: 12px; background: #f8f8f8; border: 1px solid #ccc; }
            .report-card { page-break-after: always; break-after: page; border: 1px solid #eee; padding: 30px; border-radius: 8px; margin-bottom: 40px; }
            @media print {
              .report-card { border: none; padding: 0; margin-bottom: 0; }
            }
          </style>
        </head>
        <body>
    `;

    clsStudents.forEach(student => {
      const studentScores = student.scores || [];
      const average = student.average || 0;
      const position = student.class_position || '—';
      const isApproved = student.allApproved;

      htmlContent += `
        <div class="report-card">
          <div class="header">
            ${branding?.logo ? `<img src="${branding.logo}" style="height: 64px; margin-bottom: 0.5rem;" />` : ''}
            <h1>${branding?.name || 'MALAWI SCHOOL'}</h1>
            <div style="font-size: 0.8rem; color: #555; margin-top: 0.3rem; white-space: pre-line;">
              ${branding?.letterhead || ''}
            </div>
            <div style="margin-top: 0.6rem; font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
              Academic Progress Report Card
            </div>
            <div style="font-size: 0.85rem; color: #444; margin-top: 0.2rem;">
              ${branding?.academic_headers?.term || ''} | ${branding?.academic_headers?.year || ''} | ${branding?.academic_headers?.exam_type || ''}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.88rem; margin-bottom: 1.2rem; padding: 0.8rem; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
            <div style="display: flex; gap: 0.4rem;"><span style="color: #666; min-width: 120px;">Student Name:</span><strong>${student.full_name}</strong></div>
            <div style="display: flex; gap: 0.4rem;"><span style="color: #666; min-width: 120px;">Roll Number:</span><strong>${student.roll_number}</strong></div>
            <div style="display: flex; gap: 0.4rem;"><span style="color: #666; min-width: 120px;">Class / Form:</span><strong>${student.class_name}</strong></div>
            <div style="display: flex; gap: 0.4rem;"><span style="color: #666; min-width: 120px;">Parent / Guardian:</span><strong>${student.parent_name || '—'}</strong></div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.2rem;">
            <thead>
              <tr style="background: #e8e8e8;">
                <th style="border: 1px solid #ccc; padding: 8px 12px; text-align: left;">Subject</th>
                <th style="border: 1px solid #ccc; padding: 8px 12px; text-align: center; width: 80px;">Score (%)</th>
                <th style="border: 1px solid #ccc; padding: 8px 12px; text-align: center; width: 60px;">Grade</th>
                <th style="border: 1px solid #ccc; padding: 8px 12px; text-align: left;">Teacher's Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${studentScores.length === 0 ? `
                <tr>
                  <td colspan="4" style="border: 1px solid #ccc; padding: 1rem; text-align: center; color: #888;">
                    No scores recorded yet.
                  </td>
                </tr>
              ` : studentScores.map((s, idx) => {
                  const grade = getGradeLetter(s.score);
                  const gradeColors = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626' };
                  const color = gradeColors[grade] || '#000';
                  return `
                    <tr style="background: ${idx % 2 === 0 ? '#fff' : '#fafafa'}">
                      <td style="border: 1px solid #ccc; padding: 8px 12px;">${s.subject}</td>
                      <td style="border: 1px solid #ccc; padding: 8px 12px; text-align: center; font-weight: 700;">${s.score}</td>
                      <td style="border: 1px solid #ccc; padding: 8px 12px; text-align: center; font-weight: 800; color: ${color};">${grade}</td>
                      <td style="border: 1px solid #ccc; padding: 8px 12px; font-size: 0.82rem; color: #444;">${s.teacher_remarks || '—'}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
          </table>

          <div style="display: flex; gap: 2rem; padding: 1rem; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 1.5rem;">
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Total Subjects</div>
              <div style="font-size: 1.6rem; font-weight: 800; color: #111;">${studentScores.length}</div>
            </div>
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Overall Average</div>
              <div style="font-size: 1.6rem; font-weight: 800; color: #111;">${average}%</div>
            </div>
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Overall Grade</div>
              <div style="font-size: 1.6rem; font-weight: 800; color: #111;">${getGradeLetter(average)}</div>
            </div>
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Class Position</div>
              <div style="font-size: 1.6rem; font-weight: 800; color: #111;">${position}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd;">
            <div>
              <div style="border-top: 1px solid #666; width: 180px; padding-top: 4px; font-size: 0.78rem; color: #555;">
                Class Teacher's Signature
              </div>
            </div>
            <div style="text-align: center;">
              ${isApproved ? `
                <div style="border: 3px solid #1a237e; color: #1a237e; padding: 6px 16px; display: inline-block; transform: rotate(-2deg); font-weight: 800; font-size: 0.85rem; letter-spacing: 0.08em;">
                  ✓ APPROVED BY HEADTEACHER
                </div>
              ` : `
                <div style="color: #999; font-size: 0.8rem; font-style: italic;">Pending Headteacher Approval</div>
              `}
            </div>
            <div style="text-align: right;">
              <div style="border-top: 1px solid #666; width: 180px; padding-top: 4px; font-size: 0.78rem; color: #555; margin-left: auto;">
                Headteacher's Signature
              </div>
            </div>
          </div>
        </div>
      `;
    });

    htmlContent += `
        </body>
      </html>
    `;

    win.document.write(htmlContent);
    win.document.close();
    win.print();
  };

  // Build per-student report summary for the Reports tab
  const studentReportSummaries = allStudents.map(s => {
    const studentScores = allScores.filter(sc => sc.student_id === s.id);
    const avg = studentScores.length > 0
      ? Math.round(studentScores.reduce((sum, sc) => sum + sc.score, 0) / studentScores.length)
      : null;
    const allApproved = studentScores.length > 0 && studentScores.every(sc => sc.headteacher_approved);
    return { ...s, scores: studentScores, average: avg, allApproved, subject_count: studentScores.length };
  });

  // Compute class positions
  const classSummaries = {};
  ALL_CLASSES.forEach(cls => {
    const classStudents = studentReportSummaries
      .filter(s => s.class_name === cls && s.average !== null)
      .sort((a, b) => b.average - a.average);
    classStudents.forEach((s, idx) => { s.class_position = `${idx + 1} / ${classStudents.length}`; });
    classSummaries[cls] = classStudents;
  });

  return (
    <>
      <aside className="sidebar">
        <div>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--color-head)', fontWeight: '800' }}>HEADTEACHER</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.full_name || 'Headteacher'}</span>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              ['dashboard', CheckSquare, 'Card Approvals'],
              ['reports', Award, 'Report Cards'],
              ['teachers', Users, 'Teaching Staff'],
              ['timetable', MessageSquare, 'Timetable Bot'],
            ].map(([tab, Icon, label]) => (
              <button key={tab} className={`btn ${currentTab === tab ? 'btn-primary head' : 'btn-secondary'}`}
                style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setCurrentTab(tab)}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--color-danger)' }} onClick={handleLogout}>
          <LogOut size={18} /> Log Out
        </button>
      </aside>

      <main className="main-content">
        <header className="branding-header">
          <div className="branding-logo-title">
            {branding?.logo
              ? <img src={branding.logo} alt="Logo" />
              : <div style={{ height: 60, width: 60, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border-glass)' }}>🏫</div>
            }
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{branding?.name || 'Malawi School System'}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>High-Level Academic Oversight Portal</p>
            </div>
          </div>
          <span className="status-pill success" style={{ background: 'rgba(217, 70, 239, 0.2)', color: 'var(--color-head)' }}>Academic Approver</span>
        </header>

        {/* Approval Queue */}
        {currentTab === 'dashboard' && (
          <div className="glass-panel head">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Pending Report Card Approvals</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Approving sends results and invoice payment links to parents.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <select value={academicTerm} onChange={(e) => setAcademicTerm(e.target.value)} style={{ width: 'auto' }}>
                  <option>Term 1</option><option>Term 2</option><option>Term 3</option>
                </select>
                <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} style={{ width: 'auto' }}>
                  <option>2026</option><option>2025</option><option>2024</option>
                </select>
                {unapprovedReports.length > 0 && (
                  <button className="btn btn-primary head" style={{ background: 'var(--color-teacher)', border: 'none' }} onClick={handleApproveAllPending}>
                    Approve All Pending ({unapprovedReports.length})
                  </button>
                )}
                {selectedReports.length > 0 && (
                  <button className="btn btn-primary head" onClick={handleApproveSelected}>
                    Approve Selected ({selectedReports.length})
                  </button>
                )}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="timetable-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input type="checkbox"
                        checked={selectedReports.length === unapprovedReports.length && unapprovedReports.length > 0}
                        onChange={() => setSelectedReports(
                          selectedReports.length === unapprovedReports.length ? [] : unapprovedReports.map(r => r.id)
                        )}
                      />
                    </th>
                    <th style={{ textAlign: 'left' }}>Student Name</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th>Score</th>
                    <th>Remarks</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {unapprovedReports.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No pending approvals.</td></tr>
                  ) : unapprovedReports.map(r => (
                    <tr key={r.id}>
                      <td><input type="checkbox" checked={selectedReports.includes(r.id)} onChange={() => toggleSelectReport(r.id)} /></td>
                      <td style={{ textAlign: 'left', fontWeight: '600' }}>{r.full_name}</td>
                      <td>{r.class_name}</td>
                      <td>{r.subject}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.teacher_name || '—'}</td>
                      <td style={{ fontWeight: '700', color: r.score >= 50 ? 'var(--color-teacher)' : 'var(--color-danger)' }}>{r.score}%</td>
                      <td>{r.teacher_remarks || '-'}</td>
                      <td><span className="status-pill pending">Pending</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Cards View */}
        {currentTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {ALL_CLASSES.map(cls => {
              const clsStudents = studentReportSummaries.filter(s => s.class_name === cls);
              if (clsStudents.length === 0) return null;
              return (
                <div key={cls} className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <h2 style={{ fontSize: '1.15rem', color: 'var(--color-head)' }}>{cls} — Report Summary</h2>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{clsStudents.length} Students</span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                        onClick={() => handlePrintAllForClass(cls, clsStudents)}
                      >
                        <Printer size={12} /> Print All
                      </button>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="timetable-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Student Name</th>
                          <th>Subjects Scored</th>
                          <th>Average</th>
                          <th>Grade</th>
                          <th>Position</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clsStudents.map(s => (
                          <tr key={s.id}>
                            <td style={{ textAlign: 'left', fontWeight: '600' }}>{s.full_name}</td>
                            <td>{s.subject_count}</td>
                            <td style={{ fontWeight: '700', color: s.average !== null ? getGradeColor(s.average) : 'var(--text-muted)' }}>
                              {s.average !== null ? `${s.average}%` : '—'}
                            </td>
                            <td style={{ fontWeight: '800', color: s.average !== null ? getGradeColor(s.average) : 'var(--text-muted)' }}>
                              {s.average !== null ? getGradeLetter(s.average) : '—'}
                            </td>
                            <td>{s.class_position || '—'}</td>
                            <td>
                              {s.allApproved
                                ? <span className="status-pill success">Approved</span>
                                : <span className="status-pill pending">Pending</span>
                              }
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                                onClick={() => setViewingReport(s)}
                              >
                                <Eye size={12} /> View Card
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Teachers List */}
        {currentTab === 'teachers' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Teaching Staff</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{teachers.length} members</span>
            </div>
            <TeachersListPanel teachers={teachers} roleTheme="head" />
          </div>
        )}

        {/* Timetable Bot */}
        {currentTab === 'timetable' && (
          <TimetableChatBot token={token} apiHost={apiHost} roleTheme="head" triggerAlert={triggerAlert} />
        )}
      </main>

      {/* Report Card Viewer Overlay */}
      {viewingReport && (
        <ReportCard
          student={viewingReport}
          scores={viewingReport.scores}
          branding={branding}
          isApproved={viewingReport.allApproved}
          onClose={() => setViewingReport(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function TeacherDashboard({ user, token, branding, currentTab, setCurrentTab, handleLogout, apiHost, triggerAlert }) {
  const [students, setStudents] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState({});

  // Teacher's own subjects and classes (from the user object after login)
  const teacherSubjects = user?.assigned_subjects || [];
  const teacherClasses = user?.assigned_classes || ALL_CLASSES;

  const [attendanceClass, setAttendanceClass] = useState(teacherClasses[0] || 'Standard 1');
  const [gradeClass, setGradeClass] = useState(teacherClasses[0] || 'Form 1');
  const [gradeSubject, setGradeSubject] = useState(teacherSubjects[0] || '');
  const [gradeTerm, setGradeTerm] = useState('Term 2');
  const [gradeYear, setGradeYear] = useState('2026');
  const [grades, setGrades] = useState({});
  const [viewingReport, setViewingReport] = useState(null);

  // My-students registration
  const [myStudentName, setMyStudentName] = useState('');
  const [myStudentRoll, setMyStudentRoll] = useState('');
  const [myStudentClass, setMyStudentClass] = useState(teacherClasses[0] || 'Form 1');
  const [myParentName, setMyParentName] = useState('');
  const [myParentPhone, setMyParentPhone] = useState('');
  const [allScores, setAllScores] = useState([]);

  const fetchStudents = async () => {
    try {
      const response = await fetch(`${apiHost}/api/students`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) setStudents(await response.json());
    } catch (err) { console.error(err); }
  };

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`${apiHost}/api/attendance?date=${attendanceDate}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        const map = {};
        data.forEach(a => { map[a.student_id] = a.status; });
        setAttendanceData(map);
      }
    } catch (err) { console.error(err); }
  };

  const fetchGrades = async () => {
    try {
      const response = await fetch(`${apiHost}/api/scores?term=${encodeURIComponent(gradeTerm + ' ' + gradeYear)}&class_name=${gradeClass}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setAllScores(data);
        const map = {};
        data.filter(r => r.subject === gradeSubject).forEach(r => {
          map[r.student_id] = { score: r.score, remarks: r.teacher_remarks, approved: r.headteacher_approved };
        });
        setGrades(map);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchStudents(); }, [token]);
  useEffect(() => { fetchAttendance(); }, [attendanceDate]);
  useEffect(() => { fetchGrades(); }, [gradeClass, gradeSubject, gradeTerm, gradeYear]);

  const handleMarkAttendance = async (studentId, status) => {
    const payload = { student_id: studentId, date: attendanceDate, status };
    setAttendanceData(prev => ({ ...prev, [studentId]: status }));
    if (navigator.onLine) {
      try {
        await fetch(`${apiHost}/api/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
      } catch (err) { console.error(err); }
    } else {
      queueOfflineOperation('attendance', payload);
      triggerAlert('Offline: Attendance cached locally.', false);
    }
  };

  const handleSaveScore = async (studentId) => {
    const scoreData = grades[studentId];
    if (!scoreData?.score && scoreData?.score !== 0) return triggerAlert('Please enter a score');
    const parsed = parseInt(scoreData.score);
    if (parsed < 0 || parsed > 100) return triggerAlert('Score must be 0–100');

    const payload = {
      student_id: studentId, term: `${gradeTerm} ${gradeYear}`, subject: gradeSubject,
      score: parsed, remarks: scoreData.remarks || ''
    };

    if (navigator.onLine) {
      try {
        const response = await fetch(`${apiHost}/api/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (response.ok) { triggerAlert('Grade saved!', false); fetchGrades(); }
        else triggerAlert('Failed to save grade');
      } catch (err) { console.error(err); }
    } else {
      queueOfflineOperation('score', payload);
      triggerAlert('Offline: Grade saved locally.', false);
    }
  };

  const handleRegisterMyStudent = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiHost}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          full_name: myStudentName, roll_number: myStudentRoll,
          class_name: myStudentClass, parent_name: myParentName, parent_phone: myParentPhone
        })
      });
      const data = await response.json();
      if (!response.ok) return triggerAlert(data.message || 'Failed to register student');
      triggerAlert(`${myStudentName} registered successfully!`, false);
      setMyStudentName(''); setMyStudentRoll(''); setMyParentName(''); setMyParentPhone('');
      fetchStudents();
    } catch (err) { triggerAlert('Network error registering student'); }
  };

  // Auto-generate report card for a student (all their scores this term)
  const handleViewStudentReport = (student) => {
    const studentScores = allScores.filter(s => s.student_id === student.id);
    const classmates = students
      .filter(s => s.class_name === student.class_name)
      .map(s => {
        const sc = allScores.filter(x => x.student_id === s.id);
        const avg = sc.length > 0 ? sc.reduce((sum, x) => sum + x.score, 0) / sc.length : 0;
        return { id: s.id, average: avg };
      })
      .sort((a, b) => b.average - a.average);
    const pos = classmates.findIndex(c => c.id === student.id) + 1;
    setViewingReport({ ...student, scores: studentScores, class_position: `${pos} / ${classmates.length}` });
  };

  const remarkPresets = [
    { label: '-- Select Comment Preset --', text: '' },
    { label: 'Academic Excellence', text: 'Outstanding performance. Demonstrates deep understanding of core concepts.' },
    { label: 'Good Progress', text: 'A very good term. Active participation in classroom discussions.' },
    { label: 'Satisfactory Result', text: 'Satisfactory result. Can achieve higher grades with focused practice.' },
    { label: 'Needs Attention', text: 'Needs to put in more effort. Additional studies recommended.' },
    { label: 'Behavioral Alert', text: 'Well-behaved student but needs to minimize classroom distractions.' }
  ];

  // Students for current class
  const classStudents = students.filter(s => s.class_name === gradeClass);

  // Check if all students in the class have a score for this subject (enables "Generate Reports")
  const allScoresEntered = classStudents.length > 0 && classStudents.every(s => grades[s.id]?.score !== undefined && grades[s.id]?.score !== '');

  return (
    <>
      <aside className="sidebar">
        <div>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--color-teacher)', fontWeight: '800' }}>TEACHER</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.full_name || 'Teacher'}</span>
            {teacherSubjects.length > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', justifyContent: 'center' }}>
                {teacherSubjects.map(s => (
                  <span key={s} style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: 'var(--color-teacher)', padding: '0.1rem 0.4rem', borderRadius: '3px', border: '1px solid rgba(16,185,129,0.3)' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              ['dashboard', CheckSquare, 'Daily Register'],
              ['gradebook', BookOpen, 'Grade Book'],
              ['mystudents', UserPlus, 'My Students'],
              ['timetable', MessageSquare, 'Timetable Bot'],
            ].map(([tab, Icon, label]) => (
              <button key={tab} className={`btn ${currentTab === tab ? 'btn-primary teacher' : 'btn-secondary'}`}
                style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setCurrentTab(tab)}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--color-danger)' }} onClick={handleLogout}>
          <LogOut size={18} /> Log Out
        </button>
      </aside>

      <main className="main-content">
        <header className="branding-header">
          <div className="branding-logo-title">
            {branding?.logo
              ? <img src={branding.logo} alt="Logo" />
              : <div style={{ height: 60, width: 60, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border-glass)' }}>🏫</div>
            }
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{branding?.name || 'Malawi School System'}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Teacher Portal — {teacherSubjects.length > 0 ? teacherSubjects.join(', ') : 'No subjects assigned'}
              </p>
            </div>
          </div>
          <span className="status-pill success" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--color-teacher)' }}>Staff Member</span>
        </header>

        {/* ── DAILY REGISTER ── */}
        {currentTab === 'dashboard' && (
          <div className="glass-panel teacher">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Daily Attendance Registry</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Absent marks auto-trigger SMS alerts to parent numbers.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <select value={attendanceClass} onChange={(e) => setAttendanceClass(e.target.value)} style={{ width: 'auto' }}>
                  {teacherClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ width: 'auto' }} />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="timetable-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Student Name</th>
                    <th>Roll Number</th>
                    <th>Class</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.class_name === attendanceClass).length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students in registry.</td></tr>
                  ) : students.filter(s => s.class_name === attendanceClass).map(s => (
                    <tr key={s.id}>
                      <td style={{ textAlign: 'left', fontWeight: '600' }}>{s.full_name}</td>
                      <td><code>{s.roll_number}</code></td>
                      <td>{s.class_name}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          {[['present', 'teacher', 'Present'], ['absent', 'warning', 'Absent'], ['late', null, 'Late']].map(([status, theme, label]) => (
                            <button key={status}
                              className={`btn ${attendanceData[s.id] === status ? `btn-primary ${theme || ''}` : 'btn-secondary'}`}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', ...(status === 'late' && attendanceData[s.id] === 'late' ? { background: '#3b82f6', color: '#fff' } : {}) }}
                              onClick={() => handleMarkAttendance(s.id, status)}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── GRADE BOOK ── */}
        {currentTab === 'gradebook' && (
          <div className="glass-panel teacher">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Subject Marksheet Entry</h2>
              {allScoresEntered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
                  <Award size={14} style={{ color: 'var(--color-teacher)' }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-teacher)' }}>All scores entered — reports ready to generate!</span>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select Class</label>
                <select value={gradeClass} onChange={(e) => setGradeClass(e.target.value)}>
                  {teacherClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Subject <span style={{ color: 'var(--color-teacher)', fontSize: '0.72rem' }}>(your assigned subjects only)</span>
                </label>
                <select value={gradeSubject} onChange={(e) => setGradeSubject(e.target.value)}>
                  {teacherSubjects.length === 0
                    ? <option value="">No subjects assigned</option>
                    : teacherSubjects.map(s => <option key={s} value={s}>{s}</option>)
                  }
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Calendar Term</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={gradeTerm} onChange={(e) => setGradeTerm(e.target.value)}>
                    <option>Term 1</option><option>Term 2</option><option>Term 3</option>
                  </select>
                  <select value={gradeYear} onChange={(e) => setGradeYear(e.target.value)}>
                    <option>2026</option><option>2025</option><option>2024</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="timetable-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Student Name</th>
                    <th>Roll Number</th>
                    <th style={{ width: '100px' }}>Score (%)</th>
                    <th>Teacher Remarks</th>
                    <th>Comment Presets</th>
                    <th>Approval</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students in {gradeClass}.</td></tr>
                  ) : classStudents.map(s => {
                    const scoreData = grades[s.id] || { score: '', remarks: '', approved: false };
                    return (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'left', fontWeight: '600' }}>{s.full_name}</td>
                        <td><code>{s.roll_number}</code></td>
                        <td>
                          <input type="number" value={scoreData.score} disabled={scoreData.approved}
                            onChange={(e) => setGrades({ ...grades, [s.id]: { ...scoreData, score: e.target.value } })}
                            placeholder="0–100" style={{ width: '80px', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <input type="text" value={scoreData.remarks} disabled={scoreData.approved}
                            onChange={(e) => setGrades({ ...grades, [s.id]: { ...scoreData, remarks: e.target.value } })}
                            placeholder="Remarks"
                          />
                        </td>
                        <td>
                          <select disabled={scoreData.approved} style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                            onChange={(e) => { if (e.target.value) setGrades({ ...grades, [s.id]: { ...scoreData, remarks: e.target.value } }); }}>
                            {remarkPresets.map((p, i) => <option key={i} value={p.text}>{p.label}</option>)}
                          </select>
                        </td>
                        <td>
                          {scoreData.approved
                            ? <span className="status-pill success">Approved</span>
                            : <span className="status-pill pending">Pending</span>
                          }
                        </td>
                        <td style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-primary teacher" style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}
                            disabled={scoreData.approved} onClick={() => handleSaveScore(s.id)}>
                            <Save size={12} /> Save
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}
                            onClick={() => handleViewStudentReport(s)}>
                            <Eye size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Auto-generate reports banner */}
            {allScoresEntered && (
              <div style={{ marginTop: '1.5rem', padding: '1rem 1.2rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ color: 'var(--color-teacher)', fontSize: '0.95rem' }}>All {classStudents.length} students in {gradeClass} have scores for {gradeSubject}</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                    Report cards are ready. Click any eye icon to preview, or submit to Headteacher for approval.
                  </p>
                </div>
                <span style={{ fontSize: '1.5rem' }}>📋</span>
              </div>
            )}
          </div>
        )}

        {/* ── MY STUDENTS (Register Students) ── */}
        {currentTab === 'mystudents' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>My Class Students</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {students.filter(s => teacherClasses.includes(s.class_name)).length} students in my classes
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="timetable-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Student Name</th>
                      <th>Roll Number</th>
                      <th>Class</th>
                      <th>Parent Name</th>
                      <th>Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.filter(s => teacherClasses.includes(s.class_name)).length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students in your assigned classes.</td></tr>
                    ) : students.filter(s => teacherClasses.includes(s.class_name)).map(s => (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'left', fontWeight: '600' }}>{s.full_name}</td>
                        <td><code>{s.roll_number}</code></td>
                        <td>{s.class_name}</td>
                        <td>{s.parent_name || '—'}</td>
                        <td>{s.parent_phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel teacher">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: 'var(--color-teacher)' }}>Add Student to My Class</h3>
              <form onSubmit={handleRegisterMyStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full Name</label>
                  <input type="text" value={myStudentName} onChange={(e) => setMyStudentName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Roll Number</label>
                  <input type="text" placeholder="e.g. MHA-2026-042" value={myStudentRoll} onChange={(e) => setMyStudentRoll(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assigned Class</label>
                  <select value={myStudentClass} onChange={(e) => setMyStudentClass(e.target.value)}>
                    {teacherClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Parent / Guardian Name</label>
                  <input type="text" value={myParentName} onChange={(e) => setMyParentName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Parent Mobile Number</label>
                  <input type="text" placeholder="+265999XXXXXX" value={myParentPhone} onChange={(e) => setMyParentPhone(e.target.value)} />
                </div>
                <div style={{ padding: '0.6rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--color-teacher)' }}>Teaching:</strong> {teacherSubjects.join(', ') || 'No subjects assigned'}
                </div>
                <button type="submit" className="btn btn-primary teacher" style={{ width: '100%', marginTop: '0.5rem' }}>
                  <Plus size={16} /> Register Student
                </button>
              </form>
            </div>
          </div>
        )}

        {currentTab === 'timetable' && (
          <TimetableChatBot token={token} apiHost={apiHost} roleTheme="teacher" triggerAlert={triggerAlert} />
        )}
      </main>

      {viewingReport && (
        <ReportCard
          student={viewingReport}
          scores={viewingReport.scores}
          branding={branding}
          isApproved={viewingReport.scores?.every(s => s.headteacher_approved) || false}
          onClose={() => setViewingReport(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE CHATBOT
// ─────────────────────────────────────────────────────────────────────────────
function TimetableChatBot({ token, apiHost, roleTheme, triggerAlert }) {
  const [messages, setMessages] = useState([{
    sender: 'bot',
    text: 'Hello! I am your Malawi SMS Timetable Assistant. Click a quick template or configure your class requirements below!'
  }]);
  const [loading, setLoading] = useState(false);
  const [timetableResult, setTimetableResult] = useState(null);
  const [selectedClasses, setSelectedClasses] = useState(['Form 1', 'Form 2']);
  const [slotsPerDay, setSlotsPerDay] = useState(5);
  const [subjectsConfig, setSubjectsConfig] = useState([
    { class: 'Form 1', name: 'Mathematics', periods: 4, teacher: 'Mr. Phiri' },
    { class: 'Form 1', name: 'English', periods: 4, teacher: 'Mrs. Banda' },
    { class: 'Form 1', name: 'Chichewa', periods: 3, teacher: 'Mrs. Banda' },
    { class: 'Form 1', name: 'Biology', periods: 3, teacher: 'Mr. Mwale' },
    { class: 'Form 2', name: 'Mathematics', periods: 4, teacher: 'Mr. Phiri' },
    { class: 'Form 2', name: 'English', periods: 4, teacher: 'Mrs. Banda' },
    { class: 'Form 2', name: 'Physical Science', periods: 4, teacher: 'Mr. Mwale' }
  ]);
  const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const handleGenerate = async () => {
    setLoading(true);
    setMessages(prev => [...prev, { sender: 'user', text: 'Generate clash-free timetable matrix.' }]);
    try {
      const response = await fetch(`${apiHost}/api/timetable/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ classes: selectedClasses, subjects: subjectsConfig, days: daysList, slotsPerDay })
      });
      const data = await response.json();
      setLoading(false);
      if (response.ok && data.success) {
        setTimetableResult(data.timetable);
        setMessages(prev => [...prev, { sender: 'bot', text: 'SUCCESS: Clash-free timetable generated! Zero teacher overlaps confirmed.' }]);
      } else {
        setTimetableResult(null);
        setMessages(prev => [...prev, { sender: 'bot', text: `CLASH DETECTED: ${data.message || 'Check teacher slot conflicts.'}` }]);
      }
    } catch (err) {
      setLoading(false);
      triggerAlert('Failed to query timetable engine');
    }
  };

  const loadPreset = (presetType) => {
    if (presetType === 'junior') {
      setSelectedClasses(['Form 1', 'Form 2']);
      setSubjectsConfig([
        { class: 'Form 1', name: 'Mathematics', periods: 4, teacher: 'Mr. Phiri' },
        { class: 'Form 1', name: 'English', periods: 4, teacher: 'Mrs. Banda' },
        { class: 'Form 1', name: 'Chichewa', periods: 3, teacher: 'Mrs. Banda' },
        { class: 'Form 1', name: 'Biology', periods: 3, teacher: 'Mr. Mwale' },
        { class: 'Form 2', name: 'Mathematics', periods: 4, teacher: 'Mr. Phiri' },
        { class: 'Form 2', name: 'English', periods: 4, teacher: 'Mrs. Banda' },
        { class: 'Form 2', name: 'Physical Science', periods: 4, teacher: 'Mr. Mwale' }
      ]);
      setMessages(prev => [...prev, { sender: 'bot', text: 'Loaded Junior Secondary Preset (Form 1 & 2).' }]);
    } else {
      setSelectedClasses(['Form 3', 'Form 4']);
      setSubjectsConfig([
        { class: 'Form 3', name: 'Mathematics', periods: 5, teacher: 'Mr. Phiri' },
        { class: 'Form 3', name: 'English', periods: 5, teacher: 'Mrs. Banda' },
        { class: 'Form 3', name: 'Biology', periods: 4, teacher: 'Mr. Mwale' },
        { class: 'Form 3', name: 'Chichewa', periods: 3, teacher: 'Mrs. Banda' },
        { class: 'Form 4', name: 'Mathematics', periods: 5, teacher: 'Mr. Phiri' },
        { class: 'Form 4', name: 'English', periods: 5, teacher: 'Mrs. Banda' },
        { class: 'Form 4', name: 'Physical Science', periods: 5, teacher: 'Mr. Mwale' }
      ]);
      setMessages(prev => [...prev, { sender: 'bot', text: 'Loaded Senior Secondary Preset (Form 3 & 4).' }]);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div className={`glass-panel ${roleTheme}`} style={{ display: 'flex', flexDirection: 'column', height: '600px', padding: 0 }}>
        <div className="chatbot-header">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <MessageSquare size={20} style={{ color: roleTheme === 'head' ? 'var(--color-head)' : 'var(--color-teacher)' }} />
            <strong>Timetabling AI Chat Board</strong>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Backtracking Solver V1.0</span>
        </div>
        <div className="chat-messages" style={{ flex: 1 }}>
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-bubble ${m.sender}`}>{m.text}</div>
          ))}
          {loading && <div className="chat-bubble bot pulse">Calculating constraints... Solving CSP Matrix...</div>}
        </div>
        <div className="chat-input-area" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => loadPreset('junior')}>Junior Template</button>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => loadPreset('senior')}>Senior Template</button>
          </div>
          <button className={`btn btn-primary ${roleTheme === 'head' ? 'head' : 'teacher'}`} style={{ width: '100%' }} onClick={handleGenerate} disabled={loading}>
            <Play size={14} /> Solve & Generate Calendar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '600px', overflowY: 'auto' }}>
        {!timetableResult && (
          <div className="glass-panel">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#fff' }}>Subject Periods & Teacher Assignments</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Slots Per Day</label>
                <input type="number" value={slotsPerDay} onChange={(e) => setSlotsPerDay(parseInt(e.target.value) || 5)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Classes</label>
                <input type="text" value={selectedClasses.join(', ')} onChange={(e) => setSelectedClasses(e.target.value.split(',').map(s => s.trim()))} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1fr 40px', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                <span>Class</span><span>Subject</span><span>Periods/Wk</span><span>Teacher</span><span></span>
              </div>
              {subjectsConfig.map((sub, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1fr 40px', gap: '0.5rem' }}>
                  <select value={sub.class} onChange={(e) => { const u = [...subjectsConfig]; u[idx].class = e.target.value; setSubjectsConfig(u); }}>
                    {selectedClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" placeholder="Subject" value={sub.name} onChange={(e) => { const u = [...subjectsConfig]; u[idx].name = e.target.value; setSubjectsConfig(u); }} />
                  <input type="number" value={sub.periods} onChange={(e) => { const u = [...subjectsConfig]; u[idx].periods = parseInt(e.target.value) || 1; setSubjectsConfig(u); }} />
                  <input type="text" placeholder="Teacher" value={sub.teacher} onChange={(e) => { const u = [...subjectsConfig]; u[idx].teacher = e.target.value; setSubjectsConfig(u); }} />
                  <button className="btn btn-secondary" style={{ padding: 0, color: 'var(--color-danger)' }} onClick={() => setSubjectsConfig(subjectsConfig.filter((_, i) => i !== idx))}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }} onClick={() => setSubjectsConfig([...subjectsConfig, { class: selectedClasses[0] || 'Form 1', name: '', periods: 2, teacher: '' }])}>
              + Add Subject Block
            </button>
          </div>
        )}

        {timetableResult && (
          <div className="glass-panel" id="printable-timetable-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>Clash-Free Timetable Output</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => window.print()}>
                  <Printer size={12} /> Print
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => setTimetableResult(null)}>
                  Modify
                </button>
              </div>
            </div>
            {selectedClasses.map(c => (
              <div key={c} style={{ marginBottom: '2rem' }}>
                <h4 style={{ color: 'var(--color-admin)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.3rem' }}>{c} Schedule</h4>
                <div className="timetable-grid-container">
                  <table className="timetable-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        {Array.from({ length: slotsPerDay }).map((_, i) => <th key={i}>Period {i + 1}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {daysList.map(day => (
                        <tr key={day}>
                          <td className="timetable-slot" style={{ fontWeight: '700' }}>{day}</td>
                          {Array.from({ length: slotsPerDay }).map((_, slotIdx) => {
                            const lesson = timetableResult[c]?.[day]?.[slotIdx];
                            return (
                              <td key={slotIdx}>
                                {lesson ? (
                                  <div className={`timetable-lesson-box ${roleTheme === 'head' ? 'headteacher' : ''}`}>
                                    <div className="timetable-lesson-subject">{lesson.subject}</div>
                                    <div className="timetable-lesson-teacher">{lesson.teacher}</div>
                                  </div>
                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PARENT PAYMENT PORTAL
// ─────────────────────────────────────────────────────────────────────────────
function ParentPaymentPortal({ studentId, apiHost, onClose }) {
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [phone, setPhone] = useState('');
  const [gateway, setGateway] = useState('airtel_money');
  const [pin, setPin] = useState('');
  const [payStep, setPayStep] = useState(1);

  useEffect(() => {
    const fetchStudentPayDetails = async () => {
      try {
        const response = await fetch(`${apiHost}/api/parent/student/${studentId}`);
        if (response.ok) setStudentInfo(await response.json());
        else alert('Failed to resolve payment details. Invalid link.');
        setLoading(false);
      } catch (err) { setLoading(false); }
    };
    fetchStudentPayDetails();
  }, [studentId]);

  const handleConfirmPin = async () => {
    if (!pin || pin.length < 4) return alert('Enter 4-Digit PIN');
    try {
      const response = await fetch(`${apiHost}/api/parent/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, phone_number: phone, amount: studentInfo.term_fee, gateway })
      });
      const data = await response.json();
      if (response.ok && data.success) setPayStep(3);
      else { alert(data.message || 'Payment failed'); setPayStep(1); }
    } catch (err) { alert('Network error'); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#090d16' }}>
      <p className="pulse" style={{ color: 'var(--color-admin)' }}>Resolving Payment Invoice...</p>
    </div>
  );

  if (!studentInfo) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#090d16', padding: '1rem' }}>
      <div className="glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ color: 'var(--color-danger)', marginBottom: '1rem' }} />
        <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Invoice Link Expired</h3>
        <button className="btn btn-secondary" onClick={onClose}>Return Home</button>
      </div>
    </div>
  );

  const { student, term_fee } = studentInfo;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#090d16', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2rem 1.5rem' }}>
        <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-admin)' }}>{student.school_name}</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>{student.letterhead}</span>
        </div>

        {payStep === 1 && (
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.2rem', color: '#fff', textAlign: 'center' }}>School Fees Payment Portal</h3>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {[['Student Name', student.full_name], ['Roll / ID', student.roll_number], ['Class', student.class_name]].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{lbl}:</span><strong>{val}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', marginTop: '0.5rem', color: 'var(--color-admin)', fontWeight: '700' }}>
                <span>Term Fee:</span><span>K{term_fee}.00</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
              {['airtel_money', 'tnm_mpamba'].map(gw => (
                <button key={gw} className={`btn ${gateway === gw ? 'btn-primary admin' : 'btn-secondary'}`} style={{ flex: 1, fontSize: '0.85rem' }} onClick={() => setGateway(gw)}>
                  {gw === 'airtel_money' ? 'Airtel Money' : 'TNM Mpamba'}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Phone Number</label>
              <input type="text" placeholder="0999123456" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button className="btn btn-primary admin" style={{ width: '100%' }} onClick={() => { if (!phone) return alert('Phone required'); setPayStep(2); }}>
              Initiate Payment
            </button>
          </div>
        )}

        {payStep === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div className="pulse" style={{ fontSize: '3rem', color: 'var(--color-admin)', marginBottom: '1rem' }}>📲</div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-admin)', marginBottom: '1rem' }}>Enter Wallet PIN</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Authorize <strong>K{term_fee}</strong> from <strong>{phone}</strong>
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <input type="password" placeholder="PIN" maxLength={4} style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', width: '150px' }} value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPayStep(1)}>Back</button>
              <button className="btn btn-primary admin" style={{ flex: 1 }} onClick={handleConfirmPin}>Approve</button>
            </div>
          </div>
        )}

        {payStep === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', color: 'var(--color-teacher)', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-teacher)', marginBottom: '1rem' }}>Fees Settled</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Payment for <strong>{student.full_name}</strong> processed. The school has been notified.
            </p>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;