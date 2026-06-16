import React, { useState, useEffect } from 'react';

export function ClassSubjectRoster({ token, triggerAlert }) {
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/class-rosters', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
      } else {
        const data = await res.json();
        triggerAlert(data.message || 'Failed to load class rosters', true);
      }
    } catch (err) {
      triggerAlert('Failed to load class rosters', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const filteredClasses = classes
    .map((classItem) => ({
      ...classItem,
      subjects: classItem.subjects.filter((subject) =>
        subject.subject_name.toLowerCase().includes(search.toLowerCase()) ||
        (subject.teacher_name || '').toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter((classItem) =>
      classItem.class_name.toLowerCase().includes(search.toLowerCase()) || classItem.subjects.length > 0
    );

  return (
    <div className="p-6 bg-white rounded-lg">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Class Subject Rosters</h2>
          <p className="text-gray-600 mt-2 max-w-2xl">
            See each class, the subjects students are registered for, and the assigned teacher for the subject.
            This roster also makes it easy to verify that student registrations flow into each teacher's class list.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Search class, subject or teacher"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 w-full sm:w-80"
          />
          <button
            onClick={fetchRoster}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-600">Loading class rosters...</div>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center text-gray-600">No class rosters found.</div>
      ) : (
        <div className="space-y-6">
          {filteredClasses.map((classItem) => (
            <div key={classItem.class_id} className="border rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{classItem.class_name}</h3>
                  <p className="text-sm text-gray-500">{classItem.subjects.length} subject(s)</p>
                </div>
              </div>

              {classItem.subjects.length === 0 ? (
                <p className="text-gray-500">No subjects or student registrations match the search.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white border-b">
                        <th className="border px-3 py-2 text-left">Subject</th>
                        <th className="border px-3 py-2 text-left">Teacher</th>
                        <th className="border px-3 py-2 text-left">Students Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classItem.subjects.map((subject) => (
                        <tr key={subject.subject_id} className="bg-white hover:bg-gray-100">
                          <td className="border px-3 py-2 align-top">{subject.subject_name}</td>
                          <td className="border px-3 py-2 align-top">
                            {subject.teacher_name || 'Unassigned'}
                          </td>
                          <td className="border px-3 py-2 align-top text-sm text-gray-700">
                            {subject.students.length > 0 ? (
                              <div className="space-y-1">
                                {subject.students.map((student) => (
                                  <div key={student.student_id}>
                                    <span className="font-medium">{student.student_name}</span>
                                    <span className="text-gray-500"> • {student.roll_number}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500">No students registered yet</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
