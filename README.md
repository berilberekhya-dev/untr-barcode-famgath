# UT Palembang — Family Gathering Space 8-bit

Aplikasi check-in melalui QR, pengelolaan kehadiran dan kupon, serta undian door prize untuk United Tractors Palembang. Tema space 8-bit dengan jargon **Terbang Melesat, Lanjakke Nian**.

## Fitur

- Peserta scan QR sekali, memasukkan NRP, melihat nama/perusahaan dari daftar awal, mengisi jumlah hadir, lalu memperoleh tiket dengan nomor meja.
- NRP disimpan sebagai teks, hanya menerima angka, dan unik per acara. Jumlah hadir termasuk karyawan itu sendiri.
- Jumlah di atas rencana memerlukan konfirmasi; kupon makanan dan kursi dasar dibatasi jumlah yang terdaftar dan benar-benar hadir. Panitia dapat mengalokasikan sisa kupon secara terpisah.
- Daftar door prize terpisah dari check-in. Peserta UTS tidak masuk undian. Panitia dapat mengubah keikutsertaan dan mencatat kehadiran.
- Undian satu sampai lima peserta sekaligus, gambar/nama hadiah, pengguguran, penggantian slot dalam sesi yang sama, dan pencatatan hadiah yang sudah diambil.
- Pemilihan memakai Node.js crypto.randomInt tanpa bobot tersembunyi atau peserta berulang. Hasil disimpan dalam transaksi sebelum animasi gulungan nama.
- Layar proyektor menampilkan hadiah dan gulungan serentak. Rekap seluruh pemenang dibuka panitia setelah target terpenuhi.
- Kontrol bisu dan volume ada di `/panitia/doorprize`. Klik **Simpan volume** untuk mengirim perubahan ke layar proyektor. Jika browser menahan autoplay, klik **Layar penuh** sekali di layar proyektor untuk memulai audio.
- Untuk audio khusus acara, sediakan `champions-anthem.mp3`, `drum-roll.mp3`, dan `brass-reveal-6-9.mp3` di `public/audio/event/` sebelum build. Folder ini diabaikan oleh Git dan ikut dalam deployment melalui Vercel CLI. Build tanpa ketiga file memakai klip CC0 di `public/audio/`.
- Ekspor PDF A4 landscape, polling dua detik, font lokal, navigasi keyboard, dan dukungan pengurangan animasi.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL melalui node-postgres untuk Supabase, SQLite/libSQL untuk lokal, jsPDF + AutoTable, Vitest, dan Playwright. Versi dependensi dikunci melalui package-lock.json.

## Menjalankan demo

Gunakan Node.js dan npm:

```powershell
npm ci
npm run setup:local
npm run build
npm run demo
```

Buka http://localhost:3001. Password panitia dibuat secara acak oleh setup:local dan tersimpan di ADMIN_PASSWORD pada .env.local. Setup tidak menimpa konfigurasi yang sudah ada.

Demo memakai **data sintetis**, disimpan terpisah di data/demo-synthetic-v1.db: NRP 000001–000060 untuk karyawan dan 99000001–99000006 untuk peserta sekolah. Seluruh nama dibuat sebagai contoh; data peserta acara tidak dibutuhkan untuk mencoba aplikasi. Check-in tidak dibuat otomatis.

| Halaman | Fungsi |
| --- | --- |
| /daftar | Check-in peserta dan tiket |
| /layar/registrasi | QR registrasi untuk stand |
| /panitia | Kehadiran, kupon, PDF, dan pengaturan acara |
| /panitia?view=roster | Daftar awal dan peserta undian |
| /panitia/doorprize | Kontrol hadiah, undian, gugur, dan pengambilan |
| /layar/doorprize | Tampilan proyektor |

Untuk pengujian HP, gunakan jaringan yang sama dan atur APP_BASE_URL ke alamat LAN laptop. Server LAN memakai npm run dev:lan atau npm run start:lan. Demo memakai port 3001 pada hostname yang sama. Penggunaan laptop sebagai server ditujukan untuk pengujian lokal.

## Data acara privat

Repository ini hanya memuat kode dan contoh sintetis. Kredensial, data peserta asli, workbook sumber, database, backup, laporan, screenshot operasional, dan metadata migrasi tidak disertakan.

Siapkan daftar peserta sebagai JSON privat. Struktur contoh tersedia di examples/roster.example.json. Simpan NRP dalam bentuk string agar nol di depan tetap ada. plannedSize sudah termasuk karyawan. source bernilai excel atau uts; UTS harus memiliki drawEnabled: false.

Impor daftar privat ke database acara lokal:

```powershell
npm run db:migrate
npm run db:import -- --source=data/roster-source.json
```

Impor biasa menambah NRP baru dan memperbarui pemetaan meja tanpa menimpa keputusan panitia. Opsi --refresh-official memperbarui identitas resmi, sambil mempertahankan pengeluaran dari undian, catatan, check-in, dan riwayat. Jangan mengimpor contoh sintetis ke database acara produksi.

