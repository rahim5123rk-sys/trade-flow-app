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
import '../cp12PdfGenerator';
import '../serviceRecordPdfGenerator';

// Core shared utilities, types, and HTML builders
export {

    // HTML builders
    buildHeaderHtml,
    buildSignatureFooterHtml,
    buildWarningFooterHtml, checkInH,
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
    type EngineerInfo, type PdfHeaderData,
    type PdfSignatureFooterData
} from './shared';

// Polymorphic registry
export {
    generateRegisteredPdf,
    generateRegisteredPdfBase64,
    generateRegisteredPdfUrl, getFormPdfRegistration,
    getRegisteredKinds,
    parseLockedPayload, registerFormPdf
} from './registry';

