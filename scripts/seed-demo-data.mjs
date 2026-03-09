import { createClient } from '@supabase/supabase-js';

const TARGET_EMAIL = 'rahim.5123.rk@gmail.com';
const DEMO_NOTE_PREFIX = 'DEMO-SEED:';
const WORKER_PASSWORD = process.env.DEMO_WORKER_PASSWORD || 'PilotLightDemo#2026';

const customerTemplates = [
  {
    name: 'Amelia Hughes',
    company_name: 'Oakview Lettings',
    address_line_1: '14 Maple Court',
    address_line_2: 'Flat 2B',
    city: 'London',
    region: 'Greater London',
    postal_code: 'SW11 4QT',
    phone: '07911 234567',
    email: 'amelia.hughes@oakview.example.com',
  },
  {
    name: 'Daniel Carter',
    company_name: 'Carter Property Group',
    address_line_1: '88 Kingsland Road',
    address_line_2: '',
    city: 'London',
    region: 'Greater London',
    postal_code: 'E2 8DP',
    phone: '07700 900123',
    email: 'daniel.carter@carterpg.example.com',
  },
  {
    name: 'Sophie Patel',
    company_name: '',
    address_line_1: '5 Willow Mews',
    address_line_2: '',
    city: 'Croydon',
    region: 'Surrey',
    postal_code: 'CR0 2AJ',
    phone: '07888 456123',
    email: 'sophie.patel@example.com',
  },
  {
    name: 'James Bennett',
    company_name: 'Bennett Developments',
    address_line_1: '21 Riverside Way',
    address_line_2: '',
    city: 'Reading',
    region: 'Berkshire',
    postal_code: 'RG1 8BG',
    phone: '07444 110220',
    email: 'james@bennettdev.example.com',
  },
  {
    name: 'Olivia Thompson',
    company_name: '',
    address_line_1: '32 Cedar Avenue',
    address_line_2: '',
    city: 'Guildford',
    region: 'Surrey',
    postal_code: 'GU1 3JP',
    phone: '07555 883311',
    email: 'olivia.thompson@example.com',
  },
  {
    name: 'Ethan Brooks',
    company_name: 'Brooks Estates',
    address_line_1: '7 Victoria Parade',
    address_line_2: 'Unit 4',
    city: 'Brighton',
    region: 'East Sussex',
    postal_code: 'BN1 1EE',
    phone: '07123 555001',
    email: 'ethan@brooksestates.example.com',
  },
  {
    name: 'Grace Wilson',
    company_name: '',
    address_line_1: '45 Station Road',
    address_line_2: '',
    city: 'Watford',
    region: 'Hertfordshire',
    postal_code: 'WD17 1AP',
    phone: '07001 555222',
    email: 'grace.wilson@example.com',
  },
  {
    name: 'Henry Moore',
    company_name: 'Moore Hospitality',
    address_line_1: '101 Harbour Street',
    address_line_2: '',
    city: 'Portsmouth',
    region: 'Hampshire',
    postal_code: 'PO1 2LU',
    phone: '07333 222999',
    email: 'henry@moorehospitality.example.com',
  },
  {
    name: 'Chloe Green',
    company_name: '',
    address_line_1: '17 Millbrook Close',
    address_line_2: '',
    city: 'St Albans',
    region: 'Hertfordshire',
    postal_code: 'AL1 2RT',
    phone: '07666 120120',
    email: 'chloe.green@example.com',
  },
  {
    name: 'Mason Reed',
    company_name: 'Reed Facilities',
    address_line_1: '63 High Street',
    address_line_2: '',
    city: 'Slough',
    region: 'Berkshire',
    postal_code: 'SL1 1EL',
    phone: '07870 112233',
    email: 'mason@reedfacilities.example.com',
  },
  {
    name: 'Ava Foster',
    company_name: '',
    address_line_1: '9 Orchard Lane',
    address_line_2: '',
    city: 'Milton Keynes',
    region: 'Buckinghamshire',
    postal_code: 'MK9 3DD',
    phone: '07222 600700',
    email: 'ava.foster@example.com',
  },
  {
    name: 'Leo Turner',
    company_name: 'Turner Investments',
    address_line_1: '52 Park Crescent',
    address_line_2: '',
    city: 'Cambridge',
    region: 'Cambridgeshire',
    postal_code: 'CB2 1QJ',
    phone: '07990 888777',
    email: 'leo@turnerinvestments.example.com',
  },
];

