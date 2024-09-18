import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, get, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import './WelcomePage.css';

const WelcomePage = () => {
  const [courses, setCourses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          throw new Error('User is not authenticated.');
        }

        const email = user.email;
        const safeEmailPath = email.replace(/\./g, ',');

        // الحصول على الأدوار الخاصة بالمستخدم
        const rolesRef = ref(db, `roles/${safeEmailPath}`);
        const rolesSnapshot = await get(rolesRef);
        if (!rolesSnapshot.exists()) {
          throw new Error('No data for roles.');
        }

        const userRoles = rolesSnapshot.val().courses || {};

        // الحصول على الدورات المتاحة
        const coursesRef = ref(db, 'courses/mainCourses');
        const coursesSnapshot = await get(coursesRef);
        if (!coursesSnapshot.exists()) {
          throw new Error('No data for courses.');
        }

        const coursesData = coursesSnapshot.val();
        const coursesArray = Object.keys(coursesData).map(key => ({ id: key, ...coursesData[key] }));

        const filteredCourses = coursesArray.filter(course => userRoles[course.id]);

        setCourses(filteredCourses);

        // الحصول على المهام
        const tasksRef = ref(db, 'tasks');
        const tasksSnapshot = await get(tasksRef);
        const tasksData = tasksSnapshot.val() || {};
        const tasksArray = Object.keys(tasksData).map(key => ({ id: key, ...tasksData[key] }));

        // تصفية المهام بناءً على البريد الإلكتروني للمستخدم أو منشئ المهمة
        const filteredTasks = tasksArray.filter(task => task.assignedEmail === email || task.createdBy === email);
        setTasks(filteredTasks);

        // الحصول على اسم المستخدم
        const userRef = ref(db, `users/${safeEmailPath}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          setUserName(userData.name || 'User');
        } else {
          setUserName('User');
        }
      } catch (error) {
        console.error('Data entry error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // دالة للحصول على المستخدم الحالي
  const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
      const auth = getAuth();
      onAuthStateChanged(auth, (user) => {
        if (user) {
          resolve(user);
        } else {
          reject(new Error('User is not authenticated.'));
        }
      });
    });
  };

  // دالة إنهاء المهمة وأرشفتها
  const endTask = async (taskId) => {
    try {
      // الحصول على مرجع المهمة
      const taskRef = ref(db, `tasks/${taskId}`);
      const taskSnapshot = await get(taskRef);
      if (!taskSnapshot.exists()) {
        throw new Error('Task does not exist.');
      }

      // الحصول على بيانات المهمة
      const taskData = taskSnapshot.val();

      // إنشاء مرجع الأرشيف للمهمة
      const archivedTaskRef = ref(db, `archivedTasks/${taskId}`);

      // نقل البيانات إلى مجلد الأرشيف
      await set(archivedTaskRef, taskData);

      // إزالة المهمة من مجلد المهام الحالي
      await remove(taskRef);

      // تحديث حالة الواجهة بإزالة المهمة المنتهية
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error ending task:', error);
      setError(error.message);
    }
  };

  return (
    <div className="container">
      <h1>Welcome, {userName}</h1>
      <h2>Courses</h2>
      {loading ? (
        <p>Loading ...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : courses.length > 0 ? (
        <div className="course-container">
          {courses.map(course => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="course-card"
            >
              {course.thumbnail ? (
                <img src={course.thumbnail} alt={course.name} />
              ) : (
                <div
                  className="default-image"
                  style={{ backgroundColor: `hsl(${Math.random() * 360}, 70%, 80%)` }}
                >
                  <p>No Available Courses</p>
                </div>
              )}
              <h3>{course.name}</h3>
            </Link>
          ))}
        </div>
      ) : (
        <p>No Available Courses</p>
      )}

      <h2>Tasks</h2>
      {loading ? (
        <p>Loading tasks...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : tasks.length > 0 ? (
        <div className="task-container">
          {tasks.map(task => (
            <div key={task.id} className="task-card">
              {task.fileUrl && (
                <a href={task.fileUrl} target="_blank" rel="noopener noreferrer">
                  <img src={task.fileUrl} alt="Task File" />
                </a>
              )}
              <p>{task.message}</p>
              <p>Assigned to: {task.assignedEmail}</p>
              <p>Created by: {task.createdBy}</p>
              <p>Date: {new Date(task.createdAt).toLocaleString()}</p>
              <button onClick={() => endTask(task.id)}>End Task</button>
            </div>
          ))}
        </div>
      ) : (
        <p>No Tasks Available</p>
      )}
    </div>
  );
};

export default WelcomePage;
