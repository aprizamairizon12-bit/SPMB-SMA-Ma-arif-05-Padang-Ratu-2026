import schoolLogoImg from './assets/images/school_logo_maarif_1791730766871.jpg';
import heroSchoolBuildingImg from './assets/images/hero_school_building_1791730780492.jpg';
import facilityLabImg from './assets/images/facility_classroom_lab_1791730798364.jpg';
import activityStudentsImg from './assets/images/activity_students_extracurricular_1791730812575.jpg';

export const ASSETS = {
  schoolLogo: schoolLogoImg,
  heroBuilding: heroSchoolBuildingImg,
  facilityLab: facilityLabImg,
  activityStudents: activityStudentsImg,
};

export type ApplicantStatus =
  | 'Menunggu verifikasi'
  | 'Perlu perbaikan data'
  | 'Terverifikasi'
  | 'Diterima'
  | 'Tidak diterima';

export type AdminRole =
  | 'Super Admin'
  | 'Admin SPMB'
  | 'Panitia SPMB'
  | 'Kepala Sekolah';

export type SchoolItemCategory =
  | 'program'
  | 'facility'
  | 'extracurricular'
  | 'achievement'
  | 'gallery'
  | 'custom_field'
  | 'doc_requirement';

export interface SchoolConfig {
  officialName: string;
  shortName: string;
  npsn: string;
  address: string;
  village: string;
  district: string;
  regency: string;
  province: string;
  postalCode: string;
  phone: string;
  whatsapp: string;
  email: string;
  principalName: string;
  principalNip: string;
  committeeHeadName: string;
  logoUrl: string;
  heroBannerUrl: string;
  history: string;
  vision: string;
  mission: string;
  mapUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  activeYearLabel: string;
  isRegistrationOpen: boolean;
  openDate: string;
  closeDate: string;
  announcementDate: string;
  updatedAt?: unknown;
}