const workerTemplates = [
  { name: 'Kai Morgan', email: 'kai.morgan+pilotlight.demo@example.com' },
  { name: 'Ella Robinson', email: 'ella.robinson+pilotlight.demo@example.com' },
  { name: 'Noah Evans', email: 'noah.evans+pilotlight.demo@example.com' },
  { name: 'Lily Ward', email: 'lily.ward+pilotlight.demo@example.com' },
];

const quoteStatuses = ['Draft', 'Sent', 'Accepted'];
const invoiceStatuses = ['Draft', 'Unpaid', 'Paid', 'Overdue'];
const gasTypes = ['cp12', 'service_record'];

function parseArgs(argv) {
  return argv.reduce((acc, entry) => {
    if (!entry.startsWith('--')) return acc;
    const [rawKey, rawValue] = entry.slice(2).split('=');
    acc[rawKey] = rawValue ?? true;
    return acc;
  }, {});
}

function pad(value, size = 4) {
  return String(value).padStart(size, '0');
}

function addDays(base, days) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function iso(value) {
  return value.toISOString();
}

function buildAddress(customer) {
  return [
    customer.address_line_1,
    customer.address_line_2,
    customer.city,
    customer.region,
    customer.postal_code,
  ].filter(Boolean).join(', ');
}

function buildCustomerSnapshot(customer) {
  return {
    name: customer.name,
    company_name: customer.company_name || null,
    address_line_1: customer.address_line_1,
    address_line_2: customer.address_line_2 || null,
    city: customer.city,
    region: customer.region || null,
    postal_code: customer.postal_code,
    phone: customer.phone || null,
    email: customer.email || null,
    site_contact_name: customer.name,
    site_contact_email: customer.email || null,
    address: buildAddress(customer),
  };
}

function buildJobAddress(customer) {
  return {
    address_line_1: customer.address_line_1,
    address_line_2: customer.address_line_2 || null,
    city: customer.city,
    postcode: customer.postal_code,
  };
}

function makeSignature(name) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
      <rect width="100%" height="100%" fill="white"/>
      <path d="M16 76 C55 28, 115 108, 165 52 S260 38, 320 80" stroke="#111111" stroke-width="4" fill="none" stroke-linecap="round"/>
      <text x="16" y="108" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#475569">${name}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function placeholderPhoto(label, hex) {
  return `https://placehold.co/1200x900/${hex}/ffffff.png?text=${encodeURIComponent(label)}`;
}

function makeItems(seed) {
  return [
    {
      description: `${seed} labour`,
      quantity: 1,
      unitPrice: 145,
      vatPercent: 20,
    },
    {
      description: `${seed} materials`,
      quantity: 1,
      unitPrice: 55,
      vatPercent: 20,
    },
  ];
}

function calculateTotals(items, discountPercent = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vat = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.vatPercent / 100),
    0,
  );
  const discount = subtotal * (discountPercent / 100);
  const total = subtotal - discount + vat;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    total_vat: Number(vat.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

function buildSeededGasLockedPayload(type, customer, createdAt, expiry, reference, company, profile) {
  const engineer = {
    name: profile.display_name || profile.name || 'PilotLight Engineer',
    gasSafeNumber: profile.gas_safe_number || profile.gas_safe_license || '',
    email: profile.email || customer.email || '',
    phone: profile.phone || company.phone || '',
  };

  const companySnapshot = {
    name: company.name || 'PilotLight Home Services',
    email: company.email || profile.email || '',
    phone: company.phone || '',
    address: company.address || '',
  };

  const common = {
    kind: type,
    version: 1,
    savedAt: iso(createdAt),
    company: companySnapshot,
    engineer,
  };

  if (type === 'cp12') {
    return {
      ...common,
      pdfData: {
        propertyAddress: buildAddress(customer),
        landlordName: customer.name,
        landlordAddress: buildAddress(customer),
        landlordPostcode: customer.postal_code,
        landlordEmail: customer.email || '',
        tenantName: customer.company_name || customer.name,
        tenantEmail: customer.email || '',
        appliances: [
          {
            make: 'Worcester Bosch',
            model: 'Greenstar 4000',
            location: 'Kitchen',
            type: 'Boiler',
            applianceSafeToUse: 'Yes',
          },
        ],
        inspectionDate: createdAt.toLocaleDateString('en-GB'),
        nextDueDate: expiry.toLocaleDateString('en-GB'),
        certRef: reference,
        customerSignature: makeSignature(customer.name),
      },
    };
  }

  return {
    ...common,
    pdfData: {
      customerName: customer.name,
      customerCompany: customer.company_name || '',
      customerAddress: buildAddress(customer),
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      propertyAddress: buildAddress(customer),
      appliances: [
        {
          make: 'Ideal',
          model: 'Logic+',
          location: 'Utility Room',
          category: 'Boiler',
          applianceCondition: 'Safe',
        },
      ],
      serviceDate: createdAt.toLocaleDateString('en-GB'),
      nextInspectionDate: expiry.toLocaleDateString('en-GB'),
      certRef: reference,
      customerSignature: makeSignature(customer.name),
    },
  };
}

async function requireEnv() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Export them before running the demo seed.',
    );
  }

  return { url, serviceRoleKey };
}

