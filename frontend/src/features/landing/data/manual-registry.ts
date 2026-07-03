import { lazy } from 'react';

export interface ManualChapterConfig {
  id: string;
  partTitle: string;
  chapterNumber: number;
  title: string;
  component: React.LazyExoticComponent<React.FC>;
  searchIndex: string;
}

export const manualRegistry: ManualChapterConfig[] = [
  {
    id: "chapter-1",
    partTitle: "PART I — Getting Started",
    chapterNumber: 1,
    title: "Welcome to Malasakit",
    component: lazy(() => import('../components/user-manual/chapters/Chapter1')),
    searchIndex: "Welcome to Malasakit System Overview Purpose User Roles Navigation Overview Supported Platforms",
  },
  {
    id: "chapter-2",
    partTitle: "PART I — Getting Started",
    chapterNumber: 2,
    title: "Creating Your Clinic",
    component: lazy(() => import('../components/user-manual/chapters/Chapter2')),
    searchIndex: "Creating Your Clinic Landing Page Sign Up OTP Verification Password Creation Clinic Setup Dashboard",
  },
  {
    id: "chapter-3",
    partTitle: "PART I — Getting Started",
    chapterNumber: 3,
    title: "Signing In",
    component: lazy(() => import('../components/user-manual/chapters/Chapter3')),
    searchIndex: "Signing In Sign In Forgot Password Session Management Logout",
  },
  {
    id: "chapter-4",
    partTitle: "PART II — Initial Clinic Setup",
    chapterNumber: 4,
    title: "Clinic Setup",
    component: lazy(() => import('../components/user-manual/chapters/Chapter4')),
    searchIndex: "Clinic Setup Clinic Information Logo Contact Details Preferences Saving Configuration",
  },
  {
    id: "chapter-5",
    partTitle: "PART II — Initial Clinic Setup",
    chapterNumber: 5,
    title: "Clinic Branch Management",
    component: lazy(() => import('../components/user-manual/chapters/Chapter5')),
    searchIndex: "Clinic Branch Management Create Branch Edit Branch Archive Branch Public Link QR Code Operating Hours",
  },
  {
    id: "chapter-6",
    partTitle: "PART II — Initial Clinic Setup",
    chapterNumber: 6,
    title: "Clinic Consent Forms",
    component: lazy(() => import('../components/user-manual/chapters/Chapter6')),
    searchIndex: "Clinic Consent Forms Create Consent Form Assign to Branch Edit Consent Form Activate / Deactivate",
  },
  {
    id: "chapter-7",
    partTitle: "PART III — User & Staff Management",
    chapterNumber: 7,
    title: "User Roles",
    component: lazy(() => import('../components/user-manual/chapters/Chapter7')),
    searchIndex: "User Roles Owner Manager Practitioner Front Desk Finance Branch Scope",
  },
  {
    id: "chapter-8",
    partTitle: "PART III — User & Staff Management",
    chapterNumber: 8,
    title: "Creating Staff Accounts",
    component: lazy(() => import('../components/user-manual/chapters/Chapter8')),
    searchIndex: "Creating Staff Accounts Managers Practitioners Front Desk Finance Branch Assignment",
  },
  {
    id: "chapter-9",
    partTitle: "PART III — User & Staff Management",
    chapterNumber: 9,
    title: "Permissions",
    component: lazy(() => import('../components/user-manual/chapters/Chapter9')),
    searchIndex: "Permissions Role Permissions Branch Restrictions Access Control Security",
  },
  {
    id: "chapter-10",
    partTitle: "PART IV — Practitioner Management",
    chapterNumber: 10,
    title: "Practitioner Profiles",
    component: lazy(() => import('../components/user-manual/chapters/Chapter10')),
    searchIndex: "Practitioner Profiles Create Practitioner Branch Assignment Profile Availability",
  },
  {
    id: "chapter-11",
    partTitle: "PART IV — Practitioner Management",
    chapterNumber: 11,
    title: "Duty Hours",
    component: lazy(() => import('../components/user-manual/chapters/Chapter11')),
    searchIndex: "Duty Hours Weekly Schedule Breaks Occupancy Calendar Integration",
  },
  {
    id: "chapter-12",
    partTitle: "PART V — Patient Management",
    chapterNumber: 12,
    title: "Patient Records",
    component: lazy(() => import('../components/user-manual/chapters/Chapter12')),
    searchIndex: "Patient Records Patient Profiles Branch Visibility Practitioner Relationships",
  },
  {
    id: "chapter-13",
    partTitle: "PART V — Patient Management",
    chapterNumber: 13,
    title: "Registering Patients",
    component: lazy(() => import('../components/user-manual/chapters/Chapter13')),
    searchIndex: "Registering Patients Manual Registration Online Registration Duplicate Detection",
  },
  {
    id: "chapter-14",
    partTitle: "PART V — Patient Management",
    chapterNumber: 14,
    title: "Patient Cases",
    component: lazy(() => import('../components/user-manual/chapters/Chapter14')),
    searchIndex: "Patient Cases Timeline History Clinical Notes Invoices",
  },
  {
    id: "chapter-15",
    partTitle: "PART VI — Calendar & Appointments",
    chapterNumber: 15,
    title: "Calendar Overview",
    component: lazy(() => import('../components/user-manual/chapters/Chapter15')),
    searchIndex: "Calendar Overview Day View Week View Month View Diary Occupancy",
  },
  {
    id: "chapter-16",
    partTitle: "PART VI — Calendar & Appointments",
    chapterNumber: 16,
    title: "Creating Appointments",
    component: lazy(() => import('../components/user-manual/chapters/Chapter16')),
    searchIndex: "Creating Appointments Appointment Booking Availability Conflicts Practitioner Selection",
  },
  {
    id: "chapter-17",
    partTitle: "PART VI — Calendar & Appointments",
    chapterNumber: 17,
    title: "Recurring Appointments",
    component: lazy(() => import('../components/user-manual/chapters/Chapter17')),
    searchIndex: "Recurring Appointments Weekly Monthly Editing Series Cancelling Series",
  },
  {
    id: "chapter-18",
    partTitle: "PART VI — Calendar & Appointments",
    chapterNumber: 18,
    title: "Appointment Management",
    component: lazy(() => import('../components/user-manual/chapters/Chapter18')),
    searchIndex: "Appointment Management Status Reschedule Cancellation DNA",
  },
  {
    id: "chapter-19",
    partTitle: "PART VII — Online Booking",
    chapterNumber: 19,
    title: "Patient Portal",
    component: lazy(() => import('../components/user-manual/chapters/Chapter19')),
    searchIndex: "Patient Portal Public Links Branch Links Practitioner Selection",
  },
  {
    id: "chapter-20",
    partTitle: "PART VII — Online Booking",
    chapterNumber: 20,
    title: "Online Booking",
    component: lazy(() => import('../components/user-manual/chapters/Chapter20')),
    searchIndex: "Online Booking Booking Flow Confirmation Rescheduling",
  },
  {
    id: "chapter-21",
    partTitle: "PART VIII — Clinical Documentation",
    chapterNumber: 21,
    title: "Clinical Notes",
    component: lazy(() => import('../components/user-manual/chapters/Chapter21')),
    searchIndex: "Clinical Notes Templates Session Linking Appointment Linking Editing",
  },
  {
    id: "chapter-22",
    partTitle: "PART VIII — Clinical Documentation",
    chapterNumber: 22,
    title: "Clinical Note Export",
    component: lazy(() => import('../components/user-manual/chapters/Chapter22')),
    searchIndex: "Clinical Note Export Print PDF Email Attachments",
  },
  {
    id: "chapter-23",
    partTitle: "PART IX — Billing & Finance",
    chapterNumber: 23,
    title: "Invoices",
    component: lazy(() => import('../components/user-manual/chapters/Chapter23')),
    searchIndex: "Invoices Generate View Payments",
  },
  {
    id: "chapter-24",
    partTitle: "PART IX — Billing & Finance",
    chapterNumber: 24,
    title: "Bulk Invoicing",
    component: lazy(() => import('../components/user-manual/chapters/Chapter24')),
    searchIndex: "Bulk Invoicing Batch Creation Review Generation",
  },
  {
    id: "chapter-25",
    partTitle: "PART IX — Billing & Finance",
    chapterNumber: 25,
    title: "Payments",
    component: lazy(() => import('../components/user-manual/chapters/Chapter25')),
    searchIndex: "Payments Recording Payments Receipts Outstanding Balances",
  },
  {
    id: "chapter-26",
    partTitle: "PART X — Reports & Analytics",
    chapterNumber: 26,
    title: "Dashboard",
    component: lazy(() => import('../components/user-manual/chapters/Chapter26')),
    searchIndex: "Dashboard KPIs Statistics Charts",
  },
  {
    id: "chapter-27",
    partTitle: "PART X — Reports & Analytics",
    chapterNumber: 27,
    title: "Occupancy Reports",
    component: lazy(() => import('../components/user-manual/chapters/Chapter27')),
    searchIndex: "Occupancy Reports Filters Practitioner Branch Printing",
  },
  {
    id: "chapter-28",
    partTitle: "PART X — Reports & Analytics",
    chapterNumber: 28,
    title: "Financial Reports",
    component: lazy(() => import('../components/user-manual/chapters/Chapter28')),
    searchIndex: "Financial Reports Revenue Payments Invoices",
  },
  {
    id: "chapter-29",
    partTitle: "PART X — Reports & Analytics",
    chapterNumber: 29,
    title: "Patient Reports",
    component: lazy(() => import('../components/user-manual/chapters/Chapter29')),
    searchIndex: "Patient Reports New Patients Returning Patients Visits Retention",
  },
  {
    id: "chapter-30",
    partTitle: "PART XI — Notifications & Communication",
    chapterNumber: 30,
    title: "Notifications",
    component: lazy(() => import('../components/user-manual/chapters/Chapter30')),
    searchIndex: "Notifications New Appointments New Clients Online Bookings System Notifications",
  },
  {
    id: "chapter-31",
    partTitle: "PART XI — Notifications & Communication",
    chapterNumber: 31,
    title: "Automated Communication",
    component: lazy(() => import('../components/user-manual/chapters/Chapter31')),
    searchIndex: "Automated Communication Confirmations Reminders DNA Follow-up Wellness Check-ins",
  },
  {
    id: "chapter-32",
    partTitle: "PART XII — Administration",
    chapterNumber: 32,
    title: "Subscription",
    component: lazy(() => import('../components/user-manual/chapters/Chapter32')),
    searchIndex: "Subscription Plans Limits Renewal",
  },
  {
    id: "chapter-33",
    partTitle: "PART XII — Administration",
    chapterNumber: 33,
    title: "System Settings",
    component: lazy(() => import('../components/user-manual/chapters/Chapter33')),
    searchIndex: "System Settings General Settings Branch Settings Preferences",
  },
  {
    id: "chapter-34",
    partTitle: "PART XII — Administration",
    chapterNumber: 34,
    title: "Security",
    component: lazy(() => import('../components/user-manual/chapters/Chapter34')),
    searchIndex: "Security Passwords OTP RBAC Sessions Audit Logs",
  },
  {
    id: "chapter-35",
    partTitle: "PART XIII — Help & Support",
    chapterNumber: 35,
    title: "Frequently Asked Questions",
    component: lazy(() => import('../components/user-manual/chapters/Chapter35')),
    searchIndex: "Frequently Asked Questions Common user questions and solutions.",
  },
  {
    id: "chapter-36",
    partTitle: "PART XIII — Help & Support",
    chapterNumber: 36,
    title: "Troubleshooting",
    component: lazy(() => import('../components/user-manual/chapters/Chapter36')),
    searchIndex: "Troubleshooting Common Errors Permission Issues Booking Issues Sync Issues Recovery Steps",
  },
  {
    id: "chapter-37",
    partTitle: "PART XIII — Help & Support",
    chapterNumber: 37,
    title: "Contact Support",
    component: lazy(() => import('../components/user-manual/chapters/Chapter37')),
    searchIndex: "Contact Support Technical Support Bug Reports Feature Requests Support Channels",
  },
];

export const getChapterConfig = (id: string) => {
  return manualRegistry.find((ch) => ch.id === id);
};

export const getAdjacentChapters = (id: string) => {
  const currentIndex = manualRegistry.findIndex((ch) => ch.id === id);
  if (currentIndex === -1) return { prev: null, next: null };
  return {
    prev: currentIndex > 0 ? manualRegistry[currentIndex - 1] : null,
    next: currentIndex < manualRegistry.length - 1 ? manualRegistry[currentIndex + 1] : null,
  };
};

export const getSidebarStructure = () => {
  const grouped = manualRegistry.reduce((acc, chapter) => {
    if (!acc[chapter.partTitle]) {
      acc[chapter.partTitle] = [];
    }
    acc[chapter.partTitle].push({
      id: chapter.id,
      title: `Chapter ${chapter.chapterNumber}: ${chapter.title}`
    });
    return acc;
  }, {} as Record<string, { id: string; title: string }[]>);

  return Object.entries(grouped).map(([partTitle, chapters]) => ({
    partTitle,
    chapters,
  }));
};
