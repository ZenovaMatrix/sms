import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  GraduationCap,
  Layers,
  CheckSquare,
  CreditCard,
  AlertCircle,
  FileSpreadsheet,
  UserPlus,
  ArrowRight,
  Sparkles,
  Clock,
  Award,
  BookOpen,
  Calendar,
  Bell,
  CheckCircle2,
  DollarSign,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { CardSkeleton } from '../components/LoadingSkeleton';

export default function DashboardPage() {
  const { user } = useAuth();
  const role = (user?.role || 'admin').toLowerCase();

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (role === 'teacher') {
    return <TeacherDashboard user={user} todayStr={todayStr} />;
  }
  if (role === 'student') {
    return <StudentDashboard user={user} todayStr={todayStr} />;
  }
  if (role === 'parent') {
    return <ParentDashboard user={user} todayStr={todayStr} />;
  }

  // Default to Admin Dashboard
  return <AdminDashboard user={user} todayStr={todayStr} />;
}

/* ==========================================================================
   1. ADMIN DASHBOARD
   ========================================================================== */
function AdminDashboard({ user, todayStr }) {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    attendanceRate: '100%',
    exams: 0,
    feeCollected: 0,
    feePending: 0,
  });
  const [attendanceBreakdown, setAttendanceBreakdown] = useState([
    { name: 'Present', value: 0, color: '#16a34a' },
    { name: 'Absent', value: 0, color: '#dc2626' },
    { name: 'Late', value: 0, color: '#f59e0b' },
  ]);
  const [classEnrollmentData, setClassEnrollmentData] = useState([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const results = await Promise.allSettled([
          api.get('/students?limit=1'),
          api.get('/teachers?limit=1'),
          api.get('/classes?limit=20'),
          api.get('/attendance?limit=100'),
          api.get('/examinations?limit=1'),
          api.get('/fees/student-fees?limit=100'),
          api.get('/announcements?limit=3'),
        ]);

        const [studentsRes, teachersRes, classesRes, attendanceRes, examsRes, feesRes, annRes] = results;

        const totalStudents = studentsRes.status === 'fulfilled' ? (studentsRes.value.data?.data?.pagination?.total ?? 0) : 0;
        const totalTeachers = teachersRes.status === 'fulfilled' ? (teachersRes.value.data?.data?.pagination?.total ?? 0) : 0;
        const classesList = classesRes.status === 'fulfilled' ? (classesRes.value.data?.data?.classes || classesRes.value.data?.data?.items || classesRes.value.data?.data || []) : [];
        const totalClasses = classesRes.status === 'fulfilled' ? (classesRes.value.data?.data?.pagination?.total ?? classesList.length) : classesList.length;
        const totalExams = examsRes.status === 'fulfilled' ? (examsRes.value.data?.data?.pagination?.total ?? 0) : 0;

        // Process Attendance
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let rate = '100%';
        if (attendanceRes.status === 'fulfilled' && attendanceRes.value.data?.success) {
          const records = attendanceRes.value.data.data?.attendance || attendanceRes.value.data.data?.records || attendanceRes.value.data.data || [];
          if (Array.isArray(records) && records.length > 0) {
            records.forEach(r => {
              const st = (r.status || '').toLowerCase();
              if (st === 'present') presentCount++;
              else if (st === 'absent') absentCount++;
              else if (st === 'late' || st === 'excused') lateCount++;
            });
            const totalRec = records.length;
            rate = `${Math.round((presentCount / (totalRec || 1)) * 100)}%`;
            setAttendanceBreakdown([
              { name: 'Present', value: presentCount, color: '#16a34a' },
              { name: 'Absent', value: absentCount, color: '#dc2626' },
              { name: 'Late / Excused', value: lateCount, color: '#f59e0b' },
            ]);
          }
        }

        // Process Class Enrollment Bar Data
        if (classesList.length > 0) {
          const chartData = classesList.slice(0, 7).map(c => ({
            name: c.class_name,
            enrolled: Number(c.total_enrolled || c.enrolled_count || c.section_count * 20 || 0),
            capacity: Number(c.total_capacity || c.capacity || (c.section_count || 1) * 35),
          }));
          setClassEnrollmentData(chartData);
        }

        // Process Fees
        let collected = 0;
        let pending = 0;
        if (feesRes.status === 'fulfilled' && feesRes.value.data?.success) {
          const feesList = feesRes.value.data.data?.student_fees || feesRes.value.data.data?.items || feesRes.value.data.data || [];
          if (Array.isArray(feesList)) {
            feesList.forEach(f => {
              collected += Number(f.paid_amount || 0);
              pending += Number(f.pending_amount || (Number(f.final_amount || f.amount || 0) - Number(f.paid_amount || 0)));
            });
          }
        }

        // Announcements
        if (annRes.status === 'fulfilled' && annRes.value.data?.success) {
          setRecentAnnouncements(annRes.value.data.data?.announcements || []);
        }

        setStats({
          students: totalStudents,
          teachers: totalTeachers,
          classes: totalClasses,
          attendanceRate: rate,
          exams: totalExams,
          feeCollected: collected,
          feePending: pending,
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header Banner */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)',
          borderColor: 'rgba(22, 101, 52, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '24px 30px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
              Administrator Overview
            </span>
            <span>•</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{todayStr}</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Welcome back, {user?.name || user?.email?.split('@')[0] || 'Administrator'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            Here is your school's live attendance, academic distribution, fee collection, and broadcasts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/students" className="btn btn-primary btn-sm">
            <UserPlus size={15} /> Add Admission
          </a>
          <a href="/attendance" className="btn btn-secondary btn-sm">
            <CheckSquare size={15} /> Take Attendance
          </a>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          <StatCard
            title="Total Students"
            value={stats.students?.toLocaleString?.() || '0'}
            icon={GraduationCap}
            trend="Live"
            trendLabel="active admissions"
            color="emerald"
            delay={0.05}
          />
          <StatCard
            title="Faculty & Teachers"
            value={stats.teachers || '0'}
            icon={Users}
            trend="Active"
            trendLabel="teaching faculty"
            color="sky"
            delay={0.1}
          />
          <StatCard
            title="Overall Attendance"
            value={stats.attendanceRate}
            icon={CheckSquare}
            trend="Live Roll Call"
            trendLabel="calculated rate"
            color="emerald"
            delay={0.15}
          />
          <StatCard
            title="Active Classes"
            value={stats.classes || '0'}
            icon={Layers}
            trend="Configured"
            trendLabel="academic classes"
            color="amber"
            delay={0.2}
          />
          <StatCard
            title="Tuition Fees Collected"
            value={`$${stats.feeCollected?.toLocaleString?.() || '0'}`}
            icon={CreditCard}
            trend="Paid"
            trendLabel="student fee ledger"
            color="emerald"
            delay={0.25}
          />
          <StatCard
            title="Tuition Fees Pending"
            value={`$${stats.feePending?.toLocaleString?.() || '0'}`}
            icon={AlertCircle}
            trend="Receivable"
            trendLabel="outstanding balances"
            color="terracotta"
            delay={0.3}
          />
        </div>
      )}

      {/* Primary Analytics Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: classEnrollmentData.length > 0 ? '2fr 1fr' : '1fr', gap: 20 }}>
        {/* Class Enrollment Breakdown Chart */}
        {classEnrollmentData.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Class Enrollment Distribution</h3>
                <p className="card-subtitle">Enrolled students vs class capacity from database</p>
              </div>
              <span className="badge badge-emerald">Live DB</span>
            </div>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classEnrollmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }} />
                  <Bar dataKey="enrolled" name="Enrolled" fill="#166534" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="capacity" name="Capacity" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Attendance Breakdown Donut Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Attendance Ratio</h3>
              <p className="card-subtitle">Live status breakdown</p>
            </div>
          </div>

          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceBreakdown.some(d => d.value > 0) ? attendanceBreakdown : [{ name: 'No Records', value: 1, color: '#94a3b8' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(attendanceBreakdown.some(d => d.value > 0) ? attendanceBreakdown : [{ name: 'No Records', value: 1, color: '#94a3b8' }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10, fontSize: '0.8rem', flexWrap: 'wrap', gap: 6 }}>
            {attendanceBreakdown.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color }} />
                <span>{item.name}: <strong>{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bulletins & Announcements Row */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recent Broadcast Announcements</h3>
            <p className="card-subtitle">Published alerts visible across portals</p>
          </div>
          <a href="/announcements" className="btn btn-secondary btn-sm">
            View All <ArrowRight size={13} />
          </a>
        </div>

        {recentAnnouncements.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '12px 0' }}>
            No recent announcements published yet. Click "View All" to create one.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {recentAnnouncements.map((ann, idx) => (
              <div
                key={ann.id || idx}
                style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '3px solid var(--primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{ann.title}</h4>
                  <span className="badge badge-emerald">{ann.target_type || 'all'}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {(ann.message || '').length > 110 ? `${ann.message.slice(0, 110)}…` : ann.message}
                </p>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {ann.publish_date ? new Date(ann.publish_date).toLocaleDateString() : 'Today'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   2. TEACHER DASHBOARD
   ========================================================================== */
function TeacherDashboard({ user, todayStr }) {
  const [assignments, setAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [attendanceWindow, setAttendanceWindow] = useState(null);
  const [gradingWindow, setGradingWindow] = useState(null);
  const [loading, setLoading] = useState(true);

  const todayIso = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function loadTeacherData() {
      try {
        const [assignRes, annRes, examsRes, sessRes, crRes, attWinRes, gradWinRes] = await Promise.allSettled([
          api.get('/teacher-assignments?limit=50'),
          api.get('/announcements?limit=3'),
          api.get('/examinations?limit=10'),
          api.get(`/attendance/sessions?session_date=${todayIso}&limit=50`),
          api.get('/correction-requests?limit=10'),
          api.get(`/deadlines/attendance-window?date=${todayIso}`),
          api.get('/deadlines/grading-window'),
        ]);

        if (assignRes.status === 'fulfilled' && assignRes.value.data?.success) {
          setAssignments(assignRes.value.data.data?.assignments || assignRes.value.data.data?.items || assignRes.value.data.data || []);
        }
        if (annRes.status === 'fulfilled' && annRes.value.data?.success) {
          setAnnouncements(annRes.value.data.data?.announcements || []);
        }
        if (examsRes.status === 'fulfilled' && examsRes.value.data?.success) {
          setUpcomingExams(examsRes.value.data.data?.examinations || []);
        }
        if (sessRes.status === 'fulfilled' && sessRes.value.data?.success) {
          setTodaySessions(sessRes.value.data.data?.sessions || []);
        }
        if (crRes.status === 'fulfilled' && crRes.value.data?.success) {
          setCorrectionRequests(crRes.value.data.data?.requests || []);
        }
        if (attWinRes.status === 'fulfilled' && attWinRes.value.data?.success) {
          setAttendanceWindow(attWinRes.value.data.data);
        }
        if (gradWinRes.status === 'fulfilled' && gradWinRes.value.data?.success) {
          setGradingWindow(gradWinRes.value.data.data);
        }
      } catch (err) {
        console.error('Failed to load teacher portal data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTeacherData();
  }, [user, todayIso]);

  const totalStudents = assignments.reduce((acc, a) => acc + Number(a.student_count || a.enrolled_students_count || 0), 0);
  const pendingRequestsCount = correctionRequests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.1) 0%, rgba(2, 132, 199, 0.06) 100%)',
          borderColor: 'rgba(22, 101, 52, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '24px 30px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
              Faculty Portal
            </span>
            <span>•</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{todayStr}</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Welcome back, {user?.name || user?.email?.split('@')[0] || 'Teacher'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            Manage attendance roll calls, grading records, and class announcements for your assigned classes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/attendance" className="btn btn-primary btn-sm">
            <CheckSquare size={15} /> Take Attendance
          </a>
          <a href="/results" className="btn btn-secondary btn-sm">
            <Award size={15} /> Enter Grades
          </a>
        </div>
      </motion.div>

      {/* Deadline Policy Status Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
      }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: attendanceWindow?.isOpen ? 'rgba(22, 101, 52, 0.08)' : 'rgba(220, 38, 38, 0.08)',
          border: `1px solid ${attendanceWindow?.isOpen ? 'rgba(22, 101, 52, 0.25)' : 'rgba(220, 38, 38, 0.25)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {attendanceWindow?.isOpen ? <CheckCircle2 size={20} color="var(--primary)" /> : <Clock size={20} color="var(--danger)" />}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Daily Attendance Window: {attendanceWindow?.isOpen ? '🟢 Open for Submission' : '🔒 Closed (Locked)'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {attendanceWindow?.isOpen
                ? `Daily deadline at ${attendanceWindow?.deadlineTime || '14:00'} (${attendanceWindow?.timezone || 'Asia/Kolkata'})`
                : `${attendanceWindow?.reason || 'Deadline passed.'} Submit correction request to edit.`}
            </div>
          </div>
        </div>

        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <Award size={20} color="var(--sky-600, #0284c7)" />
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Examination Grading Window Policy
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              14-day post-exam window configured. Closed marks require admin correction approval.
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
      }}>
        <StatCard
          title="Assigned Classes"
          value={`${assignments.length} Classes`}
          icon={Layers}
          trend={`${assignments.length} sections`}
          trendLabel="curriculum load"
          color="emerald"
        />
        <StatCard
          title="Enrolled Students"
          value={`${totalStudents} Students`}
          icon={Users}
          trend="Total"
          trendLabel="in your classes"
          color="sky"
        />
        <StatCard
          title="Today's Attendance"
          value={todaySessions.length > 0 ? `${todaySessions.length} Marked` : 'Pending'}
          icon={CheckSquare}
          trend={todaySessions.length > 0 ? 'Recorded' : 'Action Needed'}
          trendLabel="daily roll call"
          color={todaySessions.length > 0 ? 'emerald' : 'amber'}
        />
        <StatCard
          title="Correction Requests"
          value={`${pendingRequestsCount} Pending`}
          icon={AlertCircle}
          trend={`${correctionRequests.length} Total`}
          trendLabel="audit submissions"
          color={pendingRequestsCount > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Main Grid: Allocated Classes with Attendance Status & Upcoming Exams */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: 20 }}>
        {/* Allocated Classes Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Your Allocated Classes & Attendance Status</h3>
              <p className="card-subtitle">Real-time roll call status for {todayIso}</p>
            </div>
            <a href="/attendance" className="btn btn-secondary btn-sm">
              View All <ArrowRight size={13} />
            </a>
          </div>

          {assignments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No class allocations found for your account.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {assignments.map((item, idx) => {
                const sessionForClass = todaySessions.find(s => s.teacher_assignment_id === item.id || (s.class_id === item.class_id && s.section_id === item.section_id));
                const isMarked = !!sessionForClass;

                return (
                  <div key={item.id || idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-muted)',
                    borderLeft: `4px solid ${isMarked ? 'var(--primary)' : 'var(--amber-500, #f59e0b)'}`,
                  }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.subject_name || 'General Subject'} — {item.class_name} • Sec {item.section_name}
                      </h4>
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        <span>Students: <strong>{item.student_count || item.enrolled_students_count || 0}</strong></span>
                        <span>•</span>
                        <span>Code: <strong>{item.subject_code || 'GEN'}</strong></span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${isMarked ? 'badge-emerald' : 'badge-amber'}`}>
                        {isMarked ? 'Marked Today' : 'Pending Roll Call'}
                      </span>
                      <a href="/attendance" className="btn btn-secondary btn-sm" style={{ padding: '5px 10px' }}>
                        {isMarked ? 'View Call' : 'Mark Now'}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Exams & Correction Requests Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Upcoming Examinations Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Examinations & Grading</h3>
                <p className="card-subtitle">Active and scheduled assessments</p>
              </div>
              <a href="/results" className="btn btn-secondary btn-sm">
                Gradebook <ArrowRight size={13} />
              </a>
            </div>

            {upcomingExams.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No examinations scheduled currently.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcomingExams.slice(0, 3).map((exam) => (
                  <div key={exam.id} style={{
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-muted)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {exam.exam_name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Class: {exam.class_name} • {exam.start_date} to {exam.end_date}
                      </div>
                    </div>
                    <a href="/results" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                      Marks Entry
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Correction Requests Status Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Correction Requests Trail</h3>
                <p className="card-subtitle">Admin review & audit status</p>
              </div>
              <span className={`badge ${pendingRequestsCount > 0 ? 'badge-amber' : 'badge-slate'}`}>
                {pendingRequestsCount} Pending
              </span>
            </div>

            {correctionRequests.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No correction requests submitted yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {correctionRequests.slice(0, 3).map((cr) => (
                  <div key={cr.id} style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-muted)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {cr.request_type?.toUpperCase()} CORRECTION: {cr.class_name ? `${cr.class_name}` : ''}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Reason: {cr.reason?.length > 40 ? `${cr.reason.slice(0, 40)}…` : cr.reason}
                      </div>
                    </div>
                    <span className={`badge ${cr.status === 'approved' ? 'badge-emerald' : cr.status === 'rejected' ? 'badge-red' : 'badge-amber'}`}>
                      {cr.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulletins Row */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">School Announcements</h3>
            <p className="card-subtitle">Latest updates from administration</p>
          </div>
          <a href="/announcements" className="btn btn-secondary btn-sm">
            View Announcements <ArrowRight size={13} />
          </a>
        </div>
        {announcements.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No announcements published.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {announcements.map((a, i) => (
              <div key={a.id || i} style={{ padding: '12px 14px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {a.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   3. STUDENT DASHBOARD
   ========================================================================== */
function StudentDashboard({ user, todayStr }) {
  const [results, setResults] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentData() {
      try {
        const [resultsRes, annRes] = await Promise.allSettled([
          api.get('/results?limit=10'),
          api.get('/announcements?limit=3'),
        ]);

        if (resultsRes.status === 'fulfilled' && resultsRes.value.data?.success) {
          setResults(resultsRes.value.data.data?.results || resultsRes.value.data.data?.items || resultsRes.value.data.data || []);
        }
        if (annRes.status === 'fulfilled' && annRes.value.data?.success) {
          setAnnouncements(annRes.value.data.data?.announcements || []);
        }
      } catch (err) {
        console.error('Failed to load student data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentData();
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header Banner */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.1) 0%, rgba(217, 119, 6, 0.08) 100%)',
          borderColor: 'rgba(22, 101, 52, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '24px 30px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
              Student Portal
            </span>
            <span>•</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{todayStr}</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Welcome back, {user?.name || user?.email?.split('@')[0] || 'Student'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            Track your report cards, examination schedules, attendance logs, and school notices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/results" className="btn btn-primary btn-sm">
            <Award size={15} /> My Report Card
          </a>
          <a href="/announcements" className="btn btn-secondary btn-sm">
            <Bell size={15} /> Announcements
          </a>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        <StatCard title="Academic Status" value="Active" icon={Award} trend="Enrolled" trendLabel="current session" color="emerald" />
        <StatCard title="Recorded Results" value={`${results.length} Subjects`} icon={BookOpen} trend="Grades" trendLabel="published marks" color="sky" />
        <StatCard title="School Bulletins" value={`${announcements.length} Notices`} icon={Bell} trend="Live" trendLabel="targeted updates" color="amber" />
      </div>

      {/* Enrolled Subjects & Marks */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Published Examination Results</h3>
              <p className="card-subtitle">Your score breakdown and awarded grades</p>
            </div>
            <Award size={18} color="var(--primary)" />
          </div>

          {results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No examination results published yet.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Exam</th>
                    <th>Marks</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id || i}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.subject_name || 'Subject'}</td>
                      <td>{r.exam_name || 'Term Exam'}</td>
                      <td style={{ fontWeight: 700 }}>{r.marks_obtained ?? r.score ?? '—'} / {r.max_marks || 100}</td>
                      <td>
                        <span className="badge badge-emerald">{r.grade || 'Pass'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notices for Student */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Class Bulletins & Notices</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {announcements.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No active bulletins.</p>
            ) : (
              announcements.map((ann, i) => (
                <div key={ann.id || i} style={{ padding: '12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {ann.title}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {(ann.message || '').slice(0, 100)}…
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. PARENT DASHBOARD
   ========================================================================== */
function ParentDashboard({ user, todayStr }) {
  const [announcements, setAnnouncements] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadParentData() {
      try {
        const [enrollRes, annRes] = await Promise.allSettled([
          api.get('/enrollments?limit=10'),
          api.get('/announcements?limit=4'),
        ]);

        if (enrollRes.status === 'fulfilled' && enrollRes.value.data?.success) {
          setEnrollments(enrollRes.value.data.data?.enrollments || enrollRes.value.data.data?.items || enrollRes.value.data.data || []);
        }
        if (annRes.status === 'fulfilled' && annRes.value.data?.success) {
          setAnnouncements(annRes.value.data.data?.announcements || []);
        }
      } catch (err) {
        console.error('Failed to load parent portal data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadParentData();
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header Banner */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.1) 0%, rgba(231, 111, 81, 0.08) 100%)',
          borderColor: 'rgba(22, 101, 52, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '24px 30px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
              Parent & Guardian Portal
            </span>
            <span>•</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{todayStr}</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Welcome back, {user?.name || user?.email?.split('@')[0] || 'Parent'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 4 }}>
            Monitor your enrolled wards, review attendance logs, grades, and school notifications.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/announcements" className="btn btn-primary btn-sm">
            <Bell size={15} /> School Notices
          </a>
          <a href="/results" className="btn btn-secondary btn-sm">
            <Award size={15} /> Report Cards
          </a>
        </div>
      </motion.div>

      {/* Linked Children Profiles */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>
          Enrolled Student Wards
        </h3>
        {enrollments.length === 0 ? (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No student enrollments linked to your parent profile yet. Contact school administration to link your student.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {enrollments.map((en, idx) => (
              <div key={en.id || idx} className="card" style={{ borderColor: 'rgba(22, 101, 52, 0.3)' }}>
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(22, 101, 52, 0.15)',
                      color: 'var(--primary)',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                    }}>
                      {(en.student_name || 'ST').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="card-title">{en.student_name || 'Enrolled Ward'}</h3>
                      <p className="card-subtitle">{en.class_name || 'Class'} • Sec {en.section_name || 'A'}</p>
                    </div>
                  </div>
                  <span className="badge badge-emerald">{en.status || 'Active'}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, margin: '12px 0' }}>
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Academic Session</span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{en.academic_year_name || '2026–2027'}</h4>
                  </div>
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Enrolled Date</span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {en.enrollment_date ? new Date(en.enrollment_date).toLocaleDateString() : 'Active'}
                    </h4>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <a href="/attendance" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                    View Attendance →
                  </a>
                  <a href="/results" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                    View Grades →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* School Notices for Parents */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">School Notices & Bulletins</h3>
            <p className="card-subtitle">Official announcements from school administration</p>
          </div>
          <span className="badge badge-emerald">Live</span>
        </div>

        {announcements.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No school notices published at this time.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {announcements.map((a, i) => (
              <div key={a.id || i} style={{ padding: '12px 14px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {a.publish_date ? new Date(a.publish_date).toLocaleDateString() : 'Today'}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {a.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
