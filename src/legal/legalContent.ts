export const LEGAL_LAST_UPDATED = '9 March 2026';

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: '1. Data Controller',
    body: `PilotLight is a trade management application. When you create a company account, your company acts as the data controller for customer, job and document data processed through the app. PilotLight (the software provider) acts as a data processor on your behalf except where we process limited account, billing, support and security data for our own legitimate business purposes.`,
  },
  {
    title: '2. What Data We Collect',
    body: `We collect and process the following categories of personal data and related business data:

• Account Data: Name, email address, password (hashed), company name, trading address, phone number, trade type and account settings.
• Professional & Compliance Data: Gas Safe Register number, gas licence number, OFTEC number, engineer ID details and related competency information that you choose to enter.
• Customer, Tenant & Landlord Data: Names, company names, service addresses, postcodes, email addresses, telephone numbers and occupancy details.
• Job & Scheduling Data: Job descriptions, notes, appointments, status history, assigned workers, calendar entries, site notes and photos.
• Property & Appliance Data: Appliance make/model details, flue and ventilation details, commissioning values, service readings, combustion/FGA readings, warning notices, defect notes, breakdown details and installation information.
• Document Data: Quotes, invoices, CP12 / Landlord Gas Safety Records, service records, warning notices, commissioning records, decommissioning records, breakdown reports, installation certificates, supporting forms, document references, renewal dates and related snapshots.
• Signature Data: Handwritten signatures captured digitally for documents, acknowledgements and certificates.
• Communication Data: Recipient email addresses, subject lines, message content, reminder settings, reminder send history, push notification tokens and notification content needed to deliver reminders and workflow updates.
• Toolbox & Resource Usage Data: Inputs you type into calculators or lookup tools may be processed in-app to show results. Where those values are then copied into a job, form or document, they become stored record data. Boiler manual lookups may open third-party websites outside PilotLight.
• Device & Diagnostic Data: Device type, app version, crash diagnostics, authentication logs and security events used to protect and improve the service.`,
  },
  {
    title: '3. Why We Process Your Data',
    body: `We process personal data for the following purposes and legal bases:

• Contract Performance: To provide the trade management service you signed up for, including customers, jobs, documents, forms, reminders, worker management, calendar scheduling, certificate generation and document delivery.
• Legal Obligation: To support compliance workflows where records must be retained or produced under applicable law or regulation, including gas safety documentation where relevant.
• Legitimate Interests: To secure the app, maintain audit trails, prevent misuse, improve features, send operational notifications and provide customer support.
• Consent: For optional communications or optional features where consent is the appropriate basis. You may withdraw consent at any time where consent is relied upon.`,
  },
  {
    title: '4. Data Sharing',
    body: `We share personal data only where necessary to operate the service:

• Supabase (database, authentication and file storage): Stores account data, structured records and generated document files.
• Expo Push Notification Service: Processes device push tokens and notification payloads to deliver app notifications.
• Resend (transactional email): Processes recipient email addresses, email content and attachments when you send documents or reminders by email through the app.
• PDF and Email Recipients: Documents you send or share may contain personal data, technical readings and signatures. You control the recipients.
• Third-Party Websites Opened by You: Toolbox resources such as boiler manual sites or supplier links are external services with their own terms and privacy policies.

We do not sell personal data and we do not use personal data for advertising or profiling.`,
  },
  {
    title: '5. Data Retention',
    body: `• Account data is retained for as long as your account remains active and for a reasonable period afterwards where needed for security, dispute handling or legal compliance.
• Customer, job, scheduling and worker records are retained until deleted by your company or removed as part of account deletion, subject to any legal retention requirement.
• Gas safety and related compliance records are retained for at least the minimum period required by applicable law where such retention obligations apply.
• Reminder logs, email delivery records and audit events may be retained for evidential, fraud-prevention and support purposes.
• Generated PDFs and document snapshots stored in cloud storage follow the retention period of the underlying record unless deleted earlier where permitted.
• If you delete your account, personal data is deleted or anonymised within a reasonable operational period except where longer retention is required by law, to resolve disputes or to enforce our terms.`,
  },
  {
    title: '6. Your Rights',
    body: `Depending on your location and applicable law, you may have rights to access, rectify, erase, export, restrict or object to certain processing of your personal data, and to withdraw consent where consent is relied upon. Company administrators are responsible for handling requests relating to customer, tenant, landlord and worker data they control. You can use the app settings where available or contact support for assistance.`,
  },
  {
    title: '7. Data Security',
    body: `We implement technical and organisational safeguards designed to protect personal data, including encrypted transport, access controls, authentication protections, company-level segregation, row-level security and controlled access to stored files. No method of transmission, storage or processing is completely secure, so we cannot guarantee absolute security. You are responsible for maintaining the confidentiality of devices, login credentials and any exported or shared documents.`,
  },
  {
    title: '8. International Transfers',
    body: `Where service providers process data outside your jurisdiction, we take reasonable steps to ensure appropriate safeguards are in place, such as contractual protections and vendor security commitments, where required by applicable law.`,
  },
  {
    title: '9. Children\'s Privacy',
    body: `PilotLight is intended for business use by tradespeople and their teams and is not directed to children. We do not knowingly collect personal data from children for consumer use.`,
  },
  {
    title: '10. Changes to This Policy',
    body: `We may update this privacy policy from time to time to reflect legal, technical or product changes, including new forms, workflows, calculators or document types. We may notify you of material changes through the app, by email or by updating the date shown on this page.`,
  },
  {
    title: '11. Contact',
    body: `If you have questions about this privacy policy or need help with data protection requests, contact us through Settings or email support@pilotlight.app.`,
  },
] as const;

