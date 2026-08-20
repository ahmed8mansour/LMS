"use client";
import React, { useState, useEffect } from 'react';
import {
  Home,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Users,
  BarChart3,
  Star,
  DollarSign,
} from 'lucide-react';
import { RiGraduationCapFill } from 'react-icons/ri';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoWithText from '../molecules/LogoWithText';
import { DashboardAvater } from '@/featuers/auth/components/dashboard/DashboardAvater';
import { DashboardLogout } from '@/featuers/auth/components/dashboard/DashboardLogout';

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** When true the item is active only on an exact path match (used for the root). */
  exact?: boolean;
}

interface InstructorSidebarProps {
  className?: string;
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", name: "Dashboard", icon: Home, href: "/instructor", exact: true },
  { id: "courses", name: "My Courses", icon: BookOpen, href: "/instructor/courses" },
  { id: "students", name: "Students", icon: Users, href: "/instructor/students" },
  { id: "analytics", name: "Analytics", icon: BarChart3, href: "/instructor/analytics" },
  { id: "reviews", name: "Reviews", icon: Star, href: "/instructor/reviews" },
  { id: "earnings", name: "Earnings", icon: DollarSign, href: "/instructor/earnings" },
  { id: "settings", name: "Settings", icon: Settings, href: "/instructor/settings" },
];

export function InstructorSidebar({ className = "" }: InstructorSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-open sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      setIsOpen(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const handleItemClick = () => {
    if (window.innerWidth < 768) setIsOpen(false);
  };

  const isActive = (item: NavigationItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-6 left-6 z-50 p-3 rounded-lg bg-darktext shadow-md border border-graytext/30 md:hidden hover:bg-darktext/80 transition-all duration-200"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
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
          fixed top-0 left-0 h-full bg-darktext border-r border-graytext/30 z-40 transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-28" : "w-80"}
          md:translate-x-0 md:sticky md:top-0 md:z-auto h-screen
          ${className}
        `}
      >
        {/* Header with logo and collapse button */}
        <div className="flex items-center justify-between p-5 border-b border-graytext/30 bg-darktext/80">
          {!isCollapsed && <LogoWithText classNameT='text-white' />}
          {isCollapsed && (
            <div className="bg-darkmint w-8 h-8 flex items-center justify-center rounded-[8px]">
              <RiGraduationCapFill className="text-white" size={22} />
            </div>
          )}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1.5 rounded-md hover:bg-darktext/60 transition-all duration-200"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-white" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-white" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {navigationItems.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href}>
                  <li>
                    <button
                      onClick={handleItemClick}
                      className={`
                        w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-left transition-all duration-200 group text-2xl
                        ${active ? "bg-darkmint/20 text-white" : "text-graytext hover:bg-darkmint/10 hover:text-white"}
                        ${isCollapsed ? "justify-center px-2" : ""}
                      `}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <div className="flex items-center justify-center min-w-[24px]">
                        <Icon
                          className={`h-4.5 w-4.5 flex-shrink-0 ${active ? "text-white" : "text-graytext group-hover:text-white"}`}
                        />
                      </div>
                      {!isCollapsed && (
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-base ${active ? "font-medium" : "font-normal"}`}>{item.name}</span>
                        </div>
                      )}
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
        <div className="mt-auto border-t border-graytext/30">
          <DashboardAvater isCollapsed={isCollapsed} />
          <DashboardLogout isCollapsed={isCollapsed} />
        </div>
      </div>
    </>
  );
}
