import React, { useEffect, useState, useCallback } from "react";
import { getDatabase, ref, get } from "firebase/database";
import * as XLSX from "xlsx";
import "./UserProgressPage.css";

function UserProgressPage() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const database = getDatabase();

  const getCourseNameById = useCallback((id) => {
    const course = courses.find((course) => course.id === id);
    return course ? course.name : "Unknown Course";
  }, [courses]);

  const fetchCourses = useCallback(async () => {
    try {
      const coursesRef = ref(database, "courses/mainCourses");
      const snapshot = await get(coursesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const coursesList = Object.entries(data).map(([id, course]) => ({
          id,
          name: course.name,
          subCourses: course.subCourses || {},
        }));
        setCourses(coursesList);
        console.log("Courses:", coursesList);
      } else {
        throw new Error("No data found at the path 'courses'");
      }
    } catch (error) {
      setError(`Failed to fetch courses. Error: ${error.message}`);
    }
  }, [database]);

  const fetchUsers = useCallback(async () => {
    try {
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersList = await Promise.all(
          Object.entries(usersData).map(async ([sanitizedEmail, user]) => {
            const email = sanitizedEmail.replace(/,/g, ".");
            const progressRef = ref(database, `users/${sanitizedEmail}/results`);
            const progressSnapshot = await get(progressRef);
            const progressData = progressSnapshot.val() || {};
            return {
              email,
              name: user.name || "Unknown",
              role: user.role || "Unknown",
              progress: Object.entries(progressData).map(([courseId, results]) => ({
                courseId,
                score: Object.values(results)[0] || "N/A",
                courseName: getCourseNameById(courseId),
              })),
            };
          })
        );
        setUsers(usersList);
        setFilteredData(usersList);
        console.log("Users:", usersList);
      } else {
        throw new Error("No data found at the path 'users'");
      }
    } catch (error) {
      setError(`Failed to fetch users. Error: ${error.message}`);
    }
  }, [database, getCourseNameById]);

  const fetchArchivedTasks = useCallback(async () => {
    try {
      const tasksRef = ref(database, "archivedTasks");
      const snapshot = await get(tasksRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const tasksList = Object.values(data);
        setArchivedTasks(tasksList);
        console.log("Archived Tasks:", tasksList);
      } else {
        throw new Error("No data found at the path 'archivedTasks'");
      }
    } catch (error) {
      setError(`Failed to fetch archived tasks. Error: ${error.message}`);
    }
  }, [database]);

  const fetchNotifications = useCallback(async () => {
    try {
      const notificationsRef = ref(database, "notifications");
      const snapshot = await get(notificationsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const notificationsList = Object.values(data);
        setNotifications(notificationsList);
        console.log("Notifications:", notificationsList);
      } else {
        throw new Error("No data found at the path 'notifications'");
      }
    } catch (error) {
      setError(`Failed to fetch notifications. Error: ${error.message}`);
    }
  }, [database]);

  useEffect(() => {
    if (!dataLoaded) {
      const fetchData = async () => {
        try {
          await Promise.all([
            fetchCourses(),
            fetchUsers(),
            fetchArchivedTasks(),
            fetchNotifications()
          ]);
          setDataLoaded(true);
        } catch {
          setError("Failed to fetch data. Please try again later.");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      setLoading(false);
    }
  }, [fetchCourses, fetchUsers, fetchArchivedTasks, fetchNotifications, dataLoaded]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = users.filter((user) => {
      const userName = user.name.toLowerCase();
      const userEmail = user.email.toLowerCase();
      const userRole = user.role.toLowerCase();
      const userProgress = user.progress.some((progress) => {
        const courseName = progress.courseName.toLowerCase();
        const score = progress.score.toString().toLowerCase();
        return courseName.includes(query) || score.includes(query);
      });

      return userName.includes(query) || userEmail.includes(query) || userRole.includes(query) || userProgress;
    });

    setFilteredData(filtered);
    console.log("Filtered Data:", filtered);
  }, [searchQuery, users]);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      console.warn("No data to export");
      return;
    }

    const data = filteredData.flatMap((user) =>
      user.progress.length === 0 ? {
        Email: user.email,
        Name: user.name,
        Role: user.role,
        Course: "No progress data",
        Score: "No progress data",
        TaskMessage: "No progress data",
        SubmissionDate: "No progress data",
        TaskFileURL: "No progress data",
        NotificationMessage: "No notifications data",
        NotificationDate: "No notifications data",
        NotificationFileURL: "No notifications data",
      } : user.progress.map((progress) => {
        const task = archivedTasks.find(
          (task) =>
            task.assignedEmail === user.email &&
            task.message.includes(progress.courseName)
        ) || {};
        const notification = notifications.find(
          (notification) =>
            notification.assignedEmail === user.email &&
            notification.message.includes(progress.courseName)
        ) || {};
        return {
          Email: user.email,
          Name: user.name,
          Role: user.role,
          Course: progress.courseName,
          Score: progress.score,
          TaskMessage: task.message || "N/A",
          SubmissionDate: task.createdAt || "N/A",
          TaskFileURL: task.fileUrl || "N/A",
          NotificationMessage: notification.message || "N/A",
          NotificationDate: notification.createdAt || "N/A",
          NotificationFileURL: notification.fileUrl || "N/A",
        };
      })
    );

    // Remove duplicate entries from data
    const uniqueData = Array.from(new Set(data.map(JSON.stringify))).map(JSON.parse);

    const ws = XLSX.utils.json_to_sheet(uniqueData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "User Progress");

    XLSX.writeFile(wb, "UserProgressReport.xlsx");
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  return (
    <div className="user-progress-page">
      <h1>User Progress Page</h1>
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={handleSearch}
      />
      <button onClick={exportToExcel}>Export to Excel</button>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Course</th>
              <th>Score</th>
              <th>Task Message</th>
              <th>Submission Date</th>
              <th>Task File URL</th>
              <th>Notification Message</th>
              <th>Notification Date</th>
              <th>Notification File URL</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan="11">No data available</td>
              </tr>
            ) : (
              filteredData.flatMap((user) =>
                user.progress.length === 0 ? (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>{user.name}</td>
                    <td>{user.role}</td>
                    <td>No progress data</td>
                    <td>No progress data</td>
                    <td>No progress data</td>
                    <td>No progress data</td>
                    <td>No progress data</td>
                    <td>No notifications data</td>
                    <td>No notifications data</td>
                    <td>No notifications data</td>
                  </tr>
                ) : (
                  user.progress.map((progress, index) => {
                    const task = archivedTasks.find(
                      (task) =>
                        task.assignedEmail === user.email &&
                        task.message.includes(progress.courseName)
                    ) || {};
                    const notification = notifications.find(
                      (notification) =>
                        notification.assignedEmail === user.email &&
                        notification.message.includes(progress.courseName)
                    ) || {};
                    return (
                      <tr key={`${user.email}-${index}`}>
                        <td>{user.email}</td>
                        <td>{user.name}</td>
                        <td>{user.role}</td>
                        <td>{progress.courseName}</td>
                        <td>{progress.score}</td>
                        <td>{task.message || "N/A"}</td>
                        <td>{task.createdAt || "N/A"}</td>
                        <td>
                          {task.fileUrl ? (
                            <a href={task.fileUrl} target="_blank" rel="noopener noreferrer">
                              View File
                            </a>
                          ) : "N/A"}
                        </td>
                        <td>{notification.message || "N/A"}</td>
                        <td>{notification.createdAt || "N/A"}</td>
                        <td>
                          {notification.fileUrl ? (
                            <a href={notification.fileUrl} target="_blank" rel="noopener noreferrer">
                              View File
                            </a>
                          ) : "N/A"}
                        </td>
                      </tr>
                    );
                  })
                )
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default UserProgressPage;
