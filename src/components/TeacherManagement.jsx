import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Search, Plus, Trash2 } from 'lucide-react';

export function TeacherManagement({ token, schoolId, triggerAlert }) {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [newClass, setNewClass] = useState('');
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
    fetchClasses();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const url = search 
        ? `http://localhost:5000/api/teachers/search?q=${search}`
        : 'http://localhost:5000/api/teachers';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.teachers);
        setSelectedTeacher(null);
        setTeacherAssignments([]);
      } else {
        triggerAlert('Failed to load teachers', true);
      }
    } catch (err) {
      triggerAlert('Failed to load teachers', true);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/subjects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects);
      }
    } catch (err) {
      console.error('Failed to load subjects', err);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes);
      }
    } catch (err) {
      console.error('Failed to load classes', err);
    }
  };

  const handleViewAssignments = async (teacher) => {
    try {
      const res = await fetch(`http://localhost:5000/api/teachers/${teacher.id}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedTeacher(teacher);
        setTeacherAssignments(data.assignments);
      } else {
        triggerAlert('Failed to load assignments', true);
      }
    } catch (err) {
      triggerAlert('Failed to load assignments', true);
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    if (!window.confirm(`Delete teacher ${teacher.full_name}? This will remove all their assignments.`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/teachers/${teacher.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        triggerAlert('Teacher deleted successfully', false);
        setSelectedTeacher(null);
        setTeacherAssignments([]);
        fetchTeachers();
      } else {
        const data = await res.json();
        triggerAlert(data.message || 'Failed to delete teacher', true);
      }
    } catch (err) {
      triggerAlert('Failed to delete teacher', true);
    }
  };

  const handleAddAssignment = async (subjectId, classId) => {
    try {
      const currentAssignments = teacherAssignments.map(a => ({
        subject_id: a.subject_id,
        class_id: a.class_id
      }));
      currentAssignments.push({ subject_id: subjectId, class_id: classId });

      const res = await fetch(`http://localhost:5000/api/teachers/${selectedTeacher.id}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ assignments: currentAssignments })
      });

      if (res.ok) {
        triggerAlert('Assignment added successfully', false);
        handleViewAssignments(selectedTeacher);
      } else {
        triggerAlert('Failed to add assignment', true);
      }
    } catch (err) {
      triggerAlert('Failed to add assignment', true);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubject.trim()) {
      triggerAlert('Subject name required', true);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/subjects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject_name: newSubject })
      });

      if (res.ok) {
        triggerAlert('Subject added successfully', false);
        setNewSubject('');
        setShowSubjectForm(false);
        fetchSubjects();
      } else {
        triggerAlert('Failed to add subject', true);
      }
    } catch (err) {
      triggerAlert('Failed to add subject', true);
    }
  };

  const handleAddClass = async () => {
    if (!newClass.trim()) {
      triggerAlert('Class name required', true);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/classes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ class_name: newClass })
      });

      if (res.ok) {
        triggerAlert('Class added successfully', false);
        setNewClass('');
        setShowClassForm(false);
        fetchClasses();
      } else {
        triggerAlert('Failed to add class', true);
      }
    } catch (err) {
      triggerAlert('Failed to add class', true);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Users className="text-purple-600" /> Teacher Management
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Teachers Table */}
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search teacher by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />
            <button
              onClick={fetchTeachers}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              <Search size={16} className="inline mr-2" /> Search
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowSubjectForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              <Plus size={16} /> Add Subject
            </button>
            <button
              onClick={() => setShowClassForm(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
            >
              <Plus size={16} /> Add Class
            </button>
          </div>

          {showSubjectForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Subject name"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                />
                <button
                  onClick={handleAddSubject}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowSubjectForm(false)}
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showClassForm && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Class name"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                />
                <button
                  onClick={handleAddClass}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowClassForm(false)}
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Teacher Name</th>
                  <th className="border p-3 text-left">Email</th>
                  <th className="border p-3 text-left">Assignments</th>
                  <th className="border p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="border p-4 text-center text-gray-500">
                      Loading teachers...
                    </td>
                  </tr>
                ) : teachers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="border p-4 text-center text-gray-500">
                      No teachers found.
                    </td>
                  </tr>
                ) : (
                  teachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedTeacher?.id === teacher.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleViewAssignments(teacher)}
                    >
                      <td className="border p-3">{teacher.full_name}</td>
                      <td className="border p-3 text-sm text-gray-600">{teacher.email}</td>
                      <td className="border p-3 text-sm text-gray-600">
                        {teacher.assignment_count > 0 ? `${teacher.assignment_count} assigned` : 'None'}
                      </td>
                      <td className="border p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTeacher(teacher);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          <Trash2 size={16} className="inline" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Teacher Details & Assignments */}
        <div className="lg:col-span-2 border rounded-lg p-4 bg-gray-50">
          {selectedTeacher ? (
            <div>
              <h4 className="font-bold mb-4 text-lg">
                Assignments: {selectedTeacher.full_name}
              </h4>

              <div className="mb-4 max-h-48 overflow-y-auto">
                {teacherAssignments.length === 0 ? (
                  <p className="text-gray-500 text-sm">No assignments yet</p>
                ) : (
                  <div className="space-y-2">
                    {teacherAssignments.map((assignment, idx) => (
                      <div key={idx} className="bg-white p-3 rounded text-sm border">
                        <div className="font-medium">{assignment.subject_name}</div>
                        <div className="text-gray-600">{assignment.class_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium mb-2">Add Assignment</label>
                <select
                  id="subjectSelect"
                  className="w-full border rounded px-2 py-2 mb-2 text-sm"
                  defaultValue=""
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject_name}
                    </option>
                  ))}
                </select>
                <select
                  id="classSelect"
                  className="w-full border rounded px-2 py-2 mb-2 text-sm"
                  defaultValue=""
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const subjectId = document.getElementById('subjectSelect').value;
                    const classId = document.getElementById('classSelect').value;
                    if (subjectId && classId) {
                      handleAddAssignment(subjectId, classId);
                    } else {
                      triggerAlert('Select both subject and class', true);
                    }
                  }}
                  className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Add Assignment
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Select a teacher from the table to view and manage assignments</p>
          )}
        </div>
      </div>
    </div>
  );
}
