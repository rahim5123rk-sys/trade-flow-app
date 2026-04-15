import {
    type CompanyInfo,
    type EngineerInfo,
    esc,
    getBaseCss,
  parseAddress,
} from './shared';

interface DetailRow {
  label: string;
  value: string;
}

interface DetailSection {
  title: string;
  rows: DetailRow[];
}

interface BuildSingleApplianceFormHtmlArgs {
  title: string;
  description: string;
  accentColor: string;
  ref: string;
  company: CompanyInfo;
  engineer: EngineerInfo;
  gasSafeLogoBase64?: string;
  companyLogoSrc?: string;
  customerName: string;
  customerCompany?: string;
  customerAddress: string;
  customerEmail?: string;
  customerPhone?: string;
  propertyAddress: string;
  primaryDateLabel: string;
  primaryDate: string;
  secondaryDateLabel?: string;
  secondaryDate?: string;
  applianceHeading: string;
  applianceSummary: DetailRow[];
  applianceSections: DetailSection[];
  finalSections: DetailSection[];
  customerSignature?: string;
  footerNote: string;
}

const renderRows = (rows: DetailRow[]) => rows.map((row) => `
  <tr>
    <td class="label-cell">${esc(row.label)}</td>
    <td class="value-cell">${esc(row.value || '—')}</td>
  </tr>
`).join('');

const renderSectionTable = (section: DetailSection) => `
  <table class="mt">
    <tr><td class="shdr" colspan="2">${esc(section.title)}</td></tr>
    ${renderRows(section.rows)}
  </table>
`;

const renderSectionCard = (section: DetailSection) => `
  <table>
    <tr><td class="shdr" colspan="2">${esc(section.title)}</td></tr>
    ${renderRows(section.rows)}
  </table>
`;

const pairSections = (sections: DetailSection[]): Array<[DetailSection, DetailSection | null]> => {
  const pairs: Array<[DetailSection, DetailSection | null]> = [];
  for (let index = 0; index < sections.length; index += 2) {
    pairs.push([sections[index], sections[index + 1] || null]);
  }
  return pairs;
};

