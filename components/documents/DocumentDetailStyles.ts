// ============================================
// FILE: components/documents/DocumentDetailStyles.ts
// Styles for the document detail screen
// ============================================

import {Platform, StyleSheet} from 'react-native';
import {Colors, UI} from '../../constants/theme';

export const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background, padding: 16},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: UI.surface.divider,
    marginBottom: 12,
  },
  backBtnText: {fontSize: 14, fontWeight: '600', color: UI.text.title},

  // Header card
  headerCard: {backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, ...Colors.shadow},
  headerTop: {flexDirection: 'row', alignItems: 'center', gap: 14},
  typeIcon: {width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center'},
  docType: {fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1},
  docNumber: {fontSize: 22, fontWeight: '800', color: Colors.text},
  statusBadgeLg: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8},
  statusTextLg: {fontSize: 12, fontWeight: '700'},
  headerMeta: {flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: UI.surface.elevated},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 13, color: Colors.textLight},

  // Sections
  section: {marginBottom: 16},
  sectionLabel: {fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4},
  card: {backgroundColor: '#fff', padding: 16, borderRadius: 12, ...Colors.shadow},

  // Detail rows (CP12)
  detailRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8},
  detailLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted, textTransform: 'uppercase'},
  detailText: {fontSize: 14, fontWeight: '500', color: Colors.text},
  divider: {height: 1, backgroundColor: UI.surface.elevated, marginVertical: 8},

  // Appliance rows (CP12)
  applianceRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8},
  applianceNum: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: UI.surface.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  applianceNumText: {fontSize: 12, fontWeight: '700', color: UI.brand.primary},
  applianceName: {fontSize: 14, fontWeight: '600', color: Colors.text},
  applianceLocation: {fontSize: 12, color: UI.text.muted, marginTop: 1},
  safetyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  safetyText: {fontSize: 11, fontWeight: '700'},

  // Date row (CP12)
  dateRow: {flexDirection: 'row', gap: 16},
  dateItem: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10},
  dateLabel: {fontSize: 11, fontWeight: '600', color: UI.text.muted, textTransform: 'uppercase'},
  dateValue: {fontSize: 15, fontWeight: '700', color: Colors.text},
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderTextWrap: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  reminderText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: UI.text.muted,
  },

  // Customer
  customerName: {fontSize: 16, fontWeight: '700', color: Colors.text},
  customerDetail: {fontSize: 14, color: UI.text.muted, marginTop: 2},

  // Line items
  itemRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10},
  itemDesc: {fontSize: 14, fontWeight: '600', color: Colors.text},
  itemMeta: {fontSize: 12, color: Colors.textLight, marginTop: 2},
  itemTotal: {fontSize: 14, fontWeight: '700', color: Colors.text},
  totalsDivider: {height: 2, backgroundColor: UI.text.title, marginVertical: 12},
  totalRow: {flexDirection: 'row', justifyContent: 'space-between'},
  totalLabel: {fontSize: 16, fontWeight: '700', color: Colors.text},
  totalValue: {fontSize: 20, fontWeight: '800', color: Colors.primary},

  notesText: {fontSize: 14, color: UI.text.bodyLight, lineHeight: 20},

  // Status
  statusGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: UI.surface.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipText: {fontSize: 13, fontWeight: '500', color: UI.text.muted},

  // Actions
  actionsSection: {gap: 12, marginTop: 8, marginBottom: 20},
  shareAction: {borderRadius: 14, overflow: 'hidden'},
  shareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  shareActionText: {color: UI.text.white, fontWeight: '700', fontSize: 15},
  duplicateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: UI.surface.primaryLight,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  duplicateActionText: {
    color: UI.brand.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  cp12ExtraActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secondaryActionText: {
    color: UI.brand.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteActionText: {color: Colors.danger, fontWeight: '600', fontSize: 14},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Colors.shadow,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: UI.text.muted,
  },
  modalLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: UI.text.body,
    textTransform: 'uppercase',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: UI.surface.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: UI.surface.base,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: UI.surface.elevated,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.text.body,
  },
  modalSendBtn: {
    minWidth: 88,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: UI.brand.primary,
  },
  modalSendText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.text.white,
  },
});
