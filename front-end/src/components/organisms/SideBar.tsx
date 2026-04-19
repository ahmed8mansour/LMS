"use client";
import React, { useState, useEffect } from 'react';
import {
  Home,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { RiGraduationCapFill } from 'react-icons/ri';
import Link from 'next/link';
import LogoWithText from '../molecules/LogoWithText';
interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface SidebarProps {
  className?: string;
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", name: "Dashboard", icon: Home, href: "/dashboard" },
  { id: "my-courses", name: "My Courses", icon: BookOpen, href: "/dashboard/my-courses" },
  { id: "reviews", name: "Reviews & Ratings", icon: GraduationCap, href: "/dashboard/reviews" },
  { id: "settings", name: "Settings", icon: Settings, href: "/dashboard/settings" },
];

export function Sidebar({ className = "" }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("dashboard");

  // Auto-open sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-6 left-6 z-50 p-3 rounded-lg bg-white shadow-md border border-graytext/20 md:hidden hover:bg-lightbg transition-all duration-200"
        aria-label="Toggle sidebar"
      >
        {isOpen ?
          <X className="h-5 w-5 text-graytext2" /> :
          <Menu className="h-5 w-5 text-graytext2" />
        }
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-graytext/20 z-40 transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-28" : "w-80"}
          md:translate-x-0 md:sticky md:top-0 md:z-auto h-screen
          ${className}
        `}
      >
        {/* Header with logo and collapse button */}
        <div className="flex items-center justify-between p-5 border-b border-graytext/20 bg-lightbg/60">
          {!isCollapsed && (
            <LogoWithText/>
          )}

          {isCollapsed && (
            <div className={`bg-darkmint w-8 h-8 flex items-center justify-center rounded-[8px] `}>
                <RiGraduationCapFill className={"text-white"} size={22} />
            </div>
          )}

          {/* Desktop collapse button */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1.5 rounded-md hover:bg-lightbg transition-all duration-200"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-graytext2" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-graytext2" />
            )}
          </button>
        </div>



        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <Link href={item.href} key={item.id}>
                  <li>
                    <button
                      onClick={() => handleItemClick(item.id)}
                      className={`
                        w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-left transition-all duration-200 group text-2xl
                        ${isActive
                          ? "bg-darkmint/10 text-darkmint"
                          : "text-graytext2 hover:bg-lightbg hover:text-darktext"
                        }
                        ${isCollapsed ? "justify-center px-2" : ""}
                      `}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <div className="flex items-center justify-center min-w-[24px]">
                        <Icon
                          className={`
                            h-4.5 w-4.5 flex-shrink-0
                            ${isActive
                              ? "text-darkmint"
                              : "text-graytext2 group-hover:text-darktext"
                            }
                          `}
                        />
                      </div>

                      {!isCollapsed && (
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-base ${isActive ? "font-medium" : "font-normal"}`}>{item.name}</span>
                        </div>
                      )}

                      {/* Tooltip for collapsed state */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-darktext text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                          {item.name}
                          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-darktext rotate-45" />
                        </div>
                      )}
                    </button>
                  </li>
                </Link>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section with profile and logout */}
        <div className="mt-auto border-t border-graytext/20">
          {/* Profile Section */}
          <div className={` bg-lightbg/30 ${isCollapsed ? 'py-3 px-2' : 'p-3'}`}>
            {!isCollapsed ? (
              <div className="flex items-center px-3 py-2 rounded-md bg-white hover:bg-lightbg transition-colors duration-200">
                <div className="w-8 h-8 bg-graytext/20 rounded-full flex items-center justify-center">
                  <span className="text-graytext2 font-medium text-sm">JD</span>
                </div>
                <div className="flex-1 min-w-0 ml-2.5">
                  <p className="text-sm font-semibold font-medium text-darktext truncate">John Doe</p>
                  <p className="text-xs text-graytext2 truncate">Premium Student</p>
                </div>
                <div className="w-2 h-2 bg-darkmint rounded-full ml-2" title="Online" />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-9 h-9 bg-graytext/20 rounded-full flex items-center justify-center">
                    <span className="text-graytext2 font-medium text-sm">JD</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-darkmint rounded-full border-2 border-white" />
                </div>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="p-3 pt-0">
            <button
              onClick={() => handleItemClick("logout")}
              className={`
                w-full flex items-center rounded-md text-left transition-all duration-200 group
                text-red-500 hover:bg-red-50 hover:text-red-600
                ${isCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2.5"}
              `}
              title={isCollapsed ? "Logout" : undefined}
            >
              <div className="flex items-center justify-center min-w-[24px]">
                <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
              </div>

              {!isCollapsed && (
                <span className="text-sm">Logout</span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-darktext text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Logout
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-darktext rotate-45" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {/* <div
        className={`
          transition-all duration-300 ease-in-out w-full
          ${isCollapsed ? "md:ml-20" : "md:ml-72"}
        `}
      > */}
        {/* Your content remains the same */}
        
      {/* </div> */}
    </>
  );
}