async function fetchAllAuthUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }

  return users;
}

async function findUserByEmail(supabase, email) {
  const users = await fetchAllAuthUsers(supabase);
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function ensureWorkerAuthUser(supabase, worker) {
  const existing = await findUserByEmail(supabase, worker.email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email: worker.email,
    password: WORKER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: worker.name, role: 'worker' },
  });

  if (error) throw error;
  return data.user;
}

async function cleanupPreviousDemoData(supabase, companyId, customerEmails) {
  const { data: demoJobs, error: jobQueryError } = await supabase
    .from('jobs')
    .select('id')
    .eq('company_id', companyId)
    .ilike('notes', `${DEMO_NOTE_PREFIX}%`);

  if (jobQueryError) throw jobQueryError;

  const demoJobIds = (demoJobs || []).map((job) => job.id);
  if (demoJobIds.length) {
    await supabase.from('job_activity').delete().in('job_id', demoJobIds);
    const { error: deleteJobsError } = await supabase
      .from('jobs')
      .delete()
      .eq('company_id', companyId)
      .ilike('notes', `${DEMO_NOTE_PREFIX}%`);
    if (deleteJobsError) throw deleteJobsError;
  }

  const { error: deleteDocumentsError } = await supabase
    .from('documents')
    .delete()
    .eq('company_id', companyId)
    .ilike('notes', `${DEMO_NOTE_PREFIX}%`);
  if (deleteDocumentsError) throw deleteDocumentsError;

  const { error: deleteCustomersError } = await supabase
    .from('customers')
    .delete()
    .eq('company_id', companyId)
    .in('email', customerEmails);
  if (deleteCustomersError) throw deleteCustomersError;
}

async function seedCustomers(supabase, companyId) {
  const inserted = [];

  for (const customer of customerTemplates) {
    const payload = {
      company_id: companyId,
      name: customer.name,
      company_name: customer.company_name || null,
      address_line_1: customer.address_line_1,
      address_line_2: customer.address_line_2 || null,
      city: customer.city,
      region: customer.region || null,
      postal_code: customer.postal_code,
      address: buildAddress(customer),
      phone: customer.phone,
      email: customer.email,
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    inserted.push(data);
  }

  return inserted;
}

async function seedWorkers(supabase, companyId) {
  const workers = [];

  for (const template of workerTemplates) {
    const authUser = await ensureWorkerAuthUser(supabase, template);
    const profilePayload = {
      id: authUser.id,
      email: template.email,
      display_name: template.name,
      company_id: companyId,
      role: 'worker',
      accepted_gas_safe_terms: true,
      gas_safe_terms_accepted_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (error) throw error;
    workers.push({ ...template, id: authUser.id });
  }

  return workers;
}

async function updateBranding(supabase, targetProfile, company) {
  const updatedSettings = {
    ...(company.settings || {}),
    nextJobNumber: Number(company.settings?.nextJobNumber || 2001),
    nextInvoiceNumber: Number(company.settings?.nextInvoiceNumber || 4101),
    nextQuoteNumber: Number(company.settings?.nextQuoteNumber || 3101),
    userDetailsById: {
      ...(company.settings?.userDetailsById || {}),
      [targetProfile.id]: {
        gasSafeRegisterNumber: '123456',
        gasLicenceNumber: '7654321',
        oftecNumber: 'OFT-20481',
        acceptedGasSafeTerms: true,
      },
    },
  };

  const companyUpdate = {
    name: 'PilotLight Home Services',
    address: '42 Kingsway, London WC2B 6SE',
    email: 'hello@pilotlight.app',
    phone: '020 7946 0958',
    trade: 'Gas Engineer',
    settings: updatedSettings,
  };

  const { error: companyError } = await supabase
    .from('companies')
    .update(companyUpdate)
    .eq('id', company.id);
  if (companyError) throw companyError;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      display_name: targetProfile.display_name || 'Rahim Khan',
      accepted_gas_safe_terms: true,
      gas_safe_terms_accepted_at: new Date().toISOString(),
    })
    .eq('id', targetProfile.id);
  if (profileError) throw profileError;

  return updatedSettings;
}

