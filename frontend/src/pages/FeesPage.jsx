import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  PlusCircle,
  Download,
  Search,
  Filter,
  Eye,
  Trash2,
  Edit2,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  UserCheck,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  Check,
  AlertTriangle,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatINR } from '../utils/currency';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';

function FeeStatusBadge({ status, dueDate }) {
  const s = String(status || 'unpaid').toLowerCase();
  const isOverdue = s !== 'paid' && dueDate && new Date(dueDate) < new Date();

  if (s === 'paid') {
    return (
      <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <CheckCircle size={12} /> Paid
      </span>
    );
  }
  if (isOverdue || s === 'overdue') {
    return (
      <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <AlertCircle size={12} /> Overdue
      </span>
    );
  }
  if (s === 'partial') {
    return (
      <span className="badge badge-sky" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Clock size={12} /> Partial
      </span>
    );
  }
  return (
    <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Clock size={12} /> Unpaid
    </span>
  );
}

export default function FeesPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin = user?.role === 'admin';

  // Active tab: 'ledger' | 'structures' | 'payments'
  const [activeTab, setActiveTab] = useState('ledger');

  // Master dropdown data
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);

  // Filter states
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Pagination & Loading
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Financial KPIs
  const [summary, setSummary] = useState({
    totalBilled: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    paidCount: 0,
    partialCount: 0,
    unpaidCount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    totalRecords: 0,
  });

  // Table Data
  const [ledgerItems, setLedgerItems] = useState([]);
  const [structureItems, setStructureItems] = useState([]);
  const [paymentItems, setPaymentItems] = useState([]);

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Selected item contexts for modals
  const [selectedFeeRecord, setSelectedFeeRecord] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editingStructure, setEditingStructure] = useState(null);

  // ─── 1. Load Academic Years & Classes on Mount ─────────────────────────────
  useEffect(() => {
    async function loadInitialOptions() {
      try {
        const [ayRes, clsRes] = await Promise.all([
          api.get('/academic-years?limit=20'),
          api.get('/classes?limit=50'),
        ]);

        if (ayRes.data?.success) {
          const yrs = ayRes.data.data?.academicYears || ayRes.data.data || [];
          setAcademicYears(Array.isArray(yrs) ? yrs : []);
          const activeYear = yrs.find(y => y.is_current) || yrs[0];
          if (activeYear) setSelectedYear(activeYear.id);
        }

        if (clsRes.data?.success) {
          const clsList = clsRes.data.data?.classes || clsRes.data.data || [];
          setClasses(Array.isArray(clsList) ? clsList : []);
        }
      } catch (err) {
        console.error('Failed to load initial options:', err);
      }
    }
    loadInitialOptions();
  }, []);

  // ─── 2. Dependent Sections based on Class ──────────────────────────────────
  useEffect(() => {
    async function loadSections() {
      if (!selectedClass) {
        setSections([]);
        setSelectedSection('');
        return;
      }
      try {
        const res = await api.get(`/sections?class_id=${selectedClass}&limit=50`);
        if (res.data?.success) {
          const secs = res.data.data?.sections || res.data.data || [];
          setSections(Array.isArray(secs) ? secs : []);
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
        setSections([]);
      }
    }
    loadSections();
  }, [selectedClass]);

  // ─── 3. Dependent Students based on Class + Section ────────────────────────
  useEffect(() => {
    async function loadStudents() {
      if (!selectedClass) {
        setEnrolledStudents([]);
        setSelectedStudent('');
        return;
      }
      try {
        const params = new URLSearchParams({ class_id: selectedClass, limit: 100 });
        if (selectedYear) params.set('academic_year_id', selectedYear);
        if (selectedSection) params.set('section_id', selectedSection);

        const res = await api.get(`/enrollments?${params}`);
        if (res.data?.success) {
          const enrollments = res.data.data?.enrollments || [];
          const studs = enrollments.map(e => ({
            id: e.student_id,
            name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Student',
            admission_id: e.student_id_number || e.admission_id || e.student_admission_id || '',
          }));
          setEnrolledStudents(studs);
        }
      } catch (err) {
        console.error('Failed to load students for filter:', err);
        setEnrolledStudents([]);
      }
    }
    loadStudents();
  }, [selectedYear, selectedClass, selectedSection]);

  // ─── 4. Fetch Financial Summary KPI ─────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.set('academic_year_id', selectedYear);
      if (selectedClass) params.set('class_id', selectedClass);
      if (selectedSection) params.set('section_id', selectedSection);

      const res = await api.get(`/fees/summary?${params}`);
      if (res.data?.success && res.data.data) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch financial summary:', err);
    }
  }, [selectedYear, selectedClass, selectedSection]);

  // ─── 5. Fetch Tab-Specific Data ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (selectedYear) params.set('academic_year_id', selectedYear);
      if (selectedClass) params.set('class_id', selectedClass);
      if (selectedSection) params.set('section_id', selectedSection);
      if (selectedStudent) params.set('student_id', selectedStudent);
      if (selectedStatus) params.set('status', selectedStatus);
      if (search) params.set('search', search);

      if (activeTab === 'ledger') {
        const { data } = await api.get(`/fees/student-fees?${params}`);
        if (data.success) {
          setLedgerItems(data.data.studentFees || []);
          setPagination(data.data.pagination || {});
        }
      } else if (activeTab === 'structures') {
        const { data } = await api.get(`/fees/structures?${params}`);
        if (data.success) {
          setStructureItems(data.data.feeStructures || []);
          setPagination(data.data.pagination || {});
        }
      } else if (activeTab === 'payments') {
        const { data } = await api.get(`/fees/payments?${params}`);
        if (data.success) {
          setPaymentItems(data.data.payments || []);
          setPagination(data.data.pagination || {});
        }
      }
    } catch (err) {
      console.error('Failed to load fee items:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, selectedYear, selectedClass, selectedSection, selectedStudent, selectedStatus, search]);

  useEffect(() => {
    fetchSummary();
    fetchData();
  }, [fetchSummary, fetchData]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleResetFilters() {
    setSelectedClass('');
    setSelectedSection('');
    setSelectedStudent('');
    setSelectedStatus('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  }

  // Row click opens detailed account
  async function handleOpenDetail(record) {
    setSelectedFeeRecord(record);
    setDetailModalOpen(true);
  }

  // Open Record Payment Modal pre-filled
  function handleOpenRecordPayment(record = null) {
    setSelectedFeeRecord(record);
    setRecordModalOpen(true);
  }

  // Print Receipt directly
  function handleOpenReceipt(payment) {
    setSelectedReceipt(payment);
    setReceiptModalOpen(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* ── Top Header & Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={28} style={{ color: 'var(--primary)' }} />
            Fee & Financial Management
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage fee structures, student ledgers, installments, and payment receipts in INR (₹).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditingStructure(null);
                  setStructureModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <PlusCircle size={16} /> New Structure
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenRecordPayment(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <DollarSign size={16} /> Record Payment
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Financial Dashboard KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
        {/* Total Billed */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid var(--primary)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarSign size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Billed
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatINR(summary.totalBilled)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {summary.totalRecords} fee accounts
            </div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid var(--success)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Collected
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--success)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatINR(summary.totalCollected)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: 2, fontWeight: 600 }}>
              {summary.paidCount} fully paid · {summary.partialCount} partial
            </div>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid var(--warning)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--warning-light)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Dues
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--warning)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatINR(summary.totalOutstanding)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {summary.unpaidCount} unpaid accounts
            </div>
          </div>
        </div>

        {/* Overdue Balance */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid var(--danger)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Overdue Balance
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--danger)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatINR(summary.overdueAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 2, fontWeight: 600 }}>
              {summary.overdueCount} accounts past due date
            </div>
          </div>
        </div>
      </div>

      {/* ── Hierarchical Dynamic Filters Bar ── */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', flex: 1 }}>
            {/* Academic Year */}
            <div style={{ minWidth: 150 }}>
              <select
                className="form-select"
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(e.target.value);
                  setPage(1);
                }}
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.year_name} {y.is_current ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div style={{ minWidth: 140 }}>
              <select
                className="form-select"
                value={selectedClass}
                onChange={e => {
                  setSelectedClass(e.target.value);
                  setSelectedSection('');
                  setSelectedStudent('');
                  setPage(1);
                }}
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div style={{ minWidth: 140 }}>
              <select
                className="form-select"
                value={selectedSection}
                disabled={!selectedClass}
                onChange={e => {
                  setSelectedSection(e.target.value);
                  setSelectedStudent('');
                  setPage(1);
                }}
              >
                <option value="">All Sections</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    Section {s.section_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Student (enrolled only) */}
            <div style={{ minWidth: 160 }}>
              <select
                className="form-select"
                value={selectedStudent}
                disabled={!selectedClass}
                onChange={e => {
                  setSelectedStudent(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Students</option>
                {enrolledStudents.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.admission_id ? `(${st.admission_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            {activeTab === 'ledger' && (
              <div style={{ minWidth: 130 }}>
                <select
                  className="form-select"
                  value={selectedStatus}
                  onChange={e => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            )}

            {/* Search */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 6, minWidth: 200, flex: 1 }}>
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <Search size={15} />
                <input
                  className="form-input"
                  placeholder="Search student, receipt, or fee type..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-secondary btn-sm">
                Search
              </button>
            </form>
          </div>

          {(selectedClass || selectedSection || selectedStudent || selectedStatus || search) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleResetFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            >
              <RefreshCw size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 8 }}>
        <button
          className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ledger');
            setPage(1);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'ledger' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Layers size={16} /> Student Fee Ledger
        </button>

        <button
          className={`tab-btn ${activeTab === 'structures' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('structures');
            setPage(1);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'structures' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'structures' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Calendar size={16} /> Fee Structures
        </button>

        <button
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('payments');
            setPage(1);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'payments' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'payments' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileText size={16} /> Payment History & Receipts
        </button>
      </div>

      {/* ── Tab Content ── */}
      {loading ? (
        <div className="card" style={{ padding: 0 }}>
          <TableSkeleton rows={8} cols={7} />
        </div>
      ) : activeTab === 'ledger' ? (
        /* ══════════════════════ TAB 1: STUDENT FEE LEDGER ══════════════════════ */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {ledgerItems.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No fee records found"
              description="No student fee assignments match your current filters. Select a class or change filters."
            />
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Class / Section</th>
                    <th>Fee Structure</th>
                    <th>Academic Year</th>
                    <th style={{ textAlign: 'right' }}>Total Fee</th>
                    <th style={{ textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerItems.map(item => (
                    <tr
                      key={item.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpenDetail(item)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              flexShrink: 0,
                            }}
                          >
                            {(item.student_first_name?.[0] || 'S') + (item.student_last_name?.[0] || '')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.student_name || `${item.student_first_name || ''} ${item.student_last_name || ''}`}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.student_number ? `ID: ${item.student_number}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {item.class_name || 'Class'}
                          {item.section_name ? ` - ${item.section_name}` : ''}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.fee_type}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{item.year_name || 'Current'}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatINR(item.amount_due)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                        {formatINR(item.amount_paid)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: Number(item.balance) > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {formatINR(item.balance)}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.825rem', color: item.due_date && new Date(item.due_date) < new Date() && item.status !== 'paid' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {item.due_date || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <FeeStatusBadge status={item.status} dueDate={item.due_date} />
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleOpenDetail(item)}
                            title="View Detailed Fee Account"
                          >
                            <Eye size={13} /> Ledger
                          </button>
                          {isAdmin && Number(item.balance) > 0 && (
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => handleOpenRecordPayment(item)}
                              title="Record Payment"
                            >
                              <DollarSign size={13} /> Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'structures' ? (
        /* ══════════════════════ TAB 2: FEE STRUCTURES ══════════════════════ */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {structureItems.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No fee structures found"
              description="No fee structures have been configured yet. Click '+ New Structure' to create class-wise fees."
            />
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Fee Type</th>
                    <th>Applicable Class</th>
                    <th>Academic Year</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Default Due Date</th>
                    <th>Description</th>
                    {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {structureItems.map(struct => (
                    <tr key={struct.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{struct.fee_type}</div>
                      </td>
                      <td>
                        <span className="badge badge-sky">{struct.class_name || 'Class'}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{struct.year_name || 'All Years'}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatINR(struct.amount)}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                          {struct.due_date ? String(struct.due_date).split('T')[0] : 'None'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                        {struct.description || '—'}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={() => {
                                setEditingStructure(struct);
                                setStructureModalOpen(true);
                              }}
                              title="Edit Structure"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={() => {
                                setSelectedFeeRecord({ fee_structure_id: struct.id, class_id: struct.class_id, fee_type: struct.fee_type, amount: struct.amount });
                                setAssignModalOpen(true);
                              }}
                              title="Assign to Student"
                            >
                              <UserCheck size={13} /> Assign
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════ TAB 3: PAYMENT HISTORY ══════════════════════ */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {paymentItems.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No payment records found"
              description="No transactions have been recorded under the current filters."
            />
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Payment Date</th>
                    <th>Student Name</th>
                    <th>Fee Category</th>
                    <th>Payment Method</th>
                    <th>Reference / Transaction ID</th>
                    <th style={{ textAlign: 'right' }}>Amount Paid</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentItems.map(pay => (
                    <tr key={pay.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                          {pay.receipt_number || 'RCP-N/A'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        {pay.payment_date || pay.created_at?.split('T')[0] || '—'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {pay.student_name || `${pay.student_first_name || ''} ${pay.student_last_name || ''}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {pay.student_number ? `ID: ${pay.student_number}` : ''}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{pay.fee_type || 'Tuition Fee'}</span>
                      </td>
                      <td>
                        <span className="badge badge-subtle" style={{ textTransform: 'capitalize' }}>
                          {pay.payment_method?.replace('_', ' ') || 'Cash'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {pay.transaction_id || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        {formatINR(pay.amount)}
                      </td>
                      <td>
                        <span className="badge badge-emerald">
                          {pay.payment_status || 'Success'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleOpenReceipt(pay)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Printer size={13} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Pagination Footer ── */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {/* 1. Record Payment Modal */}
      {recordModalOpen && (
        <RecordPaymentModal
          open={recordModalOpen}
          initialRecord={selectedFeeRecord}
          onClose={() => {
            setRecordModalOpen(false);
            setSelectedFeeRecord(null);
          }}
          onSuccess={() => {
            setRecordModalOpen(false);
            setSelectedFeeRecord(null);
            fetchSummary();
            fetchData();
            success('Payment recorded successfully.');
          }}
        />
      )}

      {/* 2. Fee Structure Create/Edit Modal */}
      {structureModalOpen && (
        <FeeStructureModal
          open={structureModalOpen}
          structure={editingStructure}
          academicYears={academicYears}
          classes={classes}
          onClose={() => {
            setStructureModalOpen(false);
            setEditingStructure(null);
          }}
          onSuccess={() => {
            setStructureModalOpen(false);
            setEditingStructure(null);
            fetchSummary();
            fetchData();
            success(editingStructure ? 'Fee structure updated.' : 'Fee structure created.');
          }}
        />
      )}

      {/* 3. Assign Fee Structure to Student Modal */}
      {assignModalOpen && (
        <AssignFeeModal
          open={assignModalOpen}
          initialData={selectedFeeRecord}
          classes={classes}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedFeeRecord(null);
          }}
          onSuccess={() => {
            setAssignModalOpen(false);
            setSelectedFeeRecord(null);
            fetchSummary();
            fetchData();
            success('Fee assigned to student successfully.');
          }}
        />
      )}

      {/* 4. Student Fee Ledger Detail Account Modal */}
      {detailModalOpen && selectedFeeRecord && (
        <StudentFeeAccountModal
          open={detailModalOpen}
          record={selectedFeeRecord}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedFeeRecord(null);
          }}
          onRecordPayment={() => {
            setDetailModalOpen(false);
            setRecordModalOpen(true);
          }}
          onViewReceipt={receipt => {
            setSelectedReceipt(receipt);
            setReceiptModalOpen(true);
          }}
        />
      )}

      {/* 5. Printable Receipt Modal */}
      {receiptModalOpen && selectedReceipt && (
        <PrintableReceiptModal
          open={receiptModalOpen}
          receipt={selectedReceipt}
          onClose={() => {
            setReceiptModalOpen(false);
            setSelectedReceipt(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Record Payment Modal
// ─────────────────────────────────────────────────────────────────────────────
function RecordPaymentModal({ open, initialRecord, onClose, onSuccess }) {
  const { error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [studentId, setStudentId] = useState(initialRecord?.student_id || '');
  const [studentFeeId, setStudentFeeId] = useState(initialRecord?.id || '');
  const [amount, setAmount] = useState(initialRecord?.balance ? String(initialRecord.balance) : '');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transactionId, setTransactionId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');

  // Dropdown options
  const [allStudents, setAllStudents] = useState([]);
  const [studentUnpaidFees, setStudentUnpaidFees] = useState([]);
  const [selectedFee, setSelectedFee] = useState(initialRecord || null);

  // Load students for selector if not pre-provided
  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await api.get('/students?limit=100');
        if (res.data?.success) {
          const list = res.data.data?.students || res.data.data || [];
          setAllStudents(list);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
      }
    }
    loadStudents();
  }, []);

  // When student changes, load their unpaid/partial fees
  useEffect(() => {
    async function loadFees() {
      if (!studentId) {
        setStudentUnpaidFees([]);
        return;
      }
      try {
        const res = await api.get(`/fees/student-fees?student_id=${studentId}&limit=50`);
        if (res.data?.success) {
          const fees = res.data.data?.studentFees || [];
          const unpaid = fees.filter(f => Number(f.balance) > 0);
          setStudentUnpaidFees(unpaid);
          if (unpaid.length > 0 && !studentFeeId) {
            setStudentFeeId(unpaid[0].id);
            setSelectedFee(unpaid[0]);
            setAmount(String(unpaid[0].balance));
          }
        }
      } catch (err) {
        console.error('Failed to load student fees:', err);
      }
    }
    loadFees();
  }, [studentId]);

  // When user selects a fee from the dropdown
  function handleFeeSelect(e) {
    const feeId = e.target.value;
    setStudentFeeId(feeId);
    const found = studentUnpaidFees.find(f => f.id === feeId);
    setSelectedFee(found || null);
    if (found) {
      setAmount(String(found.balance));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentFeeId) {
      toastError('Please select a fee record to pay.');
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toastError('Please enter a valid positive payment amount.');
      return;
    }

    const currentBalance = selectedFee ? Number(selectedFee.balance) : Number(initialRecord?.balance || 0);
    if (currentBalance > 0 && numAmount > currentBalance) {
      toastError(`Payment amount (₹${numAmount}) cannot exceed outstanding balance of ₹${currentBalance}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        student_fee_id: studentFeeId,
        amount: numAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        transaction_id: transactionId.trim() || undefined,
        receipt_number: receiptNumber.trim() || undefined,
      };

      const res = await api.post('/fees/payments', payload);
      if (res.data?.success) {
        onSuccess(res.data.data);
      } else {
        toastError(res.data?.message || 'Failed to record payment.');
      }
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Payment recording failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={20} style={{ color: 'var(--success)' }} />
            Record Fee Payment
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Student Selection */}
          <div className="form-group">
            <label className="form-label">Student *</label>
            <select
              className="form-select"
              value={studentId}
              disabled={!!initialRecord?.student_id}
              onChange={e => {
                setStudentId(e.target.value);
                setStudentFeeId('');
                setSelectedFee(null);
              }}
              required
            >
              <option value="">Select student...</option>
              {allStudents.map(st => (
                <option key={st.id} value={st.id}>
                  {st.first_name} {st.last_name} ({st.student_id || 'ID N/A'})
                </option>
              ))}
            </select>
          </div>

          {/* Fee Item Selection */}
          <div className="form-group">
            <label className="form-label">Fee / Installment Due *</label>
            {initialRecord ? (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-muted)', fontSize: '0.875rem' }}>
                <span style={{ fontWeight: 600 }}>{initialRecord.fee_type}</span> — Due: {formatINR(initialRecord.amount_due)}
                <div style={{ color: 'var(--danger)', fontWeight: 700, marginTop: 2 }}>
                  Outstanding Balance: {formatINR(initialRecord.balance)}
                </div>
              </div>
            ) : (
              <select
                className="form-select"
                value={studentFeeId}
                onChange={handleFeeSelect}
                required
                disabled={studentUnpaidFees.length === 0}
              >
                <option value="">
                  {studentUnpaidFees.length === 0 ? 'No unpaid fees for this student' : 'Select fee account...'}
                </option>
                {studentUnpaidFees.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.fee_type} — Outstanding: {formatINR(f.balance)} (Total: {formatINR(f.amount_due)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Payment Amount */}
          <div className="form-group">
            <label className="form-label">Payment Amount (₹ INR) *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                className="form-input"
                style={{ paddingLeft: 30 }}
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
            {selectedFee && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => setAmount(String(selectedFee.balance))}
                >
                  Pay Full Balance ({formatINR(selectedFee.balance)})
                </button>
                {Number(selectedFee.balance) > 1000 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => setAmount(String(Math.round(Number(selectedFee.balance) / 2)))}
                  >
                    Pay Half ({formatINR(Math.round(Number(selectedFee.balance) / 2))})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Payment Date & Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input
                type="date"
                className="form-input"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                required
              >
                <option value="cash">Cash</option>
                <option value="online">Online / UPI</option>
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="cheque">Cheque</option>
                <option value="card">Debit / Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Transaction Ref & Receipt Number */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Transaction / Ref ID</label>
              <input
                className="form-input"
                placeholder="UPI ref, Cheque #, etc."
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Number</label>
              <input
                className="form-input"
                placeholder="Auto-generated if empty"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Recording...' : 'Confirm & Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Fee Structure Modal (Create / Edit)
// ─────────────────────────────────────────────────────────────────────────────
function FeeStructureModal({ open, structure, academicYears, classes, onClose, onSuccess }) {
  const { error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [yearId, setYearId] = useState(structure?.academic_year_id || academicYears[0]?.id || '');
  const [classId, setClassId] = useState(structure?.class_id || classes[0]?.id || '');
  const [feeType, setFeeType] = useState(structure?.fee_type || 'Tuition Fee');
  const [amount, setAmount] = useState(structure?.amount ? String(structure.amount) : '');
  const [dueDate, setDueDate] = useState(structure?.due_date ? String(structure.due_date).split('T')[0] : '');
  const [description, setDescription] = useState(structure?.description || '');

  const quickTypes = ['Tuition Fee', 'Examination Fee', 'Activity Fee', 'Transport Fee', 'Library Fee', 'Sports Fee', 'Lab Fee'];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!feeType.trim()) {
      toastError('Fee type name is required.');
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toastError('Please enter a valid positive fee amount.');
      return;
    }

    setSubmitting(true);
    try {
      if (structure?.id) {
        // Edit
        const payload = {
          fee_type: feeType.trim(),
          amount: numAmount,
          due_date: dueDate || null,
          description: description.trim() || null,
        };
        const res = await api.patch(`/fees/structures/${structure.id}`, payload);
        if (res.data?.success) onSuccess();
        else toastError(res.data?.message || 'Update failed.');
      } else {
        // Create
        const payload = {
          academic_year_id: yearId,
          class_id: classId,
          fee_type: feeType.trim(),
          amount: numAmount,
          due_date: dueDate || null,
          description: description.trim() || null,
        };
        const res = await api.post('/fees/structures', payload);
        if (res.data?.success) onSuccess();
        else toastError(res.data?.message || 'Creation failed.');
      }
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={20} style={{ color: 'var(--primary)' }} />
            {structure ? 'Edit Fee Structure' : 'Create Fee Structure'}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!structure && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Academic Year *</label>
                <select
                  className="form-select"
                  value={yearId}
                  onChange={e => setYearId(e.target.value)}
                  required
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.year_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Class *</label>
                <select
                  className="form-select"
                  value={classId}
                  onChange={e => setClassId(e.target.value)}
                  required
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.class_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Fee Type Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Tuition Fee"
              value={feeType}
              onChange={e => setFeeType(e.target.value)}
              required
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {quickTypes.map(t => (
                <button
                  type="button"
                  key={t}
                  className="btn btn-outline btn-xs"
                  onClick={() => setFeeType(t)}
                  style={{ fontSize: '0.7rem' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Amount (₹ INR) *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-input"
                  style={{ paddingLeft: 28 }}
                  placeholder="30000.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Due Date (Optional)</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description / Remarks</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Optional notes regarding this fee structure..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : structure ? 'Save Changes' : 'Create Structure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Assign Fee Modal
// ─────────────────────────────────────────────────────────────────────────────
function AssignFeeModal({ open, initialData, classes, onClose, onSuccess }) {
  const { error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [classId, setClassId] = useState(initialData?.class_id || classes[0]?.id || '');
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [amountDue, setAmountDue] = useState(initialData?.amount ? String(initialData.amount) : '');

  // Load students of this class
  useEffect(() => {
    async function loadClassStudents() {
      if (!classId) return;
      try {
        const res = await api.get(`/enrollments?class_id=${classId}&limit=50`);
        if (res.data?.success) {
          const list = res.data.data?.enrollments || [];
          setStudents(list);
          if (list[0]) setStudentId(list[0].student_id);
        }
      } catch (err) {
        console.error('Failed to load class students:', err);
      }
    }
    loadClassStudents();
  }, [classId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId) {
      toastError('Please select a student.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        student_id: studentId,
        fee_structure_id: initialData.fee_structure_id,
        amount_due: Number(amountDue) || Number(initialData.amount),
      };
      const res = await api.post('/fees/student-fees', payload);
      if (res.data?.success) onSuccess();
      else toastError(res.data?.message || 'Assignment failed.');
    } catch (err) {
      toastError(err.response?.data?.message || err.message || 'Fee assignment failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={20} style={{ color: 'var(--primary)' }} />
            Assign Fee to Student
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-muted)', fontSize: '0.875rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{initialData?.fee_type}</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
              Standard Structure Amount: <strong style={{ color: 'var(--primary)' }}>{formatINR(initialData?.amount)}</strong>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Student *</label>
            <select
              className="form-select"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              required
            >
              {students.map(s => (
                <option key={s.student_id} value={s.student_id}>
                  {s.first_name} {s.last_name} ({s.student_id_number || s.admission_id || 'ID N/A'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Amount Due (₹ INR) *</label>
            <input
              type="number"
              step="0.01"
              min="1"
              className="form-input"
              value={amountDue}
              onChange={e => setAmountDue(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Detailed Student Fee Account Ledger Modal
// ─────────────────────────────────────────────────────────────────────────────
function StudentFeeAccountModal({ open, record, onClose, onRecordPayment, onViewReceipt }) {
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    async function loadLedgerPayments() {
      setLoadingPayments(true);
      try {
        const res = await api.get(`/fees/payments?student_fee_id=${record.id}&limit=50`);
        if (res.data?.success) {
          setPayments(res.data.data?.payments || []);
        }
      } catch (err) {
        console.error('Failed to load payments for fee record:', err);
      } finally {
        setLoadingPayments(false);
      }
    }
    loadLedgerPayments();
  }, [record.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 680, padding: 24 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {record.student_name || `${record.student_first_name || ''} ${record.student_last_name || ''}`}
              </h2>
              <FeeStatusBadge status={record.status} dueDate={record.due_date} />
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Admission ID: <strong>{record.student_number || 'STU-N/A'}</strong> · {record.class_name || 'Class'} {record.section_name ? `- Sec ${record.section_name}` : ''}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Ledger Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Fee Billed
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              {formatINR(record.amount_due)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{record.fee_type}</span>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--success-light)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Paid
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
              {formatINR(record.amount_paid)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>{payments.length} transactions</span>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: Number(record.balance) > 0 ? 'var(--danger-light)' : 'var(--bg-muted)' }}>
            <span style={{ fontSize: '0.72rem', color: Number(record.balance) > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Remaining Dues
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: Number(record.balance) > 0 ? 'var(--danger)' : 'var(--text-primary)', marginTop: 2 }}>
              {formatINR(record.balance)}
            </div>
            <span style={{ fontSize: '0.75rem', color: Number(record.balance) > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
              Due: {record.due_date || 'No due date'}
            </span>
          </div>
        </div>

        {/* Transaction History Section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Payment & Transaction History
            </h3>
            {Number(record.balance) > 0 && (
              <button className="btn btn-primary btn-xs" onClick={onRecordPayment} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <DollarSign size={13} /> Record Payment
              </button>
            )}
          </div>

          {loadingPayments ? (
            <TableSkeleton rows={3} cols={4} />
          ) : payments.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              No payments have been received yet for this fee account.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt #</th>
                    <th>Method</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '0.825rem' }}>{p.payment_date || p.created_at?.split('T')[0]}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                        {p.receipt_number}
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: '0.825rem' }}>
                        {p.payment_method?.replace('_', ' ')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        {formatINR(p.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => onViewReceipt(p)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Printer size={12} /> Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
          {Number(record.balance) > 0 && (
            <button className="btn btn-primary btn-sm" onClick={onRecordPayment}>
              Pay Outstanding Balance ({formatINR(record.balance)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Printable Official Fee Receipt Modal
// ─────────────────────────────────────────────────────────────────────────────
function PrintableReceiptModal({ open, receipt, onClose }) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: 620,
          padding: 32,
          background: '#ffffff',
          color: '#111827',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Print / Close Header Bar (Hidden during print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Official Fee Receipt Preview
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Printer size={15} /> Print Receipt
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Official Printable Receipt Body ── */}
        <div
          id="printable-fee-receipt"
          style={{
            border: '2px solid #0f172a',
            padding: 24,
            borderRadius: 8,
            backgroundColor: '#ffffff',
            position: 'relative',
          }}
        >
          {/* Watermark Logo / Text */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-30deg)',
              fontSize: '4.5rem',
              fontWeight: 900,
              color: 'rgba(22, 101, 52, 0.05)',
              userSelect: 'none',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            EDUMANAGE
          </div>

          {/* School Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #cbd5e1', paddingBottom: 16, marginBottom: 16 }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#166534', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              EduManage Public School
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Affiliation No. 1030048 · CBSE Board · New Delhi, India
            </p>
            <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 12px', background: '#ecfdf5', color: '#166534', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Fee Collection Receipt
            </div>
          </div>

          {/* Metadata Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 16 }}>
            <div>
              <span style={{ color: '#64748b' }}>Receipt No:</span>{' '}
              <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{receipt.receipt_number || 'RCP-N/A'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Date:</span>{' '}
              <strong style={{ color: '#0f172a' }}>
                {receipt.payment_date || receipt.created_at?.split('T')[0] || new Date().toLocaleDateString('en-IN')}
              </strong>
            </div>
          </div>

          {/* Student Info Box */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 14px', marginBottom: 18, fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <span style={{ color: '#64748b' }}>Student Name:</span>{' '}
                <strong style={{ color: '#0f172a' }}>
                  {receipt.student_name || `${receipt.student_first_name || ''} ${receipt.student_last_name || ''}`}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Admission ID:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{receipt.student_number || 'STU-N/A'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Class & Section:</span>{' '}
                <strong style={{ color: '#0f172a' }}>
                  {receipt.class_name || 'Class 7'} {receipt.section_name ? `(${receipt.section_name})` : ''}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Academic Year:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{receipt.year_name || '2026-2027'}</strong>
              </div>
            </div>
          </div>

          {/* Fee Breakdown Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#334155' }}>Description / Fee Category</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#334155' }}>Payment Mode</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: '#334155' }}>Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px', fontWeight: 600 }}>{receipt.fee_type || 'Tuition Fee'}</td>
                <td style={{ padding: '10px', textTransform: 'capitalize', color: '#475569' }}>
                  {receipt.payment_method?.replace('_', ' ') || 'Cash'}{' '}
                  {receipt.transaction_id ? `(${receipt.transaction_id})` : ''}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#166534', fontSize: '1rem' }}>
                  {formatINR(receipt.amount)}
                </td>
              </tr>
              <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                <td colSpan={2} style={{ padding: '10px', textAlign: 'right' }}>Total Amount Paid:</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#166534', fontSize: '1.1rem' }}>
                  {formatINR(receipt.amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatures & Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 36, paddingTop: 16 }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              <div>* This is a computer-generated fee receipt.</div>
              <div>EduManage School Management System</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 140, borderBottom: '1px solid #0f172a', marginBottom: 4 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Authorized Signatory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
