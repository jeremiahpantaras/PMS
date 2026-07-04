import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter22: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to securely export, print, and share patient Clinical Notes using Malasakit's standardized medical report layouts.
      </p>

      {/* IMPORTANT CONCEPT — Clinical Note Export Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Clinical Note Export Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Whether you need to file a physical record, send documentation to a referring physician, or securely email a copy directly to the patient, Malasakit handles the entire export process. Most importantly, every export method funnels through the same backend generator, guaranteeing that your printed notes, PDF downloads, and email attachments always share the exact same professional medical layout.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Standardized Export Path</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">View Clinical Note</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Choose Method</span>
            <span className="text-sky-400">→</span>
            <div className="flex flex-col gap-1">
              <span className="px-3 py-1 bg-amber-50 rounded border border-amber-200">Print</span>
              <span className="px-3 py-1 bg-amber-50 rounded border border-amber-200">PDF Download</span>
              <span className="px-3 py-1 bg-amber-50 rounded border border-amber-200">Email Note</span>
            </div>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Professional Clinical Report</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 22.1: Clinical Note Export Workflow. Caption: 'Every export method produces the same standardized clinical document.'" />
      </div>


      {/* SECTION 22.1 — Print */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        22.1 Printing Notes
      </h3>
      <p className="text-gray-700 font-body mb-6">Generating physical records for clinic files.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When reviewing a Clinical Note, practitioners can instantly trigger a print job by selecting the <strong>Print Clinical Note</strong> action. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Malasakit intercepts the print request, silently generates a high-resolution, A4-optimized document, and immediately opens your browser's native Print Preview dialog. The generated report includes your clinic's header, full patient demographics, appointment details, and the structured clinical documentation.
          </p>

          <ScreenshotPlaceholder label="Screenshot 22.1: View Clinical Note. Highlight Print Clinical Note button. Caption: 'The Print button generates a professional clinical report for printing.'" />
          <ScreenshotPlaceholder label="Screenshot 22.2: Print Preview. Highlight Generated A4 document. Caption: 'Clinical Notes are displayed in a professional print layout before printing.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 22.2: Print Workflow. Caption: 'Printing always uses the standardized clinical report template.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always review the print preview to ensure the documentation fits correctly on the page and that no sensitive internal remarks are accidentally sent to the printer.
      </DocCallout>


      {/* SECTION 22.2 — PDF */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        22.2 PDF Generation
      </h3>
      <p className="text-gray-700 font-body mb-6">Downloading digital copies for external sharing.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            If you need to store the Clinical Note on a local drive, upload it to an external specialist portal, or archive it digitally, you can export the note as a PDF.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The PDF export uses the exact same rendering engine as the Print function. This ensures that the downloaded file maintains strict A4 formatting, pristine clinic branding, and standardized medical record layouts regardless of which device or operating system the recipient uses to open the file.
          </p>

          <ScreenshotPlaceholder label="Screenshot 22.3: Generated PDF. Highlight Professional A4 layout. Caption: 'Exported PDFs maintain consistent formatting across every Clinical Note.'" />
          <ScreenshotPlaceholder label="Screenshot 22.4: PDF preview. Highlight Patient information and Clinical Note sections. Caption: 'The exported PDF includes clinic branding, patient information, appointment details, and structured clinical documentation.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 22.3: PDF Export. Caption: 'PDF exports preserve formatting and provide consistent documentation.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Because the PDF export is identical to the printed version, you never have to worry about layout discrepancies when sharing records digitally.
      </DocCallout>


      {/* SECTION 22.3 — Email */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        22.3 Emailing Notes
      </h3>
      <p className="text-gray-700 font-body mb-6">Securely dispatching records to patients or providers.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Malasakit includes a built-in email engine, allowing practitioners to securely dispatch Clinical Notes directly from the View window without ever opening an external email client. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Clicking the <strong>Send Email</strong> button opens a secure modal where you can define recipients. The system automatically suggests the patient's registered email address (if available) alongside other clinic staff. You can customize the subject line and the email body to provide additional context before securely dispatching the message.
          </p>

          <ScreenshotPlaceholder label="Screenshot 22.5: View Clinical Note. Highlight Send Email button. Caption: 'Clinical Notes can be securely shared through email.'" />
          <ScreenshotPlaceholder label="Screenshot 22.6: Send Clinical Note modal. Highlight Recipient, Subject, Body. Caption: 'The email dialog allows practitioners to customize the outgoing message before sending.'" />
          <ScreenshotPlaceholder label="Screenshot 22.7: Attachment preview. Highlight Generated PDF. Caption: 'The generated Clinical Note PDF is automatically attached before sending.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 22.4: Email Workflow. Caption: 'Clinical Notes are securely shared using a standardized PDF attachment.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Clinical Notes contain highly confidential patient information. Always double-check the recipient's email address before clicking send.
      </DocCallout>


      {/* SECTION 22.4 — Attachments */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        22.4 Automated Attachments
      </h3>
      <p className="text-gray-700 font-body mb-6">How email attachments are formatted and named.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When you send a Clinical Note via email, the system automatically runs the PDF generator in the background. The resulting professional A4 document is seamlessly attached to the outgoing email.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To maintain administrative consistency, the system applies a standardized naming convention to the attachment (e.g., <code>clinical-note-[patient-name].pdf</code>). When the recipient opens the file, they receive the exact same high-quality report that a practitioner would print inside the clinic.
          </p>

          <ScreenshotPlaceholder label="Screenshot 22.8: Attachment preview. Highlight PDF filename. Caption: 'Every emailed Clinical Note includes a standardized PDF attachment.'" />
          <ScreenshotPlaceholder label="Screenshot 22.9: Opened attachment. Highlight Complete PDF document. Caption: 'Recipients receive the same professional report that practitioners print inside the clinic.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 22.5: Attachment Flow. Caption: 'Email attachments preserve document consistency and formatting.'" />
          </div>
        </div>
      </div>

      <DocCallout type="warning">
        Only send Clinical Notes to authorized recipients (such as the patient themselves or verified referring physicians). Unauthorized sharing of medical documents violates healthcare privacy regulations.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to properly export and share Clinical Notes. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How to generate physical records using the <strong>Print</strong> functionality.</li>
        <li>How to download notes as standardized <strong>PDFs</strong> for external specialist portals.</li>
        <li>How to securely share documentation using the built-in <strong>Email Clinical Note</strong> feature.</li>
        <li>Why all export methods share the exact same professional A4 clinical report layout.</li>
      </ul>
    </>
  );
};

export default Chapter22;
