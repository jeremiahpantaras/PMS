import os

chapters_data = [
    {"part": "PART I — Getting Started", "num": 1, "title": "Welcome to Malasakit", "topics": ["System Overview", "Purpose", "User Roles", "Navigation Overview", "Supported Platforms"]},
    {"part": "PART I — Getting Started", "num": 2, "title": "Creating Your Clinic", "topics": ["Landing Page", "Sign Up", "OTP Verification", "Password Creation", "Clinic Setup", "Dashboard"]},
    {"part": "PART I — Getting Started", "num": 3, "title": "Signing In", "topics": ["Sign In", "Forgot Password", "Session Management", "Logout"]},

    {"part": "PART II — Initial Clinic Setup", "num": 4, "title": "Clinic Setup", "topics": ["Clinic Information", "Logo", "Contact Details", "Preferences", "Saving Configuration"]},
    {"part": "PART II — Initial Clinic Setup", "num": 5, "title": "Clinic Branch Management", "topics": ["Create Branch", "Edit Branch", "Archive Branch", "Public Link", "QR Code", "Operating Hours"]},
    {"part": "PART II — Initial Clinic Setup", "num": 6, "title": "Clinic Consent Forms", "topics": ["Create Consent Form", "Assign to Branch", "Edit Consent Form", "Activate / Deactivate"]},

    {"part": "PART III — User & Staff Management", "num": 7, "title": "User Roles", "topics": ["Owner", "Manager", "Practitioner", "Front Desk", "Finance", "Branch Scope"]},
    {"part": "PART III — User & Staff Management", "num": 8, "title": "Creating Staff Accounts", "topics": ["Managers", "Practitioners", "Front Desk", "Finance", "Branch Assignment"]},
    {"part": "PART III — User & Staff Management", "num": 9, "title": "Permissions", "topics": ["Role Permissions", "Branch Restrictions", "Access Control", "Security"]},

    {"part": "PART IV — Practitioner Management", "num": 10, "title": "Practitioner Profiles", "topics": ["Create Practitioner", "Branch Assignment", "Profile", "Availability"]},
    {"part": "PART IV — Practitioner Management", "num": 11, "title": "Duty Hours", "topics": ["Weekly Schedule", "Breaks", "Occupancy", "Calendar Integration"]},

    {"part": "PART V — Patient Management", "num": 12, "title": "Patient Records", "topics": ["Patient Profiles", "Branch Visibility", "Practitioner Relationships"]},
    {"part": "PART V — Patient Management", "num": 13, "title": "Registering Patients", "topics": ["Manual Registration", "Online Registration", "Duplicate Detection"]},
    {"part": "PART V — Patient Management", "num": 14, "title": "Patient Cases", "topics": ["Timeline", "History", "Clinical Notes", "Invoices"]},

    {"part": "PART VI — Calendar & Appointments", "num": 15, "title": "Calendar Overview", "topics": ["Day View", "Week View", "Month View", "Diary", "Occupancy"]},
    {"part": "PART VI — Calendar & Appointments", "num": 16, "title": "Creating Appointments", "topics": ["Appointment Booking", "Availability", "Conflicts", "Practitioner Selection"]},
    {"part": "PART VI — Calendar & Appointments", "num": 17, "title": "Recurring Appointments", "topics": ["Weekly", "Monthly", "Editing Series", "Cancelling Series"]},
    {"part": "PART VI — Calendar & Appointments", "num": 18, "title": "Appointment Management", "topics": ["Status", "Reschedule", "Cancellation", "DNA"]},

    {"part": "PART VII — Online Booking", "num": 19, "title": "Patient Portal", "topics": ["Public Links", "Branch Links", "Practitioner Selection"]},
    {"part": "PART VII — Online Booking", "num": 20, "title": "Online Booking", "topics": ["Booking Flow", "Confirmation", "Rescheduling"]},

    {"part": "PART VIII — Clinical Documentation", "num": 21, "title": "Clinical Notes", "topics": ["Templates", "Session Linking", "Appointment Linking", "Editing"]},
    {"part": "PART VIII — Clinical Documentation", "num": 22, "title": "Clinical Note Export", "topics": ["Print", "PDF", "Email", "Attachments"]},

    {"part": "PART IX — Billing & Finance", "num": 23, "title": "Invoices", "topics": ["Generate", "View", "Payments"]},
    {"part": "PART IX — Billing & Finance", "num": 24, "title": "Bulk Invoicing", "topics": ["Batch Creation", "Review", "Generation"]},
    {"part": "PART IX — Billing & Finance", "num": 25, "title": "Payments", "topics": ["Recording Payments", "Receipts", "Outstanding Balances"]},

    {"part": "PART X — Reports & Analytics", "num": 26, "title": "Dashboard", "topics": ["KPIs", "Statistics", "Charts"]},
    {"part": "PART X — Reports & Analytics", "num": 27, "title": "Occupancy Reports", "topics": ["Filters", "Practitioner", "Branch", "Printing"]},
    {"part": "PART X — Reports & Analytics", "num": 28, "title": "Financial Reports", "topics": ["Revenue", "Payments", "Invoices"]},
    {"part": "PART X — Reports & Analytics", "num": 29, "title": "Patient Reports", "topics": ["New Patients", "Returning Patients", "Visits", "Retention"]},

    {"part": "PART XI — Notifications & Communication", "num": 30, "title": "Notifications", "topics": ["New Appointments", "New Clients", "Online Bookings", "System Notifications"]},
    {"part": "PART XI — Notifications & Communication", "num": 31, "title": "Automated Communication", "topics": ["Confirmations", "Reminders", "DNA Follow-up", "Wellness Check-ins"]},

    {"part": "PART XII — Administration", "num": 32, "title": "Subscription", "topics": ["Plans", "Limits", "Renewal"]},
    {"part": "PART XII — Administration", "num": 33, "title": "System Settings", "topics": ["General Settings", "Branch Settings", "Preferences"]},
    {"part": "PART XII — Administration", "num": 34, "title": "Security", "topics": ["Passwords", "OTP", "RBAC", "Sessions", "Audit Logs"]},

    {"part": "PART XIII — Help & Support", "num": 35, "title": "Frequently Asked Questions", "topics": ["Common user questions and solutions."]},
    {"part": "PART XIII — Help & Support", "num": 36, "title": "Troubleshooting", "topics": ["Common Errors", "Permission Issues", "Booking Issues", "Sync Issues", "Recovery Steps"]},
    {"part": "PART XIII — Help & Support", "num": 37, "title": "Contact Support", "topics": ["Technical Support", "Bug Reports", "Feature Requests", "Support Channels"]},
]

