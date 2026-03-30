// ============================================
// FILE: src/services/pdf/index.ts
// Barrel export for shared PDF infrastructure
//
// Importing this barrel registers all form-type
// PDF generators in the polymorphic registry.
// Add new generators here as they're implemented.
// ============================================

// ─── Register all generators (side-effect imports) ──────────────
// Each generator calls registerFormPdf() at module scope.
// These imports MUST come before any registry usage.
import '../breakdownReportPdfGenerator';
import '../commissioningPdfGenerator';
import '../cp12PdfGenerator';
import '../decommissioningPdfGenerator';
import '../installationCertPdfGenerator';
import '../serviceRecordPdfGenerator';
import '../warningNoticePdfGenerator';

// Core shared utilities, types, and HTML builders
export {
    checkInH,
    combineNotes,
    // Helpers
    esc, generatePdfBase64FromPayload, generatePdfFromPayload, generatePdfUrlFromPayload,
    // CSS
    getBaseCss,
    // Data fetching
    getCompanyAndEngineer, getCompanyLogoSrc, getGasSafeLogoBase64, getLatestCompanyLogoUrl, parseAddress,
    // PDF output
    printHtmlToPdf,
    printHtmlToPdfBase64,
    // Generic lifecycle
    resolveAndBuildHtml, shareHtmlAsPdf, tickH, type BaseLockedPayload,
    // Types
    type CompanyInfo,
    type EngineerInfo
} from './shared';

// Polymorphic registry
export {
    generateRegisteredPdf,
    generateRegisteredPdfBase64,
    generateRegisteredPdfUrl, getDocumentFileName, getFormPdfRegistration,
    getRegisteredKinds,
    parseLockedPayload, registerFormPdf
} from './registry';

