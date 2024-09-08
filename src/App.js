import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import WelcomePage from "./pages/WelcomePage";
import AdminPage from "./pages/AdminPage";
import CoursePage from "./pages/CoursePage";
import CourseDetailPage from "./pages/CourseDetailPage";
import SubCourseDetailPage from "./pages/SubCourseDetailPage";
import UserProgressPage from "./pages/UserProgressPage";
import CourseManagementPage from "./pages/CourseManagementPage";
import AddTaskPage from "./pages/AddTaskPage";
import NotFoundPage from "./pages/NotFoundPage";
import ArchivedTasksPage from "./pages/ArchivedTasksPage";  // استيراد صفحة الأرشيف
import { useAuth } from "./context/AuthContext";
import "./App.css";

const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSidebarToggle = () => {
    setIsSidebarOpen((prevState) => !prevState);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  React.useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  return (
    <div className="app-container">
      <Navbar onSidebarToggle={handleSidebarToggle} />
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <main className="main-content" onClick={closeSidebar}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/courses" element={<CoursePage />} />
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          <Route path="/sub-courses/:subCourseId" element={<SubCourseDetailPage />} />
          <Route path="/user-progress" element={<UserProgressPage />} />
          <Route path="/add-task" element={<AddTaskPage />} />
          <Route path="/archived-tasks" element={<ArchivedTasksPage />} /> {/* إضافة مسار الأرشيف */}
          {(isAdmin || isSuperAdmin) && (
            <>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/course-management" element={<CourseManagementPage />} />
            </>
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