chapters_dir = "/Users/jeremiahpantaras/Downloads/PMS/frontend/src/features/landing/components/user-manual/chapters"
registry_file = "/Users/jeremiahpantaras/Downloads/PMS/frontend/src/features/landing/data/manual-registry.ts"

# 1. Generate Chapter3.tsx to Chapter37.tsx
for ch in chapters_data:
    if ch["num"] <= 2:
        continue # Skip 1 and 2 as they are already done
    
    file_path = os.path.join(chapters_dir, f"Chapter{ch['num']}.tsx")
    topics_list_items = "\n          ".join([f"<li>{t}</li>" for t in ch["topics"]])
    
    content = f"""import React from 'react';
import {{ DocCallout }} from '../DocCallout';

const Chapter{ch['num']}: React.FC = () => {{
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn about {ch['title'].lower()} in the Malasakit System.
      </p>

      <DocCallout type="info" title="Under Construction">
        This documentation chapter is currently being written. Below are the topics that will be covered in this section.
      </DocCallout>

      <div className="space-y-6">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading pt-6">Topics Covered</h3>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
          {topics_list_items}
        </ul>
      </div>
    </>
  );
}};

export default Chapter{ch['num']};
"""
    with open(file_path, "w") as f:
        f.write(content)

print(f"Generated {len(chapters_data) - 2} chapter files.")

# 2. Generate manual-registry.ts
registry_content = """import { lazy } from 'react';

export interface ManualChapterConfig {
  id: string;
  partTitle: string;
  chapterNumber: number;
  title: string;
  component: React.LazyExoticComponent<React.FC>;
  searchIndex: string;
}

export const manualRegistry: ManualChapterConfig[] = [
"""

for ch in chapters_data:
    topics_str = " ".join(ch["topics"])
    search_index = f"{ch['title']} {topics_str}".replace('"', "'")
    registry_content += f"""  {{
    id: "chapter-{ch['num']}",
    partTitle: "{ch['part']}",
    chapterNumber: {ch['num']},
    title: "{ch['title']}",
    component: lazy(() => import('../components/user-manual/chapters/Chapter{ch['num']}')),
    searchIndex: "{search_index}",
  }},
"""

registry_content += """];

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
"""

with open(registry_file, "w") as f:
    f.write(registry_content)

print("Generated manual-registry.ts.")
