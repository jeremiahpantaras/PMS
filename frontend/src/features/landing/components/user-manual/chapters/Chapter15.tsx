import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter15: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to navigate the operational center of Malasakit to monitor appointments, track practitioner schedules, and review daily clinic activity.
      </p>

      {/* IMPORTANT CONCEPT — Calendar Navigation */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Calendar Navigation</h3>
        
        <p className="text-gray-700 font-body mb-4">
          The Calendar is the operational heart of Malasakit. Before learning how to create and manage appointments, you must first understand the different ways you can view your clinic's schedule. Each view is designed for a specific workflow, allowing you to seamlessly switch between high-level monthly planning and detailed daily management.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Available Views</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Calendar Base</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Day View</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Week View</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Month View</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Diary View</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 15.1: Calendar Navigation. Caption: 'Each Calendar view provides a different perspective for managing clinic operations.'" />
      </div>


      {/* SECTION 15.1 — Day View */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        15.1 Day View
      </h3>
      <p className="text-gray-700 font-body mb-6">Manage today's appointments in real time.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Day View focuses entirely on a single calendar day. It displays a detailed timeline where appointments are rendered as distinct blocks against each practitioner's schedule. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The visible working period in this view is dictated entirely by Practitioner Duty Hours. This allows Front Desk staff to instantly identify available time slots, spot fully booked periods, and manage the current day's workload efficiently.
          </p>

          <ScreenshotPlaceholder label="Screenshot 15.1: Calendar — Day View. Highlight Time slots, Practitioner column, Appointments, Duty Hours. Caption: 'Day View displays appointments across the practitioner's working schedule for a single day.'" />
          <ScreenshotPlaceholder label="Screenshot 15.2: Practitioner Duty Hours within Day View. Highlight Working hours. Caption: 'Duty Hours define the practitioner's available schedule and influence occupancy calculations.'" />
        </div>
      </div>

      <DocCallout type="info">
        Day View is ideal for Front Desk staff managing today's appointments and monitoring practitioner availability in real time.
      </DocCallout>


      {/* SECTION 15.2 — Week View */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        15.2 Week View
      </h3>
      <p className="text-gray-700 font-body mb-6">Balance clinic schedules across seven days.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Week View expands the timeline to display appointments across seven consecutive days. This provides Managers and Owners with a broader overview to monitor practitioner workload over the short term.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            By analyzing the entire week at a glance, clinic staff can easily identify scheduling gaps, prepare for upcoming busy periods, and actively balance patient flow across the clinic's operating days.
          </p>

          <ScreenshotPlaceholder label="Screenshot 15.3: Calendar — Week View. Highlight Seven-day layout, Appointments, Occupancy. Caption: 'Week View provides a complete overview of the clinic schedule across an entire week.'" />
          <ScreenshotPlaceholder label="Screenshot 15.4: Week View Occupancy. Highlight Daily occupancy statistics. Caption: 'Occupancy indicators help staff quickly identify busy and available clinic days.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 15.2: Week Planning. Caption: 'Week View supports short-term planning and workload balancing.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Use Week View to identify large scheduling gaps before accepting new appointments, ensuring your practitioners maintain a balanced workload.
      </DocCallout>


      {/* SECTION 15.3 — Month View */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        15.3 Month View
      </h3>
      <p className="text-gray-700 font-body mb-6">Long-term scheduling and density forecasting.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Month View summarizes appointment density across the entire month. Rather than showing individual time slots, this view uses indicators to represent appointment volume per day.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            It is designed for long-term scheduling, allowing users to quickly navigate between months, identify historically busy periods, and plan future clinic capacity. Selecting any specific day within the Month View will immediately zoom into the detailed Day View for that date.
          </p>

          <ScreenshotPlaceholder label="Screenshot 15.5: Calendar — Month View. Highlight Monthly calendar. Caption: 'Month View provides a high-level overview of clinic activity throughout the month.'" />
          <ScreenshotPlaceholder label="Screenshot 15.6: Selected Day in Month View. Highlight Daily appointments. Caption: 'Selecting a day allows users to inspect scheduled appointments in greater detail.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 15.3: Monthly Calendar. Caption: 'Month View supports long-term planning and clinic forecasting.'" />
          </div>
        </div>
      </div>


      {/* SECTION 15.4 — Diary View */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        15.4 Diary View
      </h3>
      <p className="text-gray-700 font-body mb-6">A chronological agenda of the day's activities.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Diary View abandons the traditional calendar grid entirely. Instead, it presents appointments as a straightforward, chronological list. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            This daily agenda format is highly useful for Practitioners and Front Desk staff who prefer to review their upcoming tasks sequentially. It removes visual empty space, allowing users to rapidly scan through patient names, practitioners, and appointment times without navigating a complex layout.
          </p>

          <ScreenshotPlaceholder label="Screenshot 15.7: Diary View. Highlight Appointment list. Caption: 'Diary View organizes appointments into a chronological agenda for quick review.'" />
          <ScreenshotPlaceholder label="Screenshot 15.8: Diary Appointment Entry. Highlight Appointment information. Caption: 'Each appointment displays key patient, practitioner, and scheduling information.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 15.4: Diary Workflow. Caption: 'Diary View emphasizes chronological workflow rather than calendar positioning.'" />
          </div>
        </div>
      </div>


      {/* SECTION 15.5 — Occupancy */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        15.5 Occupancy Statistics
      </h3>
      <p className="text-gray-700 font-body mb-6">Monitor practitioner utilization accurately.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            At the top of the calendar, Malasakit displays real-time Occupancy indicators. These statistics measure practitioner utilization based strictly on their assigned Duty Hours, not simply by counting the number of appointments.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Occupancy Example</h5>
              <p className="text-sm text-gray-700 mb-2">
                If a practitioner's Duty Hours run from 8:00 AM to 5:00 PM, and appointments are scheduled to fill that entire block, their Occupancy is 100%. 
              </p>
            </div>
            <div className="p-5 rounded-xl border border-sky-100 bg-sky-50">
              <h5 className="font-bold text-sky-900 mb-2 border-b border-sky-200 pb-2">Additional Stats</h5>
              <ul className="text-sm text-gray-700 space-y-1">
                <li><strong>Number of Clients:</strong> Total patients seen.</li>
                <li><strong>Number of New Clients:</strong> First-time visitors.</li>
              </ul>
            </div>
          </div>

          <ScreenshotPlaceholder label="Screenshot 15.9: Occupancy Statistics. Highlight Occupancy %, Number of Clients, Number of New Clients. Caption: 'Occupancy statistics summarize practitioner utilization and daily patient activity.'" />
          <ScreenshotPlaceholder label="Screenshot 15.10: Fully Booked Day. Highlight 100% occupancy. Caption: 'A fully booked schedule reaches 100% occupancy based on practitioner duty hours.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 15.5: Occupancy Calculation. Caption: 'Occupancy is calculated from practitioner duty hours and scheduled appointments.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Occupancy is based on practitioner working hours, not simply the volume of appointments. A shorter working schedule may reach 100% occupancy with far fewer appointments than a standard full-day schedule.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you explored the operational center of your clinic. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>The specific workflows designed for <strong>Day View</strong>, <strong>Week View</strong>, and <strong>Month View</strong>.</li>
        <li>How <strong>Diary View</strong> transforms the calendar into a straightforward chronological agenda.</li>
        <li>How <strong>Practitioner Duty Hours</strong> define the visible working period on the calendar.</li>
        <li>How <strong>Occupancy %</strong> is intelligently calculated by comparing booked time against available working hours.</li>
      </ul>
    </>
  );
};

export default Chapter15;
