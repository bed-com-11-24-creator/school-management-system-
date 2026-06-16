import React, { useState, useEffect } from 'react';
import { Users, Archive, Search } from 'lucide-react';

export function AlumniManagement({ token, schoolId, triggerAlert }) {
  const [alumni, setAlumni] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAlumni = async () => {
    setLoading(true);
    try {
      const url = search
        ? `http://localhost:5000/api/students/alumni?search=${search}`
        : 'http://localhost:5000/api/students/alumni';

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlumni(data.alumni);
      }
    } catch (err) {
      triggerAlert('Failed to load alumni', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlumni();
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Archive className="text-blue-600" /> Alumni & Former Students
      </h2>

      {/* Search Section */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          onClick={fetchAlumni}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Search size={18} /> Search
        </button>
      </div>

      {/* Alumni Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left">Student Name</th>
              <th className="border p-3 text-left">Roll #</th>
              <th className="border p-3 text-left">Last Class</th>
              <th className="border p-3 text-left">Parent Name</th>
              <th className="border p-3 text-left">Contact</th>
              <th className="border p-3 text-left">Graduation Date</th>
              <th className="border p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {alumni.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="border p-3 font-medium">{student.full_name}</td>
                <td className="border p-3">{student.roll_number}</td>
                <td className="border p-3">{student.class_name}</td>
                <td className="border p-3">{student.parent_name || '-'}</td>
                <td className="border p-3">{student.parent_phone || '-'}</td>
                <td className="border p-3">
                  {student.graduation_date ? new Date(student.graduation_date).toLocaleDateString() : '-'}
                </td>
                <td className="border p-3">
                  <span className={`px-2 py-1 rounded text-white text-sm ${
                    student.status === 'graduated' 
                      ? 'bg-green-600' 
                      : student.status === 'transferred'
                        ? 'bg-blue-600'
                        : 'bg-red-600'
                  }`}>
                    {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {alumni.length === 0 && !loading && (
        <p className="text-gray-500 text-center py-8">
          No alumni records found
        </p>
      )}

      {loading && (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      )}
    </div>
  );
}