async function seedJobs(supabase, companyId, adminProfile, workers, customers, nextJobNumber) {
  const today = new Date();
  const assignedPool = [adminProfile.id, ...workers.map((worker) => worker.id)];

  const jobTemplates = [
    { title: 'Annual boiler service', customerIndex: 0, days: -10, status: 'paid', duration: '1 hour', price: 120, assignees: [assignedPool[1]], photos: 2 },
    { title: 'Landlord gas safety inspection', customerIndex: 1, days: -6, status: 'complete', duration: '90 mins', price: 160, assignees: [assignedPool[2]], photos: 1 },
    { title: 'Boiler pressure loss investigation', customerIndex: 2, days: -3, status: 'complete', duration: '2 hours', price: 185, assignees: [assignedPool[0]], photos: 2 },
    { title: 'Radiator balancing visit', customerIndex: 3, days: -1, status: 'in_progress', duration: '2 hours', price: 145, assignees: [assignedPool[3]] },
    { title: 'Smart thermostat installation', customerIndex: 4, days: 0, status: 'pending', duration: '90 mins', price: 210, assignees: [assignedPool[0], assignedPool[4]] },
    { title: 'Cooker safety check', customerIndex: 5, days: 0, status: 'pending', duration: '1 hour', price: 95, assignees: [assignedPool[1]] },
    { title: 'Emergency no hot water callout', customerIndex: 6, days: 1, status: 'pending', duration: '2.5 hours', price: 240, assignees: [assignedPool[2]] },
    { title: 'Combi boiler replacement survey', customerIndex: 7, days: 2, status: 'pending', duration: '1.5 hours', price: 0, assignees: [assignedPool[0]] },
    { title: 'Gas hob connection', customerIndex: 8, days: 3, status: 'pending', duration: '1 hour', price: 110, assignees: [assignedPool[3]] },
    { title: 'Tenant moving-in safety check', customerIndex: 9, days: 4, status: 'pending', duration: '1 hour', price: 130, assignees: [assignedPool[4]] },
    { title: 'Powerflush quote visit', customerIndex: 10, days: 5, status: 'pending', duration: '45 mins', price: 0, assignees: [assignedPool[0]] },
    { title: 'Leak trace in utility room', customerIndex: 11, days: 6, status: 'pending', duration: '2 hours', price: 175, assignees: [assignedPool[2]] },
    { title: 'CP12 reinspection', customerIndex: 0, days: 8, status: 'pending', duration: '1 hour', price: 150, assignees: [assignedPool[1]] },
    { title: 'Underfloor heating manifold check', customerIndex: 4, days: 10, status: 'pending', duration: '2 hours', price: 220, assignees: [assignedPool[3]] },
    { title: 'Boiler install final handover', customerIndex: 7, days: 14, status: 'pending', duration: '1 hour', price: 0, assignees: [assignedPool[0], assignedPool[4]] },
    { title: 'Service plan maintenance visit', customerIndex: 8, days: 18, status: 'pending', duration: '1 hour', price: 99, assignees: [assignedPool[1]] },
  ];

  const insertedJobs = [];
  let counter = nextJobNumber;

  for (const [index, template] of jobTemplates.entries()) {
    const customer = customers[template.customerIndex % customers.length];
    const scheduled = addDays(today, template.days);
    scheduled.setHours(8 + (index % 5) * 2, index % 2 === 0 ? 0 : 30, 0, 0);

    const payload = {
      company_id: companyId,
      reference: `PL-${scheduled.getFullYear()}-${pad(counter)}`,
      customer_id: customer.id,
      customer_snapshot: buildCustomerSnapshot(customer),
      title: template.title,
      assigned_to: template.assignees,
      status: template.status,
      scheduled_date: scheduled.getTime(),
      estimated_duration: template.duration,
      price: template.price || null,
      notes: `${DEMO_NOTE_PREFIX} ${template.title} for App Store screenshots.`,
      signature: ['complete', 'paid'].includes(template.status) ? makeSignature(customer.name) : null,
      photos: template.photos
        ? Array.from({ length: template.photos }, (_, photoIndex) =>
          placeholderPhoto(`${template.title} ${photoIndex + 1}`, photoIndex % 2 === 0 ? '0f172a' : '334155'),
        )
        : [],
    };

    const { data, error } = await supabase
      .from('jobs')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;

    insertedJobs.push(data);
    counter += 1;
  }

  const activityRows = insertedJobs.flatMap((job) => {
    const rows = [
      {
        job_id: job.id,
        company_id: companyId,
        actor_id: adminProfile.id,
        action: 'created',
        details: { source: 'demo-seed', status: job.status },
      },
    ];

    if (job.status !== 'pending') {
      rows.push({
        job_id: job.id,
        company_id: companyId,
        actor_id: job.assigned_to?.[0] || adminProfile.id,
        action: 'status_change',
        details: { source: 'demo-seed', new_status: job.status },
      });
    }

    return rows;
  });

  if (activityRows.length) {
    const { error: activityError } = await supabase.from('job_activity').insert(activityRows);
    if (activityError) {
      console.warn('Skipping job activity seed:', activityError.message);
    }
  }

  return { jobs: insertedJobs, nextJobNumber: counter };
}