export function buildSingleApplianceFormHtml({
  title,
  description,
  accentColor,
  ref,
  company,
  engineer,
  gasSafeLogoBase64 = '',
  companyLogoSrc = '',
  customerName,
  customerCompany,
  customerAddress,
  customerEmail,
  customerPhone,
  propertyAddress,
  primaryDateLabel,
  primaryDate,
  secondaryDateLabel,
  secondaryDate,
  applianceHeading,
  applianceSummary,
  applianceSections,
  finalSections,
  customerSignature,
  footerNote,
}: BuildSingleApplianceFormHtmlArgs): string {
  const customerAddressParts = parseAddress(customerAddress);
  const propertyAddressParts = parseAddress(propertyAddress);
  const allSections = [...applianceSections, ...finalSections];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${getBaseCss()}
  html, body { max-height: 210mm; overflow: hidden; }
  .page { max-height: 210mm; overflow: hidden; page-break-after: avoid; padding: 2.5mm; }
  .hero-title { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; color: #fff; }
  .hero-body { font-size: 5.5pt; color: #E2E8F0; line-height: 1.5; }
  .ref-chip { font-size: 9pt; font-weight: 800; color: #fff; }
  .label-cell { font-size: 5pt; width: 34%; padding: 1.5px 4px; }
  .value-cell { font-size: 5.5pt; padding: 1.5px 4px; }
  .shdr { font-size: 6pt; padding: 2.5px 5px; }
  td, th { padding: 1.5px 4px; }
  .compact td, .compact th { padding-top: 1px; padding-bottom: 1px; }
  .note-box { margin-top: 8px; font-size: 5.4pt; line-height: 1.35; }
  .sig-img { max-width: 100%; max-height: 36px; object-fit: contain; }
  .summary-wrap td { padding: 0; vertical-align: top; }
  .section-pair td { padding: 0; vertical-align: top; }
  .section-gap { padding: 0 2px !important; }
  .muted-fill { background: #fff; }
</style>
</head>
<body>
<div class="page">
  <table>
    <tr>
      <td style="width:13%;padding:5px 8px;vertical-align:middle;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);">
        ${companyLogoSrc ? `<img src="${companyLogoSrc}" style="max-height:42px;max-width:124px;display:block;" />` : '<div style="height:42px;"></div>'}
      </td>
      <td style="text-align:center;padding:5px 8px;vertical-align:middle;background:linear-gradient(135deg,#334155 0%,#475569 100%);">
        <div class="hero-title">${esc(title)}</div>
        <div class="hero-body">${esc(description)}</div>
      </td>
      <td style="width:13%;text-align:center;padding:5px 8px;vertical-align:middle;background:linear-gradient(135deg,#334155 0%,#1e293b 100%);">
        ${gasSafeLogoBase64 ? `<img src="${gasSafeLogoBase64}" style="height:46px;max-width:116px;display:block;margin:0 auto 3px;" />` : ''}
        <div style="font-size:5pt;color:#CBD5E1;margin-top:2px;text-transform:uppercase;letter-spacing:0.3px;">Record Ref</div>
        <div class="ref-chip">${esc(ref)}</div>
        <div style="font-size:5pt;color:#CBD5E1;margin-top:3px;text-transform:uppercase;letter-spacing:0.3px;">${esc(primaryDateLabel)}</div>
        <div style="font-size:8pt;font-weight:800;color:#fff;">${esc(primaryDate)}</div>
      </td>
    </tr>
  </table>

  <table class="mt">
    <tr>
      <td style="width:33.33%;padding:0;vertical-align:top;">
        <table>
          <tr><td class="shdr" colspan="2">Engineer &amp; Company Details</td></tr>
          <tr><td class="label-cell">Engineer Name</td><td class="value-cell">${esc(engineer.name)}</td></tr>
          <tr><td class="label-cell">Company</td><td class="value-cell">${esc(company.name)}</td></tr>
          <tr><td class="label-cell">Address</td><td class="value-cell">${esc(company.address).replace(/\n/g, ', ')}</td></tr>
          <tr><td class="label-cell">Phone</td><td class="value-cell">${esc(company.phone)}</td></tr>
          <tr><td class="label-cell">Gas Safe Reg.</td><td class="value-cell">${esc(engineer.gasSafeNumber)}</td></tr>
          <tr><td class="label-cell">ID Card No.</td><td class="value-cell">${esc(engineer.gasLicenceNumber)}</td></tr>
          <tr><td class="label-cell">Email</td><td class="value-cell">${esc(company.email)}</td></tr>
        </table>
      </td>
      <td style="width:33.34%;padding:0 2px;vertical-align:top;">
        <table>
          <tr><td class="shdr" colspan="2">Property Details</td></tr>
          <tr><td class="label-cell">Name</td><td class="value-cell">${esc(customerName)}</td></tr>
          <tr>
            <td class="label-cell" rowspan="2" style="vertical-align:top;border-bottom:none;">Address</td>
            <td class="value-cell" style="border-bottom:none;">${esc(propertyAddressParts.line1)}</td>
          </tr>
          <tr><td class="value-cell" style="border-top:none;min-height:12px;">${esc(propertyAddressParts.line2)}&nbsp;</td></tr>
          <tr><td class="label-cell">City</td><td class="value-cell">${esc(propertyAddressParts.city)}</td></tr>
          <tr><td class="label-cell">Postcode</td><td class="value-cell">${esc(propertyAddressParts.postcode)}</td></tr>
          <tr><td class="label-cell">&nbsp;</td><td class="value-cell">&nbsp;</td></tr>
        </table>
      </td>
      <td style="width:33.33%;padding:0;vertical-align:top;">
        <table>
          <tr><td class="shdr" colspan="2">Customer Details</td></tr>
          <tr><td class="label-cell">Name</td><td class="value-cell">${esc(customerName)}</td></tr>
          <tr><td class="label-cell">Company</td><td class="value-cell">${esc(customerCompany || '')}</td></tr>
          <tr>
            <td class="label-cell" rowspan="2" style="vertical-align:top;border-bottom:none;">Address</td>
            <td class="value-cell" style="border-bottom:none;">${esc(customerAddressParts.line1)}</td>
          </tr>
          <tr><td class="value-cell" style="border-top:none;min-height:12px;">${esc(customerAddressParts.line2)}&nbsp;</td></tr>
          <tr><td class="label-cell">City</td><td class="value-cell">${esc(customerAddressParts.city)}</td></tr>
          <tr><td class="label-cell">Postcode</td><td class="value-cell">${esc(customerAddressParts.postcode)}</td></tr>
          <tr><td class="label-cell">Email</td><td class="value-cell">${esc(customerEmail || '')}</td></tr>
          <tr><td class="label-cell">Phone</td><td class="value-cell">${esc(customerPhone || '')}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="mt compact">
    <tr><td class="shdr" colspan="4">${esc(applianceHeading)}</td></tr>
    ${pairSections(applianceSummary.map((row) => ({title: '', rows: [row]})) as any).map(([left, right]) => {
      const leftRow = left.rows[0];
      const rightRow = right?.rows?.[0] || null;
      return `<tr>
        <td class="label-cell">${esc(leftRow.label)}</td>
        <td class="value-cell">${esc(leftRow.value || '—')}</td>
        <td class="label-cell">${esc(rightRow?.label || '')}</td>
        <td class="value-cell">${esc(rightRow?.value || '')}</td>
      </tr>`;
    }).join('')}
  </table>

  ${pairSections(allSections).map(([left, right]) => `
    <table class="mt section-pair">
      <tr>
        <td style="width:50%;padding:0;vertical-align:top;">${renderSectionCard(left)}</td>
        <td class="section-gap" style="width:50%;padding:0 0 0 2px;vertical-align:top;">${right ? renderSectionCard(right) : '<table><tr><td class="shdr" colspan="2">&nbsp;</td></tr><tr><td class="muted-fill" style="height:100%;border:none;" colspan="2">&nbsp;</td></tr></table>'}</td>
      </tr>
    </table>
  `).join('')}

  <table class="mt">
    <tr>
      <th colspan="2" class="sig-hdr" style="text-align:center;width:33.33%;">Engineer</th>
      <th colspan="2" class="sig-hdr" style="text-align:center;width:33.33%;">Customer</th>
      <td class="shdr" style="width:33.34%;">Date &amp; Next Due</td>
    </tr>
    <tr>
      <th class="sig-hdr" style="width:7%;">Signature</th>
      <td style="height:38px;text-align:center;">${company.signatureBase64 ? `<img src="${company.signatureBase64}" class="sig-img" />` : ''}</td>
      <th class="sig-hdr" style="width:7%;">Signature</th>
      <td style="height:38px;text-align:center;">${customerSignature ? `<img src="${customerSignature}" class="sig-img" />` : ''}</td>
      <td rowspan="3" class="next-due">
        <span class="date-box-label">${esc(primaryDateLabel)}</span>
        ${esc(primaryDate)}
        ${secondaryDateLabel ? `<br/><span class="next-due-label" style="margin-top:6px;">${esc(secondaryDateLabel)}</span>${esc(secondaryDate || '')}` : ''}
      </td>
    </tr>
    <tr>
      <th class="sig-hdr">Print Name</th>
      <td>${esc(engineer.name)}</td>
      <th class="sig-hdr">Print Name</th>
      <td>${esc(customerName)}</td>
    </tr>
    <tr>
      <th class="sig-hdr">Date</th>
      <td>${esc(primaryDate)}</td>
      <th class="sig-hdr">Date</th>
      <td>${esc(primaryDate)}</td>
    </tr>
  </table>

  <div class="warn note-box">${esc(footerNote)}</div>
</div>
</body>
</html>`;
}
