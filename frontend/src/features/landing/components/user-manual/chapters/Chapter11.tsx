import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter11: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to configure working schedules, break periods, and understand how duty hours directly drive calendar availability and occupancy reporting.
      </p>

      {/* IMPORTANT CONCEPT — Duty Hours Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Duty Hours Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Duty hours define precisely when practitioners are available to accept appointments. A properly configured schedule ensures that online booking slots are accurate, calendars reliably prevent double-bookings, and daily occupancy statistics reflect true practitioner utilization.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Schedule Generation Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Weekly Schedule</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Working Hours</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Break Times</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200 font-bold">Availability Generated</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Occupancy & Calendar</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 11.1: Duty Hours Workflow. Caption: 'Duty Hours determine every appointment slot available within the practitioner's calendar.'" />
      </div>


      {/* SECTION 11.1 — Weekly Schedule */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        11.1 Weekly Schedule
      </h3>
      <p className="text-gray-700 font-body mb-6">Select which days the practitioner provides services.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The first step in configuring availability is selecting the practitioner's active working days. Administrators can toggle specific days of the week (e.g., Monday through Friday) to define the baseline schedule. Days that are left unselected are treated as non-working days and will absolutely not generate any appointment availability.
          </p>

          <ScreenshotPlaceholder label="Screenshot 11.1: Weekly Schedule configuration. Highlight Working days and Enabled days. Caption: 'Select the days the practitioner is available for appointments.'" />
          <ScreenshotPlaceholder label="Screenshot 11.2: Weekly schedule after configuration. Highlight Configured working days. Caption: 'Only selected working days will allow appointment bookings.'" />
        </div>
      </div>

      <DocCallout type="info">
        Days marked as unavailable cannot receive appointments through manual scheduling or the public online booking portal.
      </DocCallout>


      {/* SECTION 11.2 — Working Hours & Breaks */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        11.2 Working Hours & Breaks
      </h3>
      <p className="text-gray-700 font-body mb-6">Define daily availability and rest periods.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once the working days are set, administrators must configure the daily <strong>Start Time</strong> and <strong>End Time</strong>, as well as designated <strong>Break Periods</strong> (such as a Lunch Break).
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            These break periods effectively slice the practitioner's working day into distinct "working intervals." For example, if a practitioner works from 8:00 AM to 5:00 PM with a lunch break from 12:00 PM to 1:00 PM, the system will only generate bookable appointment slots between 8:00 AM–12:00 PM and 1:00 PM–5:00 PM.
          </p>

          <ScreenshotPlaceholder label="Screenshot 11.3: Working Hours configuration. Highlight Start Time and End Time. Caption: 'Configure the practitioner's daily working hours.'" />
          <ScreenshotPlaceholder label="Screenshot 11.4: Break configuration. Highlight Break Start and Break End. Caption: 'Appointments are automatically blocked during configured break periods.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 11.2: Daily Schedule Timeline. Caption: 'Break periods divide the practitioner's working schedule into available appointment blocks.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Appointments absolutely cannot be scheduled outside of working hours or during configured break periods.
      </DocCallout>


      {/* SECTION 11.3 — Occupancy */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        11.3 Occupancy Calculations
      </h3>
      <p className="text-gray-700 font-body mb-6">Track practitioner utilization and clinic volume.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Malasakit actively uses the practitioner's configured duty hours to calculate their daily <strong>Occupancy Percentage</strong>. This metric represents how much of their available schedule has been booked by patients.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            For example, if a practitioner has 8 available hours generated from their duty schedule, and 4 hours worth of appointments are booked, their Occupancy is calculated at 50%. A fully booked working day will display 100% Occupancy. The Calendar interface displays these statistics in real-time, including:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Occupancy %:</strong> Percentage of available time booked.</li>
            <li><strong>Number of Clients:</strong> Total unique patients seen.</li>
            <li><strong>Number of New Clients:</strong> First-time clinic visitors.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 11.5: Calendar Occupancy Statistics. Highlight Occupancy %, Clients, New Clients. Caption: 'Occupancy is calculated using the practitioner's configured duty hours.'" />
          <ScreenshotPlaceholder label="Diagram 11.3: Occupancy Calculation. Caption: 'Occupancy reflects how much of the practitioner's available schedule has been booked.'" />
        </div>
      </div>

      <DocCallout type="tip">
        Review occupancy statistics regularly to identify heavily booked practitioners and optimize appointment distribution across your clinic branches.
      </DocCallout>


      {/* SECTION 11.4 — Calendar Integration */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        11.4 Calendar Integration
      </h3>
      <p className="text-gray-700 font-body mb-6">How schedules sync across Malasakit.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Duty hour configurations are not isolated settings—they immediately synchronize across the entire Malasakit ecosystem. 
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-8">
            <li><strong>Week & Day Views:</strong> The Calendar actively visually blocks out non-working hours and break periods, ensuring Front Desk staff know exactly when to slot patients.</li>
            <li><strong>Online Booking:</strong> The public-facing portal reads directly from this schedule, ensuring patients at home can only book within the approved working intervals.</li>
            <li><strong>Dynamic Updates:</strong> Changing a practitioner's schedule instantly updates availability everywhere without requiring a manual refresh.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 11.6: Calendar Week View. Highlight Practitioner duty hours. Caption: 'Configured duty hours are displayed directly in the weekly calendar.'" />
          <ScreenshotPlaceholder label="Screenshot 11.7: Calendar Day View. Highlight Working hours and appointments. Caption: 'Daily calendar availability follows the practitioner's configured schedule.'" />
          <ScreenshotPlaceholder label="Screenshot 11.8: Online Booking practitioner availability. Highlight Available appointment times. Caption: 'Online booking automatically follows the practitioner's configured duty hours.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 11.4: Calendar Integration. Caption: 'One duty hour configuration powers appointment scheduling, calendar visibility, online booking, and occupancy reporting.'" />
          </div>
        </div>
      </div>

      <DocCallout type="warning">
        Changing duty hours immediately affects future appointment availability. Review schedule changes carefully before saving to avoid creating unintended booking conflicts or erasing existing slots.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how practitioner duty hours serve as the foundation for availability across Malasakit. You should now understand how to:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>Configure weekly working schedules by enabling active working days.</li>
        <li>Set daily working hours and integrate break periods to divide shifts.</li>
        <li>Interpret the Occupancy Percentage, Clients, and New Clients statistics on the calendar.</li>
        <li>Recognize how duty hours directly control the availability shown on the public online booking portal.</li>
      </ul>
    </>
  );
};

export default Chapter11;