export const TERMS_OF_SERVICE_SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account, accessing or using PilotLight, you agree to these Terms of Service. If you do not agree, do not use the app. If you use PilotLight on behalf of a company or other organisation, you confirm that you have authority to bind that organisation to these terms.`,
  },
  {
    title: '2. Description of Service',
    body: `PilotLight is a business software platform for tradespeople and their teams. It may include customer management, job scheduling, workers, quotes, invoices, document storage, email sending, reminders, gas and heating forms, digital signatures, renewal tracking, boiler manual links, and toolbox utilities such as gas-rate, ventilation and water-hardness calculations or lookups. The service is provided as a workflow and record-keeping tool, not as professional, engineering, legal, regulatory or safety advice.`,
  },
  {
    title: '3. Eligibility and Account Responsibilities',
    body: `• You must provide accurate and complete account information.
• You are responsible for all activity under your account and your team accounts.
• You must keep credentials secure and notify us promptly of unauthorised access.
• You must ensure invited workers are authorised to access the data you make available to them.
• You must be legally capable of entering into these terms and, where relevant, appropriately qualified, registered, certified or supervised for the work you perform.`,
  },
  {
    title: '4. Acceptable Use',
    body: `You must use PilotLight lawfully and responsibly. You must not:

• use the app in breach of applicable law, regulation, code or professional duty;
• enter misleading, fraudulent, infringing or defamatory content;
• use another person\'s registration, qualifications, branding, certificates or identity without authority;
• attempt to interfere with, reverse engineer or gain unauthorised access to the service;
• upload malicious code, harmful content or material you have no right to use.`,
  },
  {
    title: '5. Your Data and Compliance Responsibilities',
    body: `You are solely responsible for the legality, accuracy, completeness and retention of all data, readings, measurements, notes, photos, signatures, references, reminders, forms and documents entered into or generated through PilotLight. You must ensure that all records, notices, certificates, invoices, emails and other outputs comply with applicable law, regulation, technical standards, professional requirements and manufacturer instructions.`,
  },
  {
    title: '6. Forms, Certificates and Technical Records',
    body: `PilotLight may support forms and records including, for example, CP12 / Landlord Gas Safety Records, service records, warning notices, commissioning records, decommissioning records, breakdown reports, installation certificates, invoices, quotes and related job documentation.

• These features are provided as digital templates and workflow tools only.
• You are solely responsible for checking that every form, record and certificate is suitable for the job, correctly completed and legally compliant.
• PilotLight does not independently verify appliance details, test results, combustion readings, flue data, ventilation calculations, defect classifications, registration status, competence or legal eligibility.
• You must review each document before issue, signature, sharing or reliance.
• You must keep records for the period required by law, regulation, insurer, scheme rules or contract.`,
  },
  {
    title: '7. Gas Safe, OFTEC and Other Credentials',
    body: `If you enter any registration number, engineer ID, licence number, competency credential or scheme branding, you warrant that it is genuine, current, authorised for your use and used in compliance with all applicable rules. PilotLight does not verify or endorse your credentials and is not affiliated with or endorsed by Gas Safe Register, OFTEC, HSE or any other regulator unless expressly stated. You assume full responsibility for any use of professional credentials, logos or branding in documents generated through the app.`,
  },
  {
    title: '8. Calculators, Toolbox and External Resources',
    body: `Toolbox features, calculators, lookup tools, formulas, boiler manual links and similar resources are provided for convenience only.

