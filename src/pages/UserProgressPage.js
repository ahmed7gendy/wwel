import React, { useEffect, useState, useCallback } from "react";
import { getDatabase, ref, get } from "firebase/database";
import * as XLSX from "xlsx";
import "./UserProgressPage.css";

function UserProgressPage() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const database = getDatabase();

  const getCourseNameById = useCallback(
    (id) => {
      const findName = (course, id) => {
        if (course.id === id) return course.name;
        for (const subCourseId in course.subCourses || {}) {
          const subCourse = course.subCourses[subCourseId];
          const name = findName(subCourse, id);
          if (name) return name;
        }
        return null;
      };
      const name = courses.flatMap(course => findName(course, id)).find(Boolean);
      return name || "Unknown Course";
    },
    [courses]
  );

  const fetchCourses = useCallback(async () => {
    try {
      const coursesRef = ref(database, "courses");
      const snapshot = await get(coursesRef);
      if (!snapshot.exists()) {
        throw new Error("No data found at the path 'courses'");
      }
      const data = snapshot.val();
      if (data) {
        const coursesList = Object.entries(data.mainCourses || {}).map(
          ([id, course]) => ({
            id,
            name: course.name,
            subCourses: course.subCourses || {},
          })
        );
        setCourses(coursesList);
      }
    } catch (error) {
      console.error("Error fetching courses:", error.message);
      setError(`Failed to fetch courses. Error: ${error.message}`);
    }
  }, [database]);

  const fetchUsers = useCallback(async () => {
    try {
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);
      if (!snapshot.exists()) {
        throw new Error("No data found at the path 'users'");
      }
      const usersData = snapshot.val();
      if (usersData) {
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
              progress: Object.entries(progressData).map(
                ([courseId, results]) => ({
                  courseId,
                  score: Object.values(results)[0] || "N/A",
                  courseName: getCourseNameById(courseId),
                })
              ),
            };
          })
        );
        setUsers(usersList);
        setFilteredData(usersList);
      }
    } catch (error) {
      console.error("Error fetching users:", error.message);
      setError(`Failed to fetch users. Error: ${error.message}`);
    }
  }, [database, getCourseNameById]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const submissionsRef = ref(database, "submissions");
      const snapshot = await get(submissionsRef);
      if (!snapshot.exists()) {
        throw new Error("No data found at the path 'submissions'");
      }
      const data = snapshot.val();
      console.log("Fetched submissions data:", data); // Add this line for debugging
      setSubmissions(data || {});
    } catch (error) {
      console.error("Error fetching submissions:", error.message);
      setError(`Failed to fetch submissions. Error: ${error.message}`);
    }
  }, [database]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([fetchCourses(), fetchUsers(), fetchSubmissions()]);
      } catch (error) {
        setError("Failed to fetch data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fetchCourses, fetchUsers, fetchSubmissions]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = users.filter((user) => {
      const userName = user.name.toLowerCase();
      const userEmail = user.email.toLowerCase();
      const userRole = user.role.toLowerCase();
      const userProgress = user.progress.some((progress) => {
        const courseName = progress.courseName.toLowerCase();
        const score = progress.score.toString().toLowerCase();
        return (
          courseName.includes(query) ||
          score.includes(query)
        );
      });

      return (
        userName.includes(query) ||
        userEmail.includes(query) ||
        userRole.includes(query) ||
        userProgress
      );
    });

    setFilteredData(filtered);
  }, [searchQuery, users]);

  const exportToExcel = () => {
    const data = filteredData.flatMap((user) =>
      user.progress.map((progress) => {
        const submission = Object.values(submissions).find(
          (sub) =>
            sub.userEmail === user.email && sub.courseId === progress.courseId
        ) || {};
        return {
          Email: user.email,
          Name: user.name,
          Role: user.role,
          Course: progress.courseName,
          Score: progress.score,
          SubmissionDate: submission.dateSubmitted || "N/A",
          TimeSpent: submission.timeSpent || "N/A",
          Answers: (submission.answers || []).join(", ") || "N/A",
        };
      })
    );

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "User Progress");

    XLSX.writeFile(wb, "UserProgressReport.xlsx");
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  return (
    <div className="user-progress-page">
      <h1>User Progress Report</h1>
      {error && <p className="error-message">{error}</p>}
      {loading && <p className="loading-message">Loading...</p>}
      {!loading && (
        <>
          <input
            type="text"
            placeholder="Search..."
            onChange={handleSearch}
            value={searchQuery}
            className="search-input"
          />
          {filteredData.length > 0 ? (
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Course</th>
                    <th>Score</th>
                    <th>Submission Date</th>
                    <th>Time Spent</th>
                    <th>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.flatMap((user) =>
                    user.progress.map((progress) => {
                      const submission = Object.values(submissions).find(
                        (sub) =>
                          sub.userEmail === user.email && sub.courseId === progress.courseId
                      ) || {};
                      return (
                        <tr key={`${user.email}-${progress.courseId}`}>
                          <td>{user.email}</td>
                          <td>{user.name}</td>
                          <td>{user.role}</td>
                          <td>{progress.courseName}</td>
                          <td>{progress.score}</td>
                          <td>{submission.dateSubmitted || "N/A"}</td>
                          <td>{submission.timeSpent || "N/A"}</td>
                          <td>{(submission.answers || []).join(", ") || "N/A"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <button onClick={exportToExcel}>Export to Excel</button>
            </div>
          ) : (
            <div>No progress data available.</div>
          )}
        </>
      )}
    </div>
  );
}

export default UserProgressPage;