export interface AcademicYear {
  id: string;
  yearLabel: string;
  isActive: boolean;
  isPublicDisplay: boolean;
  registrationStatus: 'open' | 'closed' | 'scheduled';
  openDate: string;
  closeDate: string;
  announcementDate: string;
  quota: number;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolItem {
  id: string;
  category: SchoolItemCategory;
  title: string;
  description: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  isRequired: boolean;
  fieldType: string;
  maxSizeKb: number;
  academicYear: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
  publishDate: string;
  isPublished: boolean;
  academicYear: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Applicant {
  id: string;
  regNumber: string;
  academicYear: string;
  fullName: string;
  nik: string;
  nisn: string;
  gender: 'Laki-laki' | 'Perempuan';
  birthPlace: string;
  birthDate: string;
  religion: string;
  address: string;
  village: string;
  district: string;
  regency: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  fatherName: string;
  fatherJob: string;
  fatherPhone: string;
  motherName: string;
  motherJob: string;
  motherPhone: string;
  guardianName: string;
  guardianJob: string;
  parentAddress: string;
  previousSchool: string;
  previousSchoolNpsn: string;
  previousSchoolAddress: string;
  graduationYear: string;
  certificateNumber: string;
  customDataSummary: string;
  status: ApplicantStatus;
  verificationNotes: string;
  docCompleteCount: number;
  docTotalRequired: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ApplicantStatusLookup {
  id: string;
  applicantId: string;
  regNumber: string;
  academicYear: string;
  fullName: string;
  nisn: string;
  birthDate: string;
  previousSchool: string;
  status: ApplicantStatus;
  verificationNotes: string;
  docCompleteCount: number;
  docTotalRequired: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ApplicantDocument {
  id: string;
  applicantId: string;
  regNumber: string;
  academicYear: string;
  docType: string;
  docLabel: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  fileDataUrl: string;
  verificationStatus: 'Menunggu' | 'Valid' | 'Perlu Perbaikan';
  adminNote: string;
  uploadedAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminUser {
  uid: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetId: string;
  details: string;
  academicYear: string;
  createdAt?: unknown;
}

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  officialName: "SMA Ma'arif 05 Padang Ratu",
  shortName: "SMA Ma'arif 05",
  npsn: '10802055',
  address: 'Jl. Raya Padang Ratu Komplek Pendidikan LP Ma\'arif NU',
  village: 'Padang Ratu',
  district: 'Padang Ratu',
  regency: 'Kabupaten Lampung Tengah',
  province: 'Lampung',
  postalCode: '34176',
  phone: '(0725) 528105',
  whatsapp: '0812-7905-2027',
  email: 'spmb@smamaarif05padangratu.sch.id',
  principalName: 'Drs. H. Ahmad Syafii, M.Pd.I.',
  principalNip: '19720415 200112 1 002',
  committeeHeadName: 'M. Ridwan Hasan, S.Pd., Gr.',
  logoUrl: ASSETS.schoolLogo,
  heroBannerUrl: ASSETS.heroBuilding,
  history:
    "SMA Ma'arif 05 Padang Ratu didirikan di bawah naungan Lembaga Pendidikan Ma'arif Nahdlatul Ulama (LP Ma'arif NU) Kabupaten Lampung Tengah sebagai wujud komitmen mencetak generasi intelektual yang berakhlakul karimah, menguasai ilmu pengetahuan dan teknologi, serta berpegang teguh pada nilai-nilai Ahlussunnah wal Jama'ah An-Nahdliyah.",
  vision:
    "Terwujudnya lulusan SMA Ma'arif 05 Padang Ratu yang Beriman, Berilmu, Beramal, Unggul dalam Prestasi Akademik maupun Non-Akademik, serta Berdaya Saing di Era Digital berlandaskan Akhlakul Karimah.",
  mission:
    "1. Menyelenggarakan pendidikan menengah berkualitas yang memadukan Kurikulum Nasional dengan penguatan karakter Aswaja.\n2. Mengembangkan potensi akademik, riset sains, literasi digital, dan kecakapan hidup (life skills) peserta didik.\n3. Membina kegiatan ekstrakurikuler olahraga, seni, pramuka, dan tahfidz Al-Qur'an secara terarah.\n4. Mewujudkan tata kelola sekolah yang transparan, ramah anak, dan bebas pungutan biaya pendaftaran (Gratis 100%).",
  mapUrl: 'https://maps.google.com/?q=Padang+Ratu+Lampung+Tengah',
  facebookUrl: 'https://facebook.com/smamaarif05padangratu',
  instagramUrl: 'https://instagram.com/smamaarif05padangratu',
  youtubeUrl: 'https://youtube.com/@smamaarif05padangratu',
  activeYearLabel: '2027/2028',
  isRegistrationOpen: true,
  openDate: '2027-01-15',
  closeDate: '2027-07-10',
  announcementDate: '2027-07-15',
};

export const DEFAULT_ACADEMIC_YEARS: Omit<AcademicYear, 'createdAt' | 'updatedAt'>[] = [
  {
    id: '2027-2028',
    yearLabel: '2027/2028',
    isActive: true,
    isPublicDisplay: true,
    registrationStatus: 'open',
    openDate: '2027-01-15',
    closeDate: '2027-07-10',
    announcementDate: '2027-07-15',
    quota: 180,
    notes: 'Periode Penerimaan Murid Baru Tahun Ajaran 2027/2028 (Pendaftaran Gratis 100%).',
  },
  {
    id: '2026-2027',
    yearLabel: '2026/2027',
    isActive: false,
    isPublicDisplay: false,
    registrationStatus: 'closed',
    openDate: '2026-01-15',
    closeDate: '2026-07-10',
    announcementDate: '2026-07-15',
    quota: 160,
    notes: 'Arsip Penerimaan Murid Baru Tahun Ajaran 2026/2027.',
  },
];

export const DEFAULT_SCHOOL_ITEMS: Omit<SchoolItem, 'createdAt' | 'updatedAt'>[] = [
  // Featured Programs
  {
    id: 'prog-1',
    category: 'program',
    title: 'Kelas Unggulan Sains & Riset Terapan (MIPA)',
    description: 'Pembinaan olimpiade sains, praktikum laboratorium terpadu, dan persiapan masuk Perguruan Tinggi Negeri.',
    imageUrl: ASSETS.facilityLab,
    order: 1,
    isActive: true,
    isRequired: false,
    fieldType: 'program',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'prog-2',
    category: 'program',
    title: 'Program Tahfidz Al-Qur\'an & Kajian Kitab Turats',
    description: 'Bimbingan hafalan Al-Qur\'an bersanad, penguatan akhlak Aswaja, serta kecakapan dakwah dan bahasa Arab.',
    imageUrl: ASSETS.activityStudents,
    order: 2,
    isActive: true,
    isRequired: false,
    fieldType: 'program',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'prog-3',
    category: 'program',
    title: 'Literasi Digital, Coding & Kewirausahaan Muda',
    description: 'Pelatihan komputer terapan, desain grafis, pemrograman web dasar, dan kewirausahaan berbasis produk lokal.',
    imageUrl: ASSETS.facilityLab,
    order: 3,
    isActive: true,
    isRequired: false,
    fieldType: 'program',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  // Facilities
  {
    id: 'fac-1',
    category: 'facility',
    title: 'Gedung Kampus Representatif & Masjid Sekolah',
    description: 'Ruang belajar nyaman dengan sirkulasi udara alami, taman hijau, serta masjid sekolah untuk ibadah berjamaah.',
    imageUrl: ASSETS.heroBuilding,
    order: 1,
    isActive: true,
    isRequired: false,
    fieldType: 'facility',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'fac-2',
    category: 'facility',
    title: 'Laboratorium Komputer & Sains Terpadu',
    description: 'Dilengkapi perangkat komputer terkoneksi internet fiber optik serta peralatan praktikum Fisika, Kimia, dan Biologi.',
    imageUrl: ASSETS.facilityLab,
    order: 2,
    isActive: true,
    isRequired: false,
    fieldType: 'facility',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'fac-3',
    category: 'facility',
    title: 'Perpustakaan Digital & Ruang Diskusi',
    description: 'Koleksi ribuan buku pelajaran, literatur Islam, jurnal ilmiah, dan ruang baca kolaboratif ber-AC.',
    imageUrl: ASSETS.activityStudents,
    order: 3,
    isActive: true,
    isRequired: false,
    fieldType: 'facility',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  // Extracurriculars
  {
    id: 'eks-1',
    category: 'extracurricular',
    title: 'Pramuka & Paskibra Ma\'arif',
    description: 'Pembentukan kedisiplinan, kepemimpinan, dan ketangkasan baris-berbaris tingkat kabupaten dan provinsi.',
    imageUrl: ASSETS.heroBuilding,
    order: 1,
    isActive: true,
    isRequired: false,
    fieldType: 'extracurricular',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'eks-2',
    category: 'extracurricular',
    title: 'Karya Ilmiah Remaja (KIR) & Klub Olimpiade',
    description: 'Wadah riset ilmiah murid untuk kompetisi OSN, KSM, dan lomba inovasi pelajar.',
    imageUrl: ASSETS.facilityLab,
    order: 2,
    isActive: true,
    isRequired: false,
    fieldType: 'extracurricular',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'eks-3',
    category: 'extracurricular',
    title: 'Seni Hadroh, Tilawah & Olahraga Prestasi',
    description: 'Pengembangan bakat seni Islami, futsal, bola voli, dan pencak silat Pagar Nusa.',
    imageUrl: ASSETS.activityStudents,
    order: 3,
    isActive: true,
    isRequired: false,
    fieldType: 'extracurricular',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  // Achievements
  {
    id: 'ach-1',
    category: 'achievement',
    title: 'Juara 1 Olimpiade Sains LP Ma\'arif Tingkat Provinsi Lampung',
    description: 'Diraih oleh tim sains SMA Ma\'arif 05 Padang Ratu pada bidang Matematika dan Biologi Terintegrasi.',
    imageUrl: ASSETS.facilityLab,
    order: 1,
    isActive: true,
    isRequired: false,
    fieldType: 'achievement',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'ach-2',
    category: 'achievement',
    title: 'Juara Umum Lomba Pramuka Penegak Kabupaten Lampung Tengah',
    description: 'Penghargaan atas ketangkasan, kepemimpinan, dan bakti masyarakat tingkat penegak.',
    imageUrl: ASSETS.activityStudents,
    order: 2,
    isActive: true,
    isRequired: false,
    fieldType: 'achievement',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  // Gallery
  {
    id: 'gal-1',
    category: 'gallery',
    title: 'Gedung Utama SMA Ma\'arif 05 Padang Ratu',
    description: 'Lingkungan sekolah yang asri, bersih, dan kondusif bagi kegiatan belajar mengajar.',
    imageUrl: ASSETS.heroBuilding,
    order: 1,
    isActive: true,
    isRequired: false,
    fieldType: 'photo',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'gal-2',
    category: 'gallery',
    title: 'Praktikum Laboratorium Komputer & Sains',
    description: 'Pembelajaran berbasis teknologi informasi dan eksperimen ilmiah terpadu.',
    imageUrl: ASSETS.facilityLab,
    order: 2,
    isActive: true,
    isRequired: false,
    fieldType: 'photo',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'gal-3',
    category: 'gallery',
    title: 'Diskusi Kelompok & Literasi Perpustakaan',
    description: 'Budaya kolaborasi akademik dan kajian ilmiah murid SMA Ma\'arif 05 Padang Ratu.',
    imageUrl: ASSETS.activityStudents,
    order: 3,
    isActive: true,
    isRequired: false,
    fieldType: 'photo',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  // Document Requirements
  {
    id: 'doc-req-foto',
    category: 'doc_requirement',
    title: 'Pas Foto Resmi 3x4',
    description: 'Pas foto berwarna terbaru latar merah atau biru (Format JPG/PNG, maks 500 KB).',
    imageUrl: '',
    order: 1,
    isActive: true,
    isRequired: true,
    fieldType: 'JPG,PNG',
    maxSizeKb: 500,
    academicYear: 'ALL',
  },
  {
    id: 'doc-req-kk',
    category: 'doc_requirement',
    title: 'Kartu Keluarga (KK)',
    description: 'Scan atau foto jelas Kartu Keluarga asli (Format PDF/JPG/PNG, maks 500 KB).',
    imageUrl: '',
    order: 2,
    isActive: true,
    isRequired: true,
    fieldType: 'PDF,JPG,PNG',
    maxSizeKb: 500,
    academicYear: 'ALL',
  },
  {
    id: 'doc-req-akta',
    category: 'doc_requirement',
    title: 'Akta Kelahiran',
    description: 'Scan atau foto jelas Akta Kelahiran calon murid (Format PDF/JPG/PNG, maks 500 KB).',
    imageUrl: '',
    order: 3,
    isActive: true,
    isRequired: true,
    fieldType: 'PDF,JPG,PNG',
    maxSizeKb: 500,
    academicYear: 'ALL',
  },
  {
    id: 'doc-req-ijazah',
    category: 'doc_requirement',
    title: 'Ijazah atau Surat Keterangan Lulus (SKL)',
    description: 'Opsional: Scan Ijazah SMP/MTs atau SKL sementara jika sudah tersedia (Format PDF/JPG/PNG, maks 500 KB).',
    imageUrl: '',
    order: 4,
    isActive: true,
    isRequired: false,
    fieldType: 'PDF,JPG,PNG',
    maxSizeKb: 500,
    academicYear: 'ALL',
  },
  {
    id: 'doc-req-kip',
    category: 'doc_requirement',
    title: 'Dokumen Tambahan (KIP / Piagam Prestasi)',
    description: 'Opsional: Kartu Indonesia Pintar (KIP), PKH, atau Sertifikat Prestasi Akademik/Non-Akademik.',
    imageUrl: '',
    order: 5,
    isActive: true,
    isRequired: false,
    fieldType: 'PDF,JPG,PNG',
    maxSizeKb: 500,
    academicYear: 'ALL',
  },
  // Custom Form Fields
  {
    id: 'field-peminatan',
    category: 'custom_field',
    title: 'Program Peminatan yang Diminati',
    description: 'Pilihan kelas program unggulan (MIPA Sains / IPS Sosial / Tahfidz Terpadu)',
    imageUrl: '',
    order: 1,
    isActive: true,
    isRequired: true,
    fieldType: 'text',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
  {
    id: 'field-prestasi',
    category: 'custom_field',
    title: 'Prestasi Akademik / Non-Akademik (Jika Ada)',
    description: 'Tuliskan prestasi yang pernah diraih selama di SMP/MTs (kosongkan jika belum ada)',
    imageUrl: '',
    order: 2,
    isActive: true,
    isRequired: false,
    fieldType: 'text',
    maxSizeKb: 0,
    academicYear: 'ALL',
  },
];

export const DEFAULT_ANNOUNCEMENTS: Omit<Announcement, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'ann-1',
    title: 'Pembukaan Resmi SPMB Online SMA Ma\'arif 05 Padang Ratu (Gratis 100%)',
    content:
      'Panitia Sistem Penerimaan Murid Baru (SPMB) SMA Ma\'arif 05 Padang Ratu resmi membuka pendaftaran calon murid baru secara daring. Seluruh proses pendaftaran dan formulir GRATIS 100% tanpa dipungut biaya apa pun. Calon murid dapat mendaftar langsung dari HP atau laptop dan mengunggah berkas persyaratan secara aman.',
    imageUrl: ASSETS.heroBuilding,
    publishDate: '2027-01-15',
    isPublished: true,
    academicYear: '2027/2028',
  },
  {
    id: 'ann-2',
    title: 'Jadwal Verifikasi Berkas & Pengumuman Hasil Seleksi SPMB',
    content:
      'Verifikasi berkas dilakukan setiap hari kerja oleh Panitia SPMB. Calon murid dapat memantau status verifikasi berkas dan hasil seleksi secara mandiri melalui menu Cek Status Pendaftaran dengan memasukkan Nomor Pendaftaran dan Tanggal Lahir.',
    imageUrl: ASSETS.facilityLab,
    publishDate: '2027-02-01',
    isPublished: true,
    academicYear: '2027/2028',
  },
];
