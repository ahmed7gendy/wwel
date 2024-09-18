import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ReactComponent as Logo } from "../photos/edecs logo white.svg"; 
import { ReactComponent as HomeIcon } from "../photos/home-svgrepo-com.svg"; 
import { ReactComponent as NotificationsIcon } from "../photos/notifications-svgrepo-com (1).svg"; 
import { ReactComponent as LogoutIcon } from "../photos/logout-2-svgrepo-com.svg"; 
import NotificationPopup from "./NotificationPopup"; 
import { useAuth } from "../context/AuthContext"; 
import { ref, get } from 'firebase/database'; // استيراد وظائف Firebase
import { db } from '../firebase'; // تأكد من المسار الصحيح لملف firebase.js
import "./Navbar.css";

const Navbar = ({ onSidebarToggle }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // حالة لعدد الإشعارات غير المقروءة
  const { logout } = useAuth(); 
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const notificationsRef = ref(db, 'notifications');
        const notificationsSnapshot = await get(notificationsRef);
        if (notificationsSnapshot.exists()) {
          const notificationsData = notificationsSnapshot.val();
          const unreadNotifications = Object.values(notificationsData).filter(
            (notification) => !notification.isRead
          );
          setUnreadCount(unreadNotifications.length);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchUnreadCount();
  }, [showNotifications]); // إعادة التحقق عند فتح التنبيهات

  const handleNotificationClick = () => {
    setShowNotifications((prev) => !prev);
  };

  const handleClosePopup = () => {
    setShowNotifications(false);
  };

  const handleLogout = async () => {
    try {
      await logout(); 
      navigate("/"); 
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className="navbar">
      <button className="menu-btn" onClick={onSidebarToggle}>
        ☰ 
      </button>
      <Logo className="navbar-logo" />
      <div className="navbar-buttons">
        <Link to="/welcome" className="navbar-link">
          <HomeIcon className="navbar-icon" />
        </Link>
        <button onClick={handleNotificationClick} className="notification-button">
          <NotificationsIcon className="navbar-icon" />
          {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
        </button>
        <button onClick={handleLogout} className="logout-button">
          <LogoutIcon className="navbar-icon" />
        </button>
        {showNotifications && <NotificationPopup onClose={handleClosePopup} />}
      </div>
    </nav>
  );
};

export default Navbar;
