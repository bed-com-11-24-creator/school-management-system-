import React, { useState, useEffect } from 'react';
import { BookOpen, Search } from 'lucide-react';

export function StudentSubjectRegistration({ token, schoolId, triggerAlert }) {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSubjects, setStudentSubjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchSubjects();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`http://localhost:5000/api/fees/students${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
      } else {
        triggerAlert('Failed to load students', true);
      }
    } catch (err) {
      triggerAlert('Failed to load students', true);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/subjects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects);
      } else {
        triggerAlert('Failed to load subjects', true);
      }
    } catch (err) {
      triggerAlert('Failed to load subjects', true);
    }
  };

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    try {
      const res = await fetch(`http://localhost:5000/api/students/${student.id}/subjects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudentSubjects(data.subjects.map((s) => s.id));
      } else {
        triggerAlert('Failed to load student subjects', true);
      }
    } catch (err) {
      triggerAlert('Failed to load student subjects', true);
    }
  };

  const handleToggleSubject = (subjectId) => {
    setStudentSubjects((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleSaveSubjects = async () => {
    if (!selectedStudent) return;

    try {
      const res = await fetch(`http://localhost:5000/api/students/${selectedStudent.id}/subjects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject_ids: studentSubjects })
      });

      if (res.ok) {
        triggerAlert('Student subjects updated successfully', false);
        setSelectedStudent(null);
        setStudentSubjects([]);
        fetchStudents();
      } else {
        triggerAlert('Failed to save subjects', true);
      }
    } catch (err) {
      triggerAlert('Failed to save subjects', true);
    }
  };

  const classSummary = students.reduce((summary, student) => {
    if (!student.class_name) return summary;
    const subjectsForClass = student.subjects ? student.subjects.split(', ').filter(Boolean) : [];
    if (!summary[student.class_name]) {
      summary[student.class_name] = new Set(subjectsForClass);
    } else {
      subjectsForClass.forEach((sub) => summary[student.class_name].add(sub));
    }
    return summary;
  }, {});

  return (
    <div className="p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <BookOpen className="text-yellow-600" /> Student Subject Registration
      </h2>

      <p className="text-gray-600 mb-6">
        Register students to subjects directly and review what each class is learning.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search student by name or roll number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />
            <button
              onClick={fetchStudents}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              <Search size={16} className="inline mr-2" /> Search
            </button>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Student Name</th>
                  <th className="border p-3 text-left">Roll #</th>
                  <th className="border p-3 text-left">Class</th>
                  <th className="border p-3 text-left">Subjects Registered</th>
                  <th className="border p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="border p-4 text-center text-gray-500">
                      {loading ? 'Loading students...' : 'No students found.'}
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr
                      key={student.id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedStudent?.id === student.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleSelectStudent(student)}
                    >
                      <td className="border p-3">{student.full_name}</td>
                      <td className="border p-3">{student.roll_number}</td>
                      <td className="border p-3">{student.class_name || 'N/A'}</td>
                      <td className="border p-3 text-sm text-gray-600">{student.subjects || 'No subjects assigned'}</td>
                      <td className="border p-3 text-center">
                        <button className="text-blue-600 underline text-sm">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold mb-4">Class Subject Summary</h3>
          {Object.keys(classSummary).length === 0 ? (
            <p className="text-sm text-gray-500">No class subjects available yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(classSummary).map(([className, subjectsSet]) => (
                <div key={className} className="bg-white rounded-lg border p-3 text-sm">
                  <div className="font-medium mb-1">{className}</div>
                  <div className="text-gray-600">
                    {Array.from(subjectsSet).sort().join(', ') || 'No subjects registered'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-gray-50">
        {selectedStudent ? (
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold">Manage Subjects for {selectedStudent.full_name}</h3>
                <p className="text-sm text-gray-600">Class: {selectedStudent.class_name || 'N/A'}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setStudentSubjects([]);
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear Selection
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-h-72 overflow-y-auto">
              {subjects.map((subject) => (
                <label key={subject.id} className="flex items-center gap-2 border rounded p-3 bg-white">
                  <input
                    type="checkbox"
                    checked={studentSubjects.includes(subject.id)}
                    onChange={() => handleToggleSubject(subject.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{subject.subject_name}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleSaveSubjects}
              className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700"
            >
              Save Student Subjects
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Choose a student from the table above to register subjects.</p>
        )}
      </div>
    </div>
  );
}
