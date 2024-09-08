// src/components/Navbar.js
import React from "react";
import { ReactComponent as Logo } from "../photos/edecs logo white.svg";
import "./Navbar.css";

const Navbar = ({ onSidebarToggle }) => {
  return (
    <nav className="navbar">
      <button className="menu-btn" onClick={onSidebarToggle}>
        ☰ {/* يمكنك استخدام أي أيقونة مناسبة */}
      </button>
      <Logo className="navbar-logo" />
    </nav>
  );
};

export default Navbar;