async function seedQuotes(supabase, companyId, customers, jobs, nextQuoteNumber) {
  const inserted = [];
  let counter = nextQuoteNumber;

  for (let index = 0; index < 6; index += 1) {
    const customer = customers[index % customers.length];
    const job = jobs[(index + 2) % jobs.length];
    const items = makeItems(index % 2 === 0 ? 'Heating upgrade' : 'Boiler install');
    const discountPercent = index % 3 === 0 ? 5 : 0;
    const totals = calculateTotals(items, discountPercent);
    const status = quoteStatuses[index % quoteStatuses.length];
    const date = addDays(new Date(), -8 + index);
    const expiry = addDays(date, 30);

    const payload = {
      company_id: companyId,
      type: 'quote',
      number: counter,
      reference: `PL-Q-${pad(counter)}`,
      date: iso(date),
      expiry_date: iso(expiry),
      status,
      customer_id: customer.id,
      customer_snapshot: buildCustomerSnapshot(customer),
      job_id: job.id,
      job_address: buildJobAddress(customer),
      items,
      subtotal: totals.subtotal,
      discount_percent: discountPercent,
      total: totals.total,
      notes: `${DEMO_NOTE_PREFIX} Quote seeded for screenshots.`,
    };

    const { data, error } = await supabase.from('documents').insert(payload).select('*').single();
    if (error) throw error;
    inserted.push(data);
    counter += 1;
  }

  return { documents: inserted, nextQuoteNumber: counter };
}

async function seedInvoices(supabase, companyId, customers, jobs, nextInvoiceNumber) {
  const inserted = [];
  let counter = nextInvoiceNumber;

  for (let index = 0; index < 8; index += 1) {
    const customer = customers[(index + 3) % customers.length];
    const job = jobs[index % jobs.length];
    const items = makeItems(index % 2 === 0 ? 'Boiler service' : 'Repair works');
    const discountPercent = index % 4 === 0 ? 10 : 0;
    const totals = calculateTotals(items, discountPercent);
    const status = invoiceStatuses[index % invoiceStatuses.length];
    const date = addDays(new Date(), -14 + index * 2);
    const due = addDays(date, 14);

    const payload = {
      company_id: companyId,
      type: 'invoice',
      number: counter,
      reference: `PL-I-${pad(counter)}`,
      date: iso(date),
      expiry_date: iso(due),
      status,
      customer_id: customer.id,
      customer_snapshot: buildCustomerSnapshot(customer),
      job_id: job.id,
      job_address: buildJobAddress(customer),
      items,
      subtotal: totals.subtotal,
      discount_percent: discountPercent,
      total: totals.total,
      notes: `${DEMO_NOTE_PREFIX} Invoice seeded for screenshots.`,
      payment_info: 'Bank transfer: PilotLight Home Services · Sort Code 20-11-62 · Account 12345678',
    };

    const { data, error } = await supabase.from('documents').insert(payload).select('*').single();
    if (error) throw error;
    inserted.push(data);
    counter += 1;
  }

  return { documents: inserted, nextInvoiceNumber: counter };
}

