// Synthetic fixtures only. Never load the private event roster into the public demo.
export const demoRoster = [
  ...Array.from({ length: 60 }, (_, i) => ({
    nrp: String(i + 1).padStart(6, '0'), fullName: `Penjelajah Demo ${i + 1}`,
    company: 'UT', plannedSize: i % 5 + 1, tableNumber: String(i % 20 + 1),
    source: 'excel' as const, drawEnabled: true,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    nrp: String(99000001 + i), fullName: `Peserta Sekolah Demo ${i + 1}`,
    company: 'UTS', plannedSize: 1, tableNumber: '21', source: 'uts' as const,
    drawEnabled: false,
  })),
];
