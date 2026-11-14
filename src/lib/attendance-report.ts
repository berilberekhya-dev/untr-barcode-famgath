import writeXlsxFile, { type CellObject, type SheetData } from 'write-excel-file/node';
import type { AdminState } from './types';

const wibOffset = 7 * 60 * 60 * 1000;
const excelDate = (timestamp: number): CellObject => ({
  value: new Date(timestamp + wibOffset), type: Date, format: 'dd/mm/yyyy hh:mm:ss',
});

export async function buildAttendanceReport({ event, serverTime, roster, registrations, stats }:
  Pick<AdminState, 'event' | 'serverTime' | 'roster' | 'registrations' | 'stats'>) {
  const checkIns = new Map(registrations.map(checkIn => [checkIn.nrp, checkIn]));
  const participants = roster.filter(entry => entry.plannedSize > 0 || checkIns.has(entry.nrp));
  const headings = ['NRP', 'Nama lengkap', 'Perusahaan', 'Status check-in', 'Jumlah keluarga', 'Jumlah hadir', 'Selisih',
    'Kupon makan', 'Kursi', 'Nomor meja', 'Waktu check-in (WIB)'];

  const sheet: SheetData = [
    [{ value: `Rekap kehadiran | ${event.title}${event.demo ? ' (Demo)' : ''}`,
      fontWeight: 'bold', fontSize: 14, textColor: '#14204A', height: 25 }],
    ['Data per (WIB)', excelDate(serverTime)],
    ['Peserta terdaftar', participants.length, 'Sudah check-in', stats.employees, 'Total orang hadir', stats.people],
    [],
    headings.map(value => ({ value, fontWeight: 'bold', align: 'center', alignVertical: 'center',
      backgroundColor: '#14204A', textColor: '#FFFFFF', height: 21 })),
    ...participants.map(entry => {
      const checkIn = checkIns.get(entry.nrp);
      const planned = checkIn?.plannedSize ?? entry.plannedSize;
      return [
        { value: entry.nrp, type: String }, checkIn?.fullName ?? entry.fullName, checkIn?.company ?? entry.company,
        checkIn ? 'Sudah check-in' : 'Belum check-in', planned, checkIn?.partySize,
        checkIn && checkIn.partySize - planned, checkIn?.couponCount, checkIn?.seatCount,
        checkIn?.tableNumber ?? entry.tableNumber, checkIn && excelDate(checkIn.createdAt),
      ];
    }),
  ];
  return writeXlsxFile(sheet, {
    sheet: 'Kehadiran', stickyRowsCount: 5, showGridLines: false,
    columns: [22, 34, 23, 20, 20, 15, 12, 14, 10, 15, 25].map(width => ({ width })),
  }).toBuffer();
}