• Calculation outputs are estimates based on the inputs, assumptions and formulas configured in the app.
• They do not replace professional judgment, statutory requirements, current standards, appliance instructions, commissioning procedures or on-site verification.
• You must independently check all figures, dimensions, readings and conclusions before relying on them.
• External websites opened from the app are third-party services outside our control, and your use of them is at your own risk.

To the fullest extent permitted by law, PilotLight accepts no responsibility for any loss, damage, injury, enforcement action, failed inspection, unsafe condition, misdiagnosis, incorrect installation, incorrect commissioning, incorrect certification or other consequence arising from reliance on calculator outputs, templates, lookups or external resources.`,
  },
  {
    title: '9. Emails, Reminders and Notifications',
    body: `You are responsible for all emails, reminders, notifications and documents sent through PilotLight, including recipient selection, timing, content, attachments and legal basis for contact. We do not guarantee delivery, receipt, timing, inbox placement or continued availability of any third-party email or notification service.`,
  },
  {
    title: '10. Team Accounts',
    body: `Company administrators control company workspaces and are responsible for worker access, permission management and data shared with team members. Workers act on behalf of the company account that grants them access. Administrators must promptly remove access that is no longer authorised.`,
  },
  {
    title: '11. Intellectual Property',
    body: `PilotLight, the app software, branding, interface, templates and related content remain our intellectual property or that of our licensors. You retain ownership of your own data and documents, subject to any rights needed for us to host, process, back up and transmit that data to provide the service.`,
  },
  {
    title: '12. Disclaimers',
    body: `PilotLight is provided on an “as is” and “as available” basis. To the maximum extent permitted by law, we disclaim all warranties, representations and conditions, whether express, implied or statutory, including warranties of accuracy, fitness for a particular purpose, non-infringement, merchantability and uninterrupted availability. We do not warrant that the service, templates, forms, calculations, reminders or outputs will be error-free, complete, compliant or suitable for your specific use case.`,
  },
  {
    title: '13. Limitation of Liability',
    body: `To the maximum extent permitted by law:

• We are not liable for indirect, incidental, special, consequential, exemplary or punitive damages, or for loss of profits, revenue, business, contracts, goodwill, reputation, anticipated savings, data or opportunity.
• We are not liable for losses arising from your entered data, your professional work, your compliance obligations, third-party services, external websites, delayed or failed communications, or reliance on generated documents, formulas, calculations, reminders or technical content.
• Our aggregate liability in connection with the service shall not exceed the total amount paid by you for PilotLight in the 12 months before the event giving rise to the claim.
• Nothing in these terms limits liability that cannot lawfully be limited or excluded.`,
  },
  {
    title: '14. Indemnity',
    body: `You agree to indemnify and hold harmless PilotLight and its officers, directors, employees and affiliates from claims, liabilities, losses, damages, penalties, fines, costs and expenses arising out of or related to: your use of the service; your data; your forms, certificates, calculations or outputs; your breach of these terms; your breach of law, regulation or professional duty; or your infringement or misuse of another person\'s rights, credentials or branding.`,
  },
  {
    title: '15. Suspension and Termination',
    body: `You may stop using the app and delete your account at any time. We may suspend, restrict or terminate access where reasonably necessary to protect the service, comply with law, investigate misuse or enforce these terms.`,
  },
  {
    title: '16. Changes to Terms',
    body: `We may update these terms from time to time, including to reflect new features, forms, legal requirements or service providers. Continued use of PilotLight after an update takes effect constitutes acceptance of the revised terms.`,
  },
  {
    title: '17. Governing Law',
    body: `These terms are governed by the laws of England and Wales unless mandatory local law requires otherwise. The courts of England and Wales shall have exclusive jurisdiction except where applicable consumer or mandatory laws provide otherwise.`,
  },
  {
    title: '18. Contact',
    body: `For questions about these terms, contact us through Settings or email support@pilotlight.app.`,
  },
] as const;
