import React, { useState, useEffect } from 'react';
import { CheckSquare, Calendar, Users, Save } from 'lucide-react';

export function TeacherAttendancePanel({ token, userId, userRole, triggerAlert }) {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole === 'teacher') {
      fetchTeacherAssignments();
    }
  }, []);

  useEffect(() => {
    if (selectedAssignment) {
      fetchStudents();
    }
  }, [selectedAssignment, attendanceDate]);

  const fetchTeacherAssignments = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/teachers/${userId}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments);
        if (data.assignments.length > 0) {
          setSelectedAssignment(data.assignments[0]);
        }
      }
    } catch (err) {
      triggerAlert('Failed to load assignments', true);
    }
  };

  const fetchStudents = async () => {
    if (!selectedAssignment) return;

    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/teachers/${userId}/students?subject_id=${selectedAssignment.subject_id}&class_id=${selectedAssignment.class_id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);

        // Fetch existing attendance for this date
        const attendanceRes = await fetch(
          `http://localhost:5000/api/attendance/${attendanceDate}?subject_id=${selectedAssignment.subject_id}&class_id=${selectedAssignment.class_id}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (attendanceRes.ok) {
          const attendanceData = await attendanceRes.json();
          const attendanceMap = {};
          attendanceData.attendance.forEach((record) => {
            attendanceMap[record.id] = record.status;
          });
          setAttendance(attendanceMap);
        }
      }
    } catch (err) {
      triggerAlert('Failed to load students', true);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (studentId, status) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSaveAttendance = async () => {
    try {
      for (const [studentId, status] of Object.entries(attendance)) {
        if (status !== 'not_marked') {
          const res = await fetch('http://localhost:5000/api/attendance', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              student_id: studentId,
              date: attendanceDate,
              status
            })
          });

          if (!res.ok) {
            triggerAlert('Failed to save some attendance records', true);
            return;
          }
        }
      }
      triggerAlert('Attendance saved successfully', false);
    } catch (err) {
      triggerAlert('Failed to save attendance', true);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <CheckSquare className="text-green-600" /> Attendance Management
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Class & Subject</label>
          <select
            value={selectedAssignment?.id || ''}
            onChange={(e) => {
              const selected = assignments.find((a) => a.id === e.target.value);
              setSelectedAssignment(selected);
            }}
            className="w-full border rounded px-3 py-2"
          >
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.class_name} - {assignment.subject_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            <Calendar size={16} className="inline mr-1" /> Date
          </label>
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleSaveAttendance}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            <Save size={18} /> Save Attendance
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left">Student Name</th>
              <th className="border p-3 text-left">Roll #</th>
              <th className="border p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="border p-3">{student.full_name}</td>
                <td className="border p-3">{student.roll_number}</td>
                <td className="border p-3 text-center">
                  <select
                    value={attendance[student.id] || 'not_marked'}
                    onChange={(e) => handleAttendanceChange(student.id, e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="not_marked">Not Marked</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {students.length === 0 && !loading && (
        <p className="text-gray-500 text-center py-4">
          No students enrolled in this class/subject
        </p>
      )}
    </div>
  );
}