async function seedGasDocuments(supabase, companyId, customers, company, profile) {
  const inserted = [];

  for (let index = 0; index < 8; index += 1) {
    const customer = customers[index % customers.length];
    const type = gasTypes[index % gasTypes.length];
    const createdAt = addDays(new Date(), -20 + index * 3);
    const expiry = addDays(new Date(), 8 + index * 12);
    const reference = `PL-CERT-${pad(index + 1)}`;
    const label = type.replace('_', ' ');

    const payload = {
      company_id: companyId,
      type,
      number: Number(`52${pad(index + 1)}`),
      reference,
      date: iso(createdAt),
      expiry_date: iso(expiry),
      status: 'Sent',
      customer_id: customer.id,
      customer_snapshot: buildCustomerSnapshot(customer),
      items: [],
      subtotal: 0,
      discount_percent: 0,
      total: 0,
      notes: `${DEMO_NOTE_PREFIX} ${label} seeded for screenshot renewals.`,
      payment_info: JSON.stringify(buildSeededGasLockedPayload(type, customer, createdAt, expiry, reference, company, profile)),
    };

    const { data, error } = await supabase.from('documents').insert(payload).select('*').single();
    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (message.includes('type') || message.includes('check constraint') || message.includes('enum')) {
        const fallbackPayload = {
          ...payload,
          type: 'quote',
        };
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('documents')
          .insert(fallbackPayload)
          .select('*')
          .single();
        if (fallbackError) throw fallbackError;
        inserted.push(fallbackData);
        continue;
      }
      throw error;
    }

    inserted.push(data);
  }

  return inserted;
}

async function updateCompanyCounters(supabase, companyId, settings, counters) {
  const { error } = await supabase
    .from('companies')
    .update({
      settings: {
        ...settings,
        nextJobNumber: counters.nextJobNumber,
        nextInvoiceNumber: counters.nextInvoiceNumber,
        nextQuoteNumber: counters.nextQuoteNumber,
      },
    })
    .eq('id', companyId);

  if (error) throw error;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetEmail = String(args.email || TARGET_EMAIL).trim().toLowerCase();
  const { url, serviceRoleKey } = await requireEnv();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', targetEmail)
    .single();
  if (profileError || !targetProfile) {
    throw new Error(`Could not find a profile for ${targetEmail}.`);
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', targetProfile.company_id)
    .single();
  if (companyError || !company) {
    throw new Error(`Could not find company ${targetProfile.company_id} for ${targetEmail}.`);
  }

  console.log(`Seeding demo data for ${targetEmail}`);
  console.log(`Company: ${company.name} (${company.id})`);

  await cleanupPreviousDemoData(
    supabase,
    company.id,
    customerTemplates.map((customer) => customer.email),
  );

  const updatedSettings = await updateBranding(supabase, targetProfile, company);
  const workers = await seedWorkers(supabase, company.id);
  const customers = await seedCustomers(supabase, company.id);
  const jobResult = await seedJobs(
    supabase,
    company.id,
    targetProfile,
    workers,
    customers,
    Number(updatedSettings.nextJobNumber || 2001),
  );
  const quoteResult = await seedQuotes(
    supabase,
    company.id,
    customers,
    jobResult.jobs,
    Number(updatedSettings.nextQuoteNumber || 3101),
  );
  const invoiceResult = await seedInvoices(
    supabase,
    company.id,
    customers,
    jobResult.jobs,
    Number(updatedSettings.nextInvoiceNumber || 4101),
  );
  const gasDocuments = await seedGasDocuments(supabase, company.id, customers, company, targetProfile);

  await updateCompanyCounters(supabase, company.id, updatedSettings, {
    nextJobNumber: jobResult.nextJobNumber,
    nextQuoteNumber: quoteResult.nextQuoteNumber,
    nextInvoiceNumber: invoiceResult.nextInvoiceNumber,
  });

  console.log('');
  console.log('Demo seed complete');
  console.log(`- workers: ${workers.length}`);
  console.log(`- customers: ${customers.length}`);
  console.log(`- jobs: ${jobResult.jobs.length}`);
  console.log(`- quotes: ${quoteResult.documents.length}`);
  console.log(`- invoices: ${invoiceResult.documents.length}`);
  console.log(`- gas docs: ${gasDocuments.length}`);
  console.log('');
  console.log(`Worker test password: ${WORKER_PASSWORD}`);
}

main().catch((error) => {
  console.error('Demo seed failed');
  console.error(error.message || error);
  process.exitCode = 1;
});
