import React, { useState, useEffect } from 'react';
import { CreditCard, AlertTriangle, CheckCircle, Send, Settings, Plus } from 'lucide-react';

export function FeeManagementDashboard({ token, schoolId, triggerAlert }) {
  const [students, setStudents] = useState([]);
  const [term, setTerm] = useState('Term 1 2026');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [newFeeLimit, setNewFeeLimit] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [reminderChannel, setReminderChannel] = useState('sms');
  const [selectedPaymentStudent, setSelectedPaymentStudent] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('Term 1 2026');

  // Fetch fee configuration and students on load
  useEffect(() => {
    fetchFeeConfig();
    fetchStudents();
  }, [term]);

  const fetchFeeConfig = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/fees/reminder-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setNewFeeLimit(data?.time_limit_days || 7);
        setMessageTemplate(data?.message_template || '');
        setReminderChannel(data?.channel || 'sms');
      }
    } catch (err) {
      console.error('Fetch config error:', err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const url = `http://localhost:5000/api/fees/students?term=${term}&search=${search}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
      }
    } catch (err) {
      triggerAlert('Failed to load students', true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/fees/reminder-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          time_limit_days: parseInt(newFeeLimit),
          message_template: messageTemplate,
          channel: reminderChannel,
          is_enabled: true
        })
      });
      if (res.ok) {
        triggerAlert('Fee reminder configuration updated!', false);
        setShowConfig(false);
        fetchFeeConfig();
      }
    } catch (err) {
      triggerAlert('Failed to update config', true);
    }
  };

  const handleSendReminders = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/fees/send-reminders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        triggerAlert(`Reminders sent to ${data.sent} students (${data.failed} failed)`, false);
      }
    } catch (err) {
      triggerAlert('Failed to send reminders', true);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedPaymentStudent) {
      triggerAlert('Select a student', true);
      return;
    }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      triggerAlert('Enter a valid payment amount', true);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/fees/payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_id: selectedPaymentStudent.id,
          term: paymentTerm,
          amount_paid: parseFloat(paymentAmount)
        })
      });
      if (res.ok) {
        triggerAlert('Payment recorded successfully', false);
        setPaymentAmount('');
        setSelectedPaymentStudent(null);
        fetchStudents();
      }
    } catch (err) {
      triggerAlert('Failed to record payment', true);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="text-blue-600" /> Fee Management Dashboard
        </h2>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Settings size={18} /> Configure Reminders
        </button>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold mb-4">Automatic Fee Reminder Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Time Limit (Days)</label>
              <input
                type="number"
                value={newFeeLimit}
                onChange={(e) => setNewFeeLimit(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Number of days to wait before sending reminder"
              />
              <p className="text-xs text-gray-600 mt-1">
                Reminders will be sent for fees not paid after this many days
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Channel</label>
              <select
                value={reminderChannel}
                onChange={(e) => setReminderChannel(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Message Template</label>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full border rounded px-3 py-2 h-24"
              placeholder="Use {STUDENT_NAME}, {BALANCE}, {TERM} as placeholders"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleUpdateConfig}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Save Configuration
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment Recording Section */}
      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={24} className="text-green-600" />
          <h3 className="text-xl font-bold text-green-700">Record Student Payment</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Enter payment details to update student fee balance.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Student</label>
            <select
              value={selectedPaymentStudent?.id || ''}
              onChange={(e) => {
                const student = students.find((s) => s.id === e.target.value);
                setSelectedPaymentStudent(student);
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Choose a student...</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name} ({student.roll_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Select Term</label>
            <select
              value={paymentTerm}
              onChange={(e) => setPaymentTerm(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="Term 1 2026">Term 1 2026</option>
              <option value="Term 2 2026">Term 2 2026</option>
              <option value="Term 3 2026">Term 3 2026</option>
            </select>
          </div>
        </div>

        {selectedPaymentStudent && (
          <div className="bg-white border rounded-lg p-4 mb-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Class Name:</span>
                <div className="font-bold text-lg">{selectedPaymentStudent.class_name}</div>
              </div>
              <div>
                <span className="text-gray-600">Fee Amount:</span>
                <div className="font-bold text-lg">MK {(parseFloat(selectedPaymentStudent.fee_amount) || 0).toFixed(2)}</div>
              </div>
              <div>
                <span className="text-gray-600">Already Paid:</span>
                <div className="font-bold text-lg">MK {(parseFloat(selectedPaymentStudent.amount_paid) || 0).toFixed(2)}</div>
              </div>
              <div>
                <span className="text-gray-600">Balance:</span>
                <div className="font-bold text-lg" style={{ color: selectedPaymentStudent.balance > 0 ? '#dc2626' : '#16a34a' }}>
                  MK {(parseFloat(selectedPaymentStudent.balance) || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Amount to Pay (MK)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <button
            onClick={handleRecordPayment}
            disabled={!selectedPaymentStudent || !paymentAmount}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-300"
          >
            Record Payment
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Term</label>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="Term 1 2026">Term 1 2026</option>
              <option value="Term 2 2026">Term 2 2026</option>
              <option value="Term 3 2026">Term 3 2026</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Search Student</label>
            <input
              type="text"
              placeholder="Name or roll number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSendReminders}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              <Send size={18} /> Send Reminders Now
            </button>
          </div>
        </div>
        <button
          onClick={fetchStudents}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Apply Filters
        </button>
      </div>

      {/* Students Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left">Student Name</th>
              <th className="border p-3 text-left">Roll #</th>
              <th className="border p-3 text-left">Class</th>
              <th className="border p-3 text-left">Subjects</th>
              <th className="border p-3 text-right">Fee Amount</th>
              <th className="border p-3 text-right">Paid</th>
              <th className="border p-3 text-right">Balance</th>
              <th className="border p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="border p-4 text-center text-gray-500">
                  Loading students...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan="8" className="border p-4 text-center text-gray-500">
                  No students found.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="border p-3">{student.full_name}</td>
                  <td className="border p-3">{student.roll_number}</td>
                  <td className="border p-3">{student.class_name}</td>
                  <td className="border p-3 text-sm">{student.subjects || 'N/A'}</td>
                  <td className="border p-3 text-right">MK {(parseFloat(student.fee_amount) || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right">MK {(parseFloat(student.amount_paid) || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right font-bold">
                    <span style={{ color: student.fee_color === 'red' ? '#dc2626' : '#16a34a' }}>
                      MK {(parseFloat(student.balance) || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="border p-3 text-center">
                    {student.balance > 0 ? (
                      <span className="flex items-center justify-center gap-1 text-red-600">
                        <AlertTriangle size={16} /> Pending
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-green-600">
                        <CheckCircle size={16} /> Paid
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
