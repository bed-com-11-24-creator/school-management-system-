import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';

export function ClassSubjectsAssignment({ token, triggerAlert }) {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classSubjects, setClassSubjects] = useState([]);
  const [availableSubjectsForClass, setAvailableSubjectsForClass] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
      }
    } catch (err) {
      triggerAlert('Failed to load classes', true);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/subjects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects || []);
      }
    } catch (err) {
      triggerAlert('Failed to load subjects', true);
    }
  };

  const handleSelectClass = async (classItem) => {
    setSelectedClass(classItem);
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/class-subjects/${classItem.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassSubjects(data.subjects || []);
        const assignedIds = new Set((data.subjects || []).map((s) => s.id));
        setAvailableSubjectsForClass(subjects.filter((s) => !assignedIds.has(s.id)));
      } else {
        setClassSubjects([]);
        setAvailableSubjectsForClass(subjects);
      }
    } catch (err) {
      console.error('Failed to load class subjects', err);
      setClassSubjects([]);
      setAvailableSubjectsForClass(subjects);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubject) {
      triggerAlert('Select a subject', true);
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/class-subjects/${selectedClass.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject_id: newSubject })
      });

      if (res.ok) {
        triggerAlert('Subject added to class', false);
        setNewSubject('');
        setShowAddSubjectForm(false);
        handleSelectClass(selectedClass);
      } else {
        triggerAlert('Failed to add subject', true);
      }
    } catch (err) {
      triggerAlert('Failed to add subject', true);
    }
  };

  const handleRemoveSubject = async (subjectId) => {
    if (!window.confirm('Remove this subject from the class?')) {
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:5000/api/class-subjects/${selectedClass.id}/${subjectId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.ok) {
        triggerAlert('Subject removed from class', false);
        handleSelectClass(selectedClass);
      } else {
        triggerAlert('Failed to remove subject', true);
      }
    } catch (err) {
      triggerAlert('Failed to remove subject', true);
    }
  };

  const handleAddNewSubject = async () => {
    if (!newSubject.trim()) {
      triggerAlert('Subject name required', true);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/subjects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject_name: newSubject })
      });

      if (res.ok) {
        triggerAlert('Subject created successfully', false);
        setNewSubject('');
        setShowAddSubjectForm(false);
        fetchSubjects();
      } else {
        triggerAlert('Failed to create subject', true);
      }
    } catch (err) {
      triggerAlert('Failed to create subject', true);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <BookOpen className="text-blue-600" /> Class Subject Assignment
      </h2>

      <p className="text-gray-600 mb-6">
        Assign subjects that will be taught in each class. Students registering for that class will then choose from these subjects.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes List */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Classes</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
            {classes.length === 0 ? (
              <p className="text-gray-500 text-sm">No classes available. Create one in Teacher Management first.</p>
            ) : (
              classes.map((classItem) => (
                <button
                  key={classItem.id}
                  onClick={() => handleSelectClass(classItem)}
                  className={`w-full text-left px-4 py-3 rounded border transition ${
                    selectedClass?.id === classItem.id
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{classItem.class_name}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Subjects Assignment */}
        <div>
          {selectedClass ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{selectedClass.class_name} - Subjects</h3>
                <button
                  onClick={() => setShowAddSubjectForm(!showAddSubjectForm)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  <Plus size={16} /> Add Subject
                </button>
              </div>

              {showAddSubjectForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium mb-2">Select Subject</label>
                  {availableSubjectsForClass.length === 0 ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        All subjects already assigned. Create a new subject:
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="New subject name"
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          className="flex-1 border rounded px-3 py-2 text-sm"
                        />
                        <button
                          onClick={handleAddNewSubject}
                          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <select
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        className="w-full border rounded px-3 py-2 mb-2"
                      >
                        <option value="">Choose a subject...</option>
                        {availableSubjectsForClass.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.subject_name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-gray-600 mb-3">
                        Or create a new one:
                      </div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="New subject name"
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          className="flex-1 border rounded px-3 py-2 text-sm"
                        />
                        <button
                          onClick={handleAddNewSubject}
                          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddSubject}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
                    >
                      Add to Class
                    </button>
                    <button
                      onClick={() => {
                        setShowAddSubjectForm(false);
                        setNewSubject('');
                      }}
                      className="flex-1 bg-gray-300 px-3 py-2 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                {loading ? (
                  <p className="text-gray-500 text-sm">Loading subjects...</p>
                ) : classSubjects.length === 0 ? (
                  <p className="text-gray-500 text-sm">No subjects assigned yet. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {classSubjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="flex items-center justify-between bg-white border rounded p-3"
                      >
                        <div className="font-medium text-sm">{subject.subject_name}</div>
                        <button
                          onClick={() => handleRemoveSubject(subject.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-8 bg-gray-50 text-center">
              <p className="text-gray-500">Select a class to manage its subjects</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
