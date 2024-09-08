// src/pages/AddTaskPage.js
import React, { useState } from 'react';
import { ref, set, push } from 'firebase/database';
import { db, storage } from '../firebase'; // تأكد من صحة المسار
import { getAuth } from 'firebase/auth';
import { uploadBytes, ref as storageRef, getDownloadURL } from 'firebase/storage';
import './AddTaskPage.css'; // تأكد من صحة المسار

const AddTaskPage = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [assignedEmail, setAssignedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setError('User is not authenticated.');
      setLoading(false);
      return;
    }

    try {
      let fileUrl = '';

      if (file) {
        const fileRef = storageRef(storage, `tasks/${file.name}`);
        await uploadBytes(fileRef, file);
        fileUrl = await getDownloadURL(fileRef);
      }

      const taskRef = ref(db, 'tasks');
      const newTaskRef = push(taskRef);

      await set(newTaskRef, {
        message,
        fileUrl,
        assignedEmail,
        createdBy: user.email,
        createdAt: new Date().toISOString(),
      });

      setSuccess('Task added successfully!');
      setFile(null);
      setMessage('');
      setAssignedEmail('');
    } catch (error) {
      setError('Error adding task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-task-container">
      <h1>Add New Task</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="file">Upload File:</label>
          <input type="file" id="file" onChange={handleFileChange} />
        </div>
        <div>
          <label htmlFor="message">Message:</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          ></textarea>
        </div>
        <div>
          <label htmlFor="assignedEmail">Assign To (Email):</label>
          <input
            type="email"
            id="assignedEmail"
            value={assignedEmail}
            onChange={(e) => setAssignedEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Adding...' : 'Add Task'}
        </button>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </form>
    </div>
  );
};

export default AddTaskPage;
