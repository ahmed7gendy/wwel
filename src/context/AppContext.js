import React, { createContext, useState, useEffect } from 'react';
import { get, ref } from 'firebase/database';
import { db } from '../firebase';

const sanitizeEmail = (email) => {
  return email.replace(/\./g, ",");
};

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);

  const fetchCourses = async () => {
    const coursesRef = ref(db, "courses/mainCourses");
    const coursesSnapshot = await get(coursesRef);
    if (coursesSnapshot.exists()) {
      setCourses(coursesSnapshot.val());
    }
  };

  const fetchUsers = async () => {
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    if (usersSnapshot.exists()) {
      const usersData = usersSnapshot.val();
      const sanitizedUsers = Object.keys(usersData).map((email) => {
        const sanitizedEmail = email.replace(/,/g, ".");
        return { ...usersData[email], email: sanitizedEmail };
      });
      setUsers(sanitizedUsers);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchUsers();
  }, []);

  return (
    <AppContext.Provider value={{ courses, users, fetchCourses, fetchUsers }}>
      {children}
    </AppContext.Provider>
  );
};
