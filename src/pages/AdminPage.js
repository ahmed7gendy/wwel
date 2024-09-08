import React, { useState, useEffect, useCallback } from "react";
import { db, ref, set, get, remove } from "../firebase";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./AdminPage.css";

function AdminPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState({});
  const [courses, setCourses] = useState({});
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("Administrator");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const auth = getAuth();
  const navigate = useNavigate();

  const fetchCurrentUserRole = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const sanitizedEmail = user.email.replace(/\./g, ",");
        const roleRef = ref(db, `roles/${sanitizedEmail}`);
        const roleSnapshot = await get(roleRef);
        if (roleSnapshot.exists()) {
          // Removed unused setCurrentUserRole
        }
      }
    } catch (error) {
      console.error("Error fetching current user role:", error);
    }
  }, [auth]);

  const fetchData = useCallback(async () => {
    try {
      const rolesRef = ref(db, "roles");
      const rolesSnapshot = await get(rolesRef);
      const rolesData = rolesSnapshot.exists() ? rolesSnapshot.val() : {};

      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      const usersData = usersSnapshot.exists()
        ? Object.entries(usersSnapshot.val()).reduce((acc, [email, user]) => {
            const formattedEmail = email.replace(/,/g, ".");
            acc[formattedEmail] = { ...user, email: formattedEmail };
            return acc;
          }, {})
        : {};

      setRoles(rolesData);
      setUsers(Object.values(usersData));
      setCourses((await get(ref(db, "courses/mainCourses"))).val() || {});
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUserRole();
    fetchData();
  }, [fetchCurrentUserRole, fetchData]);

  const handleAddUser = async () => {
    if (newUserEmail && newUserPassword && newUserName) {
      try {
        await createUserWithEmailAndPassword(auth, newUserEmail, newUserPassword);

        const sanitizedEmail = newUserEmail.replace(/\./g, ",");
        const rolesRef = ref(db, `roles/${sanitizedEmail}`);
        const usersRef = ref(db, `users/${sanitizedEmail}`);

        await set(rolesRef, { role: newUserRole, courses: {} });
        await set(usersRef, {
          email: newUserEmail,
          name: newUserName,
          role: newUserRole,
        });

        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserName("");
        setNewUserRole("Administrator");

        await fetchData();
        setIsPopupOpen(false);
      } catch (error) {
        console.error("Error adding user:", error);
      }
    }
  };

  const handleRoleChange = async (userEmail, newRole) => {
    try {
      const sanitizedEmail = userEmail.replace(/\./g, ",");
      const roleRef = ref(db, `roles/${sanitizedEmail}`);

      await set(roleRef, {
        role: newRole,
        courses: roles[sanitizedEmail]?.courses || {},
      });
      await fetchData();
    } catch (error) {
      console.error("Error changing user role:", error);
    }
  };

  const handleUpdateCourseAccess = async (
    userEmail,
    courseId,
    subCourseName,
    hasAccess
  ) => {
    try {
      const sanitizedEmail = userEmail.replace(/\./g, ",");
      const userCoursesRef = ref(db, `roles/${sanitizedEmail}/courses`);

      const userCoursesSnapshot = await get(userCoursesRef);
      const userCourses = userCoursesSnapshot.exists() ? userCoursesSnapshot.val() : {};

      if (!userCourses[courseId]) {
        userCourses[courseId] = {};
      }

      if (subCourseName) {
        userCourses[courseId][subCourseName] = { hasAccess };
      } else {
        userCourses[courseId] = { hasAccess };
      }

      await set(userCoursesRef, userCourses);
      await fetchData();
    } catch (error) {
      console.error("Error updating course access:", error);
    }
  };

  const handleToggleAccess = (userEmail, courseId, subCourseName) => {
    if (!selectedUser) return;

    const sanitizedEmail = selectedUser.email.replace(/\./g, ",");
    const currentCourseAccess =
      roles[sanitizedEmail]?.courses?.[courseId] || {};
    const hasAccess = subCourseName
      ? !!currentCourseAccess[subCourseName]?.hasAccess
      : !!currentCourseAccess.hasAccess;

    handleUpdateCourseAccess(userEmail, courseId, subCourseName, !hasAccess);
  };

  const handleDisableUser = async (userEmail) => {
    try {
      const sanitizedEmail = userEmail.replace(/\./g, ",");
      const roleRef = ref(db, `roles/${sanitizedEmail}`);
      await set(roleRef, {
        role: "Disabled",
        courses: roles[sanitizedEmail]?.courses || {},
      });
      await fetchData();
    } catch (error) {
      console.error("Error disabling user:", error);
    }
  };

  const handleRemoveUser = async (userEmail) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user found");

      const sanitizedEmail = userEmail.replace(/\./g, ",");
      const userRef = ref(db, `users/${sanitizedEmail}`);
      const roleRef = ref(db, `roles/${sanitizedEmail}`);

      // Remove user from Firebase Authentication
      const userToDelete = await getAuth().getUserByEmail(userEmail);
      await deleteUser(userToDelete);

      // Remove user data from the database
      await remove(userRef);
      await remove(roleRef);

      await fetchData();
      setSelectedUser(null);
    } catch (error) {
      console.error("Error removing user:", error);
    }
  };

  const navigateToCourseManagementPage = () => {
    navigate("/course-management");
  };

  const handleRefreshData = async () => {
    await fetchData();
  };

  const getSubCourseName = (courseId, subCourseId) => {
    return courses[courseId]?.subCourses?.[subCourseId]?.name || "Unknown SubCourse";
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <button
          className="open-popup-btn"
          onClick={() => setIsPopupOpen(true)}
        >
          Create User
        </button>
        <button
          className="navigate-to-course-management-btn"
          onClick={navigateToCourseManagementPage}
        >
          Manage Courses
        </button>
        <button
          className="refresh-data-btn"
          onClick={handleRefreshData}
        >
          Refresh Data
        </button>
      </header>

      <div className="main-content">
        <div className="user-list">
          {users.map((user) => (
            <div
              key={user.email}
              className="user-item"
              onClick={() => setSelectedUser(user)}
            >
              {user.name}
            </div>
          ))}
        </div>

        <div className="user-details">
          {selectedUser && (
            <>
              <h2>User Details</h2>
              <p>
                <strong>Email:</strong> {selectedUser.email}
              </p>
              <p>
                <strong>Name:</strong> {selectedUser.name}
              </p>
              <p>
                <strong>Role:</strong>{" "}
                <select
                  value={roles[selectedUser.email.replace(/\./g, ",")]?.role || ""}
                  onChange={(e) => handleRoleChange(selectedUser.email, e.target.value)}
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="User">User</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </p>
              <p>
                <strong>Access to Courses:</strong>
                {Object.keys(courses).map((courseId) => (
                  <div key={courseId}>
                    <h4>{courses[courseId]?.name || "Unknown Course"}</h4>
                    {Object.keys(courses[courseId]?.subCourses || {}).map((subCourseId) => (
                      <div key={subCourseId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              roles[selectedUser.email.replace(/\./g, ",")]?.courses?.[courseId]?.[subCourseId]
                                ?.hasAccess || false
                            }
                            onChange={() =>
                              handleToggleAccess(
                                selectedUser.email,
                                courseId,
                                subCourseId
                              )
                            }
                          />
                          {getSubCourseName(courseId, subCourseId)}
                        </label>
                      </div>
                    ))}
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          roles[selectedUser.email.replace(/\./g, ",")]?.courses?.[courseId]?.hasAccess || false
                        }
                        onChange={() =>
                          handleToggleAccess(selectedUser.email, courseId)
                        }
                      />
                      {courses[courseId]?.name || "Unknown Course"}
                    </label>
                  </div>
                ))}
              </p>
              <button onClick={() => handleDisableUser(selectedUser.email)}>Disable User</button>
              <button onClick={() => handleRemoveUser(selectedUser.email)}>Remove User</button>
            </>
          )}
        </div>
      </div>

      {isPopupOpen && (
        <div className="popup">
          <h2>Create User</h2>
          <label>
            Email:
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
            />
          </label>
          <label>
            Name:
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
            />
          </label>
          <label>
            Password:
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
            />
          </label>
          <label>
            Role:
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
            >
              <option value="Administrator">Administrator</option>
              <option value="Super Admin">Super Admin</option>
              <option value="User">User</option>
            </select>
          </label>
          <button onClick={handleAddUser}>Add User</button>
          <button onClick={() => setIsPopupOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