Jumlah yang lebih sedikit dari rencana dicatat sebagai selisih. Panitia menentukan alokasi kupon sisa; alokasi tambahan tidak menambah jatah kursi. Tiket menampilkan jumlah keluarga, jumlah hadir, kelebihan peserta berwarna merah, kupon, kursi, dan nomor meja. Nomor meja tiket baru disimpan sebagai snapshot.

## Konfigurasi server

Lihat .env.example. Isi konfigurasi lokal dalam .env.local; file tersebut diabaikan Git.

| Variabel | Kegunaan |
| --- | --- |
| DATABASE_URL | file:data/event-v2.db untuk lokal; URI PostgreSQL Supabase untuk online |
| ADMIN_PASSWORD | Password panitia, diatur sendiri oleh pemilik deployment |
| SESSION_SECRET | Nilai acak minimal 32 karakter untuk tanda tangan sesi |
| APP_BASE_URL | Alamat aplikasi untuk QR; gunakan domain HTTPS final ketika online |
| DATABASE_AUTH_TOKEN | Opsional, khusus adapter libSQL/Turso |
| DATABASE_SSL_CA | Opsional, PEM CA privat untuk penyedia PostgreSQL selain Supabase |

Jangan memakai awalan NEXT_PUBLIC_ untuk kredensial. Cookie panitia HttpOnly, SameSite=Lax, berlaku 12 jam, dan Secure pada Vercel. API administratif memerlukan sesi dan mutasi memeriksa origin. Halaman publik tidak memberikan daftar NRP atau kunci internal.

## Deployment Vercel + Supabase

1. Buat proyek Supabase khusus aplikasi. Dari Connect, salin URI **Transaction pooler**, termasuk hostname/username persis dari dashboard. Isi password database yang sudah di-URL-encode.
2. Simpan konfigurasi cloud di file lokal privat, misalnya .env.supabase.local. Isi DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, dan APP_BASE_URL. Jangan commit file tersebut.
3. Buat schema dan impor daftar privat. UT_ENV_FILE memilih konfigurasi terpisah dari pengujian lokal:

```powershell
$env:UT_ENV_FILE='.env.supabase.local'
npm run db:migrate
npm run db:import -- --source=data/roster-source.json
Remove-Item Env:UT_ENV_FILE
```

Untuk memindahkan seluruh data SQLite yang sudah ada, cadangkan sumber, lalu gunakan db:transfer **sebagai pengganti db:import**. Tujuan harus kosong:

```powershell
$env:UT_ENV_FILE='.env.supabase.local'
npm run db:transfer -- --source=file:data/event-v2.db
npm run db:verify:supabase
Remove-Item Env:UT_ENV_FILE
```

Transfer memverifikasi jumlah dan isi baris sebelum commit, mempertahankan data sumber, dan menolak menimpa database tujuan yang sudah berisi data acara.

4. Impor repository ke Vercel, pilih Next.js, dan gunakan npm run build. Isi environment Production: DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, dan APP_BASE_URL. Preview menggunakan database pengujian terpisah. File lokal .db dan daftar peserta tidak perlu diunggah.
5. Verifikasi QR, login panitia, dan alur aplikasi pada deployment. Gunakan database uji untuk percobaan check-in/undian. Jangan mereset data acara untuk pengujian.

Schema PostgreSQL ut_gathering tidak memerlukan Data API browser. Seluruh tabel memakai RLS dan akses anon/authenticated ditolak. Server memakai satu koneksi per instance, transaksi dengan advisory lock untuk operasi tulis lintas instance, serta snapshot REPEATABLE READ untuk pembacaan.

TLS memverifikasi sertifikat dan hostname. CA publik resmi Supabase dibundel di src/lib/supabase-ca.ts; sertifikat tersebut bukan private key. Konfigurasi ini berlaku untuk hostname database/pooler Supabase. DATABASE_URL file: ditolak pada Vercel.

Backup produksi memakai pg_dump atau fasilitas backup Supabase yang sesuai. PDF merupakan laporan, bukan backup database penuh.

## Pengujian

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:postgres
npm run test:postgres -- --e2e
```

Tes browser memerlukan Google Chrome. Semua fixture bersifat sintetis. Tes PostgreSQL menjalankan cluster sementara di loopback 127.0.0.1:55432; setiap tes memakai database tersendiri, lalu server berhenti setelah selesai. Tes tidak memakai kredensial cloud atau data acara.

## Aset dan merek

Pixel art antariksa dibuat dalam komponen aplikasi. Logo United Tractors dan identitas ASTRA merupakan merek pemiliknya masing-masing; sumber aset dicatat di public/brand/README.md. Publikasi kode ini tidak memberikan hak atas merek atau logo tersebut.
