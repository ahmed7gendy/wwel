import React, { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase'; // تأكد من تعديل المسار وفقاً لمشروعك
import './ArchivedTasksPage.css'; // قم بإنشاء ملف CSS لتحسين تصميم الصفحة

const ArchivedTasksPage = () => {
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArchivedTasks = async () => {
      try {
        const archivedTasksRef = ref(db, 'archivedTasks');
        const archivedSnapshot = await get(archivedTasksRef);

        if (archivedSnapshot.exists()) {
          const archivedData = archivedSnapshot.val();
          const archivedArray = Object.keys(archivedData).map(key => ({
            id: key,
            ...archivedData[key]
          }));
          setArchivedTasks(archivedArray);
        } else {
          setArchivedTasks([]);
        }
      } catch (error) {
        console.error('Error fetching archived tasks:', error);
        setError('Failed to load archived tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedTasks();
  }, []);

  if (loading) {
    return <p>Loading archived tasks...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div className="archived-tasks-container">
      <h1>Archived Tasks</h1>
      {archivedTasks.length > 0 ? (
        <div className="archived-tasks-list">
          {archivedTasks.map(task => (
            <div key={task.id} className="archived-task-card">
              {task.fileUrl && (
                <a href={task.fileUrl} target="_blank" rel="noopener noreferrer">
                  <img src={task.fileUrl} alt="Task File" />
                </a>
              )}
              <p><strong>Task Message:</strong> {task.message}</p>
              <p><strong>Assigned to:</strong> {task.assignedEmail}</p>
              <p><strong>Created by:</strong> {task.createdBy}</p>
              <p><strong>Date:</strong> {new Date(task.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No archived tasks available.</p>
      )}
    </div>
  );
};

export default ArchivedTasksPage;
