import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter17: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to automate long-term scheduling by generating recurring appointment series for patients who require consistent follow-up care.
      </p>

      {/* IMPORTANT CONCEPT — Recurring Appointment Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Recurring Appointment Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Recurring appointments eliminate the repetitive administrative work of manually booking individual visits. They are designed for patients participating in therapy sessions, rehabilitation, or long-term treatment programs. Instead of creating each appointment individually, Malasakit automatically generates an entire schedule of future appointments based on your selected recurrence settings.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Recurrence Generation Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Patient & Provider</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Set Frequency</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Availability Check</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200 font-bold">Generate Series</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Schedule Created</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 17.1: Recurring Appointment Workflow. Caption: 'Recurring appointments automatically create multiple future bookings based on the selected schedule.'" />
      </div>


      {/* SECTION 17.1 — Weekly Recurrence */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        17.1 Weekly Recurrence
      </h3>
      <p className="text-gray-700 font-body mb-6">Schedule appointments that repeat on specific days of the week.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Weekly recurrence allows you to easily schedule appointments that repeat on specific weekdays over a defined number of weeks (e.g., Every Monday and Thursday for 8 weeks).
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Before finalizing the recurring schedule, Malasakit executes a strict <strong>availability validation</strong>. The system checks the practitioner's working schedule for <em>every single occurrence</em> in the generated series. You will be provided with a preview of the available dates, and the system will notify you if any occurrences conflict with existing appointments or fall outside working hours.
          </p>

          <ScreenshotPlaceholder label="Screenshot 17.1: Create Appointment modal with Recurring Appointment enabled. Highlight Recurring option, Weekly frequency. Caption: 'Enable recurring appointments to schedule multiple future visits automatically.'" />
          <ScreenshotPlaceholder label="Screenshot 17.2: Weekly recurrence settings. Highlight Selected weekdays, Number of weeks. Caption: 'Configure the weekly recurrence schedule according to the patient's treatment plan.'" />
          <ScreenshotPlaceholder label="Screenshot 17.3: Availability preview before saving. Highlight Generated appointment dates. Caption: 'The system previews every recurring appointment before confirming the schedule.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 17.2: Weekly Schedule. Caption: 'Weekly recurrence automatically generates appointments across multiple weeks.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Always review the generated appointment preview before saving to ensure every occurrence matches the intended treatment schedule and that no conflicts exist.
      </DocCallout>


      {/* SECTION 17.2 — Monthly Recurrence */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        17.2 Monthly & Yearly Recurrence
      </h3>
      <p className="text-gray-700 font-body mb-6">Schedule long-term periodic follow-up visits.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            For patients requiring long-term, periodic care, Malasakit fully supports <strong>Monthly</strong> and <strong>Yearly</strong> recurrence frequencies. This allows you to rapidly generate schedules for routine monthly check-ups or annual evaluations without needing to navigate through months or years on the calendar.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Just like weekly recurrence, the system will preview the generated monthly or yearly dates and validate practitioner availability across the entire requested timeline before you confirm the series.
          </p>

          <ScreenshotPlaceholder label="Screenshot 17.4: Monthly recurrence settings. Highlight Monthly recurrence configuration. Caption: 'Configure recurring appointments that repeat on a monthly schedule.'" />
          <ScreenshotPlaceholder label="Screenshot 17.5: Monthly appointment preview. Highlight Generated monthly schedule. Caption: 'Preview the monthly recurring appointments before confirming the series.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 17.3: Monthly Flow. Caption: 'Monthly recurrence automatically creates future appointments according to the selected schedule.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Monthly recurrence is highly useful for long-term treatment plans or administrative follow-ups that require periodic check-ins.
      </DocCallout>


      {/* SECTION 17.3 — Editing Series */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        17.3 Editing Recurring Appointments
      </h3>
      <p className="text-gray-700 font-body mb-6">Modifying generated schedules.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once a recurring series has been generated, the resulting appointments appear as distinct blocks on the Calendar. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When you attempt to modify an appointment that is part of a series, the system allows you to manage the schedule flexibly. You may choose to edit an individual occurrence (for instance, if a patient needs to shift one specific week's session) without affecting the remaining appointments in the patient's long-term plan.
          </p>

          <ScreenshotPlaceholder label="Screenshot 17.6: Recurring appointment selected. Highlight Appointment information. Caption: 'Recurring appointments can be modified according to the available editing options.'" />
          <ScreenshotPlaceholder label="Screenshot 17.7: Edit recurring appointment dialog. Highlight Series editing options. Caption: 'Choose how changes should be applied to recurring appointments.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 17.4: Edit Series. Caption: 'Editing a recurring series updates future appointments according to the selected option.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Review your editing scope carefully before saving changes. Accidental modifications to an entire series may overwrite previously customized individual appointments.
      </DocCallout>


      {/* SECTION 17.4 — Cancelling Series */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        17.4 Cancelling Appointments
      </h3>
      <p className="text-gray-700 font-body mb-6">Removing scheduled occurrences from the calendar.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            If a patient's treatment plan changes or they decide to terminate their remaining sessions, you can cancel appointments directly from the Calendar. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The system provides bulk cancellation capabilities, allowing you to either cancel a single, isolated appointment or clear multiple future appointments simultaneously, instantly freeing up the practitioner's schedule for other patients.
          </p>

          <ScreenshotPlaceholder label="Screenshot 17.8: Recurring appointment cancellation. Highlight Cancellation dialog. Caption: 'Choose whether to cancel a single appointment or the recurring schedule.'" />
          <ScreenshotPlaceholder label="Screenshot 17.9: Calendar after cancellation. Highlight Updated recurring schedule. Caption: 'Cancelled recurring appointments are immediately reflected in the Calendar.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 17.5: Cancellation Flow. Caption: 'Cancelling recurring appointments automatically updates future schedules.'" />
          </div>
        </div>
      </div>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to optimize your clinic's administrative efficiency by using recurring appointments. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How to rapidly generate <strong>Weekly</strong>, <strong>Monthly</strong>, or <strong>Yearly</strong> appointment series.</li>
        <li>How the system strictly validates practitioner availability across the entire recurring schedule before saving.</li>
        <li>How to individually edit or bulk cancel appointments that belong to a recurring series.</li>
      </ul>
    </>
  );
};

export default Chapter17;
