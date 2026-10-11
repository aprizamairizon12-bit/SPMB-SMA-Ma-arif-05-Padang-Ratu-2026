import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Lock,
  MapPin,
  Phone,
  Mail,
  Award,
  CheckCircle2,
  Calendar,
  FileText,
  GraduationCap,
  Edit3,
} from 'lucide-react';
import {
  Announcement,
  ASSETS,
  SchoolConfig,
  SchoolItem,
} from '../types';

interface PublicPortalProps {
  config: SchoolConfig;
  items: SchoolItem[];
  announcements: Announcement[];
  isAdminLoggedIn?: boolean;
  onOpenRegistration: () => void;
  onOpenStatusCheck: () => void;
  onOpenAdmin: (tab?: string) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  config,
  items,
  announcements,
  isAdminLoggedIn = false,
  onOpenRegistration,
  onOpenStatusCheck,
  onOpenAdmin,
}) => {
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<
    'profil' | 'fasilitas' | 'ekskul' | 'prestasi'
  >('profil');

  const programs = items
    .filter((i) => i.category === 'program' && i.isActive)
    .sort((a, b) => a.order - b.order);
  const facilities = items
    .filter((i) => i.category === 'facility' && i.isActive)
    .sort((a, b) => a.order - b.order);
  const extracurriculars = items
    .filter((i) => i.category === 'extracurricular' && i.isActive)
    .sort((a, b) => a.order - b.order);
  const achievements = items
    .filter((i) => i.category === 'achievement' && i.isActive)
    .sort((a, b) => a.order - b.order);
  const galleryItems = items
    .filter((i) => i.category === 'gallery' && i.isActive)
    .sort((a, b) => a.order - b.order);
  const docRequirements = items
    .filter(
      (i) =>
        i.category === 'doc_requirement' &&
        i.isActive &&
        (i.academicYear === 'ALL' || i.academicYear === config.activeYearLabel)
    )
    .sort((a, b) => a.order - b.order);

  const activeAnnouncements = announcements.filter(
    (a) =>
      a.isPublished &&
      (a.academicYear === 'ALL' || a.academicYear === config.activeYearLabel)
  );

  return (
    <div className="min-h-screen flex flex-col bg-maarif-canvas text-slate-900">
      {/* Strict 3-Zone Top Bar Contract with Emerald & Gold Accents */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-emerald-200/80 px-6 py-4 flex items-center justify-between gap-8">
        <a
          href="#beranda"
          className="text-lg font-bold tracking-tight text-emerald-900 whitespace-nowrap shrink-0"
        >
          {config.officialName}
        </a>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-emerald-950/80">
          <a
            href="#profil-sekolah"
            className="hover:text-emerald-700 hover:underline underline-offset-4 decoration-amber-500 transition-colors whitespace-nowrap shrink-0"
          >
            Profil & Visi
          </a>
          <a
            href="#program-unggulan"
            className="hover:text-emerald-700 hover:underline underline-offset-4 decoration-amber-500 transition-colors whitespace-nowrap shrink-0"
          >
            Program & Fasilitas
          </a>
          <a
            href="#alur-pendaftaran"
            className="hover:text-emerald-700 hover:underline underline-offset-4 decoration-amber-500 transition-colors whitespace-nowrap shrink-0"
          >
            Alur & Jadwal
          </a>
          <button
            type="button"
            onClick={onOpenStatusCheck}
            className="hover:text-emerald-700 hover:underline underline-offset-4 decoration-amber-500 transition-colors whitespace-nowrap shrink-0"
          >
            Cek Status
          </button>
          <button
            type="button"
            onClick={() => onOpenAdmin('overview')}
            className="hover:text-amber-700 hover:underline underline-offset-4 decoration-amber-500 transition-colors whitespace-nowrap shrink-0"
          >
            Panel Admin
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {config.isRegistrationOpen ? (
            <button
              type="button"
              onClick={onOpenRegistration}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              Daftar Sekarang
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-200 rounded-lg cursor-not-allowed whitespace-nowrap shrink-0"
            >
              Pendaftaran Ditutup
            </button>
          )}
        </div>
      </header>

      {/* Admin Quick-Edit Toolbar when logged in */}
      {isAdminLoggedIn && (
        <div className="bg-emerald-950 text-emerald-100 border-b border-amber-400/50 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              Mode Admin Aktif — Klik pintasan untuk mengedit konten halaman ini secara langsung:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAdmin('school_settings')}
                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-semibold"
              >
                Edit Identitas, Logo & Banner
              </button>
              <button
                type="button"
                onClick={() => onOpenAdmin('academic_years')}
                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-semibold"
              >
                Edit Tahun Ajaran ({config.activeYearLabel})
              </button>
              <button
                type="button"
                onClick={() => onOpenAdmin('form_docs')}
                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-semibold"
              >
                Edit Program, Fasilitas & Syarat
              </button>
              <button
                type="button"
                onClick={() => onOpenAdmin('announcements_gallery')}
                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-semibold"
              >
                Edit Pengumuman & Galeri
              </button>
              <button
                type="button"
                onClick={() => onOpenAdmin('applicants')}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg font-bold"
              >
                Kelola & Edit Pendaftar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION: Hijau Muda, Putih Bersih, dan Emas */}
      <section id="beranda" className="bg-maarif-hero border-b border-emerald-200/70">
        <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Column: Core Proposition */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="p-1.5 rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-amber-500 shrink-0">
                    <img
                      src={config.logoUrl || ASSETS.schoolLogo}
                      alt={`Logo ${config.officialName}`}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ASSETS.schoolLogo;
                      }}
                      className="w-16 h-16 object-contain rounded-lg bg-white p-1"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-800">
                      SPMB ONLINE RESMI · TAHUN AJARAN{' '}
                      <span className="font-mono text-amber-700">{config.activeYearLabel}</span> ·
                      NPSN <span className="font-mono">{config.npsn}</span>
                    </div>
                    <p className="text-sm font-semibold text-emerald-950 mt-0.5">
                      Lembaga Pendidikan Ma'arif NU · {config.district}, {config.regency}
                    </p>
                  </div>
                </div>

                <h1
                  className="font-bold text-emerald-950 tracking-tight leading-tight"
                  style={{ fontSize: 'clamp(2.1rem, 3.6vw, 3.25rem)', textWrap: 'balance' }}
                >
                  Sistem Penerimaan Murid Baru (SPMB) Online{' '}
                  <span className="text-emerald-700">{config.officialName}</span>
                </h1>

                <p className="text-base text-slate-700 leading-relaxed max-w-2xl">
                  Selamat datang di portal pendaftaran resmi calon murid baru{' '}
                  <span className="font-semibold text-emerald-950">{config.officialName}</span>{' '}
                  untuk Tahun Ajaran{' '}
                  <span className="font-mono font-bold text-amber-700">
                    {config.activeYearLabel}
                  </span>
                  . Pendaftaran dilakukan secara daring dari rumah melalui HP, tablet, atau laptop,{' '}
                  <span className="font-bold text-emerald-800 underline decoration-amber-400 decoration-2 underline-offset-2">
                    100% GRATIS tanpa biaya pendaftaran dan tanpa biaya formulir.
                  </span>
                </p>

                {!config.isRegistrationOpen && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-950">
                    <p className="font-bold">Pemberitahuan Periode Pendaftaran:</p>
                    <p className="mt-0.5 text-xs">
                      Pendaftaran daring untuk Tahun Ajaran {config.activeYearLabel} saat ini sedang
                      ditutup atau belum dibuka. Calon murid yang sudah mendaftar tetap dapat
                      mengecek status seleksi melalui tombol Cek Status Pendaftaran.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {config.isRegistrationOpen ? (
                    <button
                      type="button"
                      onClick={onOpenRegistration}
                      className="px-6 py-3.5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <GraduationCap className="w-4 h-4 text-amber-300" />
                      Daftar Sekarang (Gratis 100%)
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-6 py-3.5 bg-slate-200 text-slate-500 text-sm font-semibold rounded-xl cursor-not-allowed whitespace-nowrap shrink-0"
                    >
                      Periode Pendaftaran Berakhir / Belum Dibuka
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onOpenStatusCheck}
                    className="px-5 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Search className="w-4 h-4 text-slate-950" />
                    Cek Status Pendaftaran
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="px-4 py-3.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                    Panduan Pendaftaran
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-900/80 pt-1">
                  <span className="font-bold text-emerald-800">Pendaftaran Gratis 100%</span>
                  <span aria-hidden="true" className="text-amber-600 font-bold">·</span>
                  <span>Tanpa Biaya Formulir</span>
                  <span aria-hidden="true" className="text-amber-600 font-bold">·</span>
                  <span>Bukti Pendaftaran PDF Instan</span>
                  <span aria-hidden="true" className="text-amber-600 font-bold">·</span>
                  <span>Data Tersimpan Aman di Cloud</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Campus Visual with Gold-Emerald Frame */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/80 bg-emerald-950 h-72 lg:h-full min-h-[330px]">
                <img
                  src={config.heroBannerUrl || ASSETS.heroBuilding}
                  alt={`Gedung Kampus ${config.officialName}`}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ASSETS.heroBuilding;
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/35 to-transparent flex flex-col justify-end p-6 text-white">
                  <p className="text-xs font-mono font-bold text-amber-300">
                    KAMPUS HIJAU BERKARAKTER ASWAJA · TAHUN AJARAN {config.activeYearLabel}
                  </p>
                  <p className="text-lg font-bold mt-1 text-white">{config.officialName}</p>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    {config.address}, Kec. {config.district}, {config.regency}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width Key Information Strip below Hero Split */}
          <div className="mt-10 bg-maarif-emerald-gold text-white rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border border-amber-400/40">
            <div>
              <p className="text-xs text-emerald-200 font-medium">Tahun Ajaran Aktif</p>
              <p className="text-xl font-mono font-bold text-amber-300 tabular-nums mt-0.5">
                {config.activeYearLabel}
              </p>
              <p className="text-xs text-emerald-100 mt-0.5">
                {config.isRegistrationOpen ? 'Pendaftaran Sedang Dibuka' : 'Pendaftaran Ditutup'}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-200 font-medium">Jadwal Pendaftaran Online</p>
              <p className="text-sm font-mono font-bold text-white tabular-nums mt-1">
                {config.openDate} s/d {config.closeDate}
              </p>
              <p className="text-xs text-emerald-200 mt-0.5">Layanan daring 24 jam penuh</p>
            </div>
            <div>
              <p className="text-xs text-emerald-200 font-medium">Pengumuman Hasil Seleksi</p>
              <p className="text-sm font-mono font-bold text-amber-300 tabular-nums mt-1">
                {config.announcementDate}
              </p>
              <p className="text-xs text-emerald-200 mt-0.5">Cek mandiri via Nomor Pendaftaran</p>
            </div>
            <div>
              <p className="text-xs text-emerald-200 font-medium">Biaya Pendaftaran & Formulir</p>
              <p className="text-xl font-bold text-amber-300 mt-0.5">GRATIS 100% (Rp 0)</p>
              <p className="text-xs text-emerald-100 mt-0.5">Bebas pungutan biaya pendaftaran</p>
            </div>
          </div>
        </div>
      </section>

      {/* PROFIL, SEJARAH, VISI MISI, FASILITAS, EKSKUL & PRESTASI */}
      <section id="profil-sekolah" className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-emerald-200 pb-6">
          <div>
            <p className="text-xs font-bold text-amber-700 tracking-wide">
              IDENTITAS & KEUNGGULAN INSTITUSI
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-950 mt-1">
              Profil Resmi {config.officialName}
            </h2>
          </div>

          {/* Interactive Segmented Tabs with Emerald & Gold Active State */}
          <div className="flex flex-wrap items-center gap-1 p-1.5 bg-emerald-100/80 border border-emerald-200 rounded-xl self-start">
            {[
              { id: 'profil', label: 'Sejarah & Visi Misi' },
              { id: 'fasilitas', label: 'Fasilitas Sekolah' },
              { id: 'ekskul', label: 'Ekstrakurikuler' },
              { id: 'prestasi', label: 'Prestasi Sekolah' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveProfileTab(tab.id as typeof activeProfileTab)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  activeProfileTab === tab.id
                    ? 'bg-emerald-800 text-amber-300 shadow-xs'
                    : 'text-emerald-900 hover:bg-emerald-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeProfileTab === 'profil' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-3">
                <h3 className="text-lg font-bold text-emerald-950">Sejarah Singkat Sekolah</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {config.history}
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 via-white to-amber-50/60 border border-emerald-200 rounded-2xl p-6 space-y-4">
                <div>
                  <p className="text-xs font-mono font-bold text-amber-700">VISI UTAMA</p>
                  <h3 className="text-lg font-bold text-emerald-950">Visi Sekolah</h3>
                  <p className="text-sm text-emerald-900 font-semibold mt-1 leading-relaxed">
                    "{config.vision}"
                  </p>
                </div>
                <div className="pt-4 border-t border-emerald-200/70">
                  <p className="text-xs font-mono font-bold text-emerald-700">MISI PENDIDIKAN</p>
                  <h3 className="text-lg font-bold text-emerald-950">Misi Sekolah</h3>
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed whitespace-pre-line">
                    {config.mission}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-amber-300/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-200/70 pb-3">
                  <h3 className="text-lg font-bold text-emerald-950">Data Pokok Sekolah</h3>
                  <span className="text-xs font-mono font-bold text-amber-700">
                    LP MA'ARIF NU
                  </span>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Nama Resmi</span>
                    <span className="font-bold text-emerald-950 text-right">{config.officialName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">NPSN</span>
                    <span className="font-mono font-bold text-amber-700">{config.npsn}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Kepala Sekolah</span>
                    <span className="font-semibold text-slate-900 text-right">{config.principalName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">NIP Kepala Sekolah</span>
                    <span className="font-mono text-slate-800">{config.principalNip || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Ketua Panitia SPMB</span>
                    <span className="font-semibold text-emerald-800 text-right">{config.committeeHeadName}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Lokasi</span>
                    <span className="text-slate-900 text-right">
                      {config.village}, Kec. {config.district}, {config.regency}, {config.province}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeProfileTab === 'fasilitas' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {facilities.map((fac, idx) => (
              <div
                key={fac.id}
                className="bg-white border border-emerald-200 rounded-2xl overflow-hidden flex flex-col hover:border-amber-400 transition-colors"
              >
                <div className="h-48 bg-emerald-100 overflow-hidden">
                  <img
                    src={fac.imageUrl || ASSETS.facilityLab}
                    alt={fac.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = ASSETS.facilityLab;
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <p className="text-xs font-mono font-bold text-amber-700">
                      0{idx + 1}. FASILITAS PENDIDIKAN
                    </p>
                    <h3 className="text-base font-bold text-emerald-950 mt-1">{fac.title}</h3>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {fac.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeProfileTab === 'ekskul' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {extracurriculars.map((eks, idx) => (
              <div
                key={eks.id}
                className="bg-gradient-to-br from-white via-emerald-50/40 to-amber-50/40 border border-emerald-200 rounded-2xl p-6 space-y-3"
              >
                <p className="text-xs font-mono font-bold text-amber-700">
                  0{idx + 1}. PENGEMBANGAN BAKAT & MINAT
                </p>
                <h3 className="text-base font-bold text-emerald-950">{eks.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{eks.description}</p>
              </div>
            ))}
          </div>
        )}

        {activeProfileTab === 'prestasi' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {achievements.map((ach, idx) => (
              <div
                key={ach.id}
                className="bg-gradient-to-r from-amber-50/70 via-white to-emerald-50/50 border border-amber-300 rounded-2xl p-6 flex items-start gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-amber-800">
                    PRESTASI AKADEMIK & NON-AKADEMIK #{idx + 1}
                  </p>
                  <h3 className="text-base font-bold text-emerald-950 mt-0.5">{ach.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{ach.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PROGRAM UNGGULAN & GALERI SEKOLAH */}
      <section
        id="program-unggulan"
        className="bg-gradient-to-b from-emerald-50/90 via-white to-amber-50/40 border-y border-emerald-200/80 py-16"
      >
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div>
            <p className="text-xs font-bold text-amber-700 tracking-wide">
              KURIKULUM & KOMPETENSI LULUSAN
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-950 mt-1">
              Program Unggulan & Dokumentasi Kegiatan
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {programs.map((prog, index) => (
              <div
                key={prog.id}
                className="border border-emerald-200 rounded-2xl p-6 bg-white hover:border-amber-400 transition-colors space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono font-bold text-emerald-700">
                    0{index + 1}. PROGRAM UNGGULAN
                  </p>
                  <span className="text-xs font-mono font-semibold text-amber-600">
                    ★ UNGGULAN
                  </span>
                </div>
                <h3 className="text-lg font-bold text-emerald-950">{prog.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{prog.description}</p>
              </div>
            ))}
          </div>

          {/* Galeri Foto & Dokumentasi */}
          {galleryItems.length > 0 && (
            <div className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-emerald-950">
                  Galeri Kampus & Kegiatan Murid
                </h3>
                <span className="text-xs font-semibold text-emerald-800">
                  Dokumentasi Resmi {config.officialName}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {galleryItems.map((gal) => (
                  <div
                    key={gal.id}
                    className="group rounded-2xl overflow-hidden border border-emerald-200 bg-white hover:border-amber-400 transition-colors"
                  >
                    <div className="h-52 overflow-hidden bg-emerald-100">
                      <img
                        src={gal.imageUrl || ASSETS.activityStudents}
                        alt={gal.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = ASSETS.activityStudents;
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <div className="p-5">
                      <h4 className="text-sm font-bold text-emerald-950">{gal.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{gal.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* PERSYARATAN, ALUR, JADWAL & PENGUMUMAN */}
      <section id="alur-pendaftaran" className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Alur & Persyaratan */}
          <div className="lg:col-span-7 space-y-8">
            <div>
              <p className="text-xs font-bold text-amber-700 tracking-wide">
                PANDUAN CALON MURID BARU · TAHUN AJARAN {config.activeYearLabel}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
                Alur & Persyaratan Pendaftaran Online
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  num: '01',
                  step: 'Isi Formulir Pendaftaran Online',
                  desc: 'Klik tombol "Daftar Sekarang", lalu lengkapi identitas calon murid, data orang tua/wali, dan asal SMP/MTs dengan benar.',
                },
                {
                  num: '02',
                  step: 'Unggah Dokumen Persyaratan (Ijazah/SKL Opsional)',
                  desc: 'Unggah Pas Foto, Kartu Keluarga, dan Akta Kelahiran dari HP atau laptop. Ijazah/SKL bersifat opsional dan dapat menyusul jika belum terbit.',
                },
                {
                  num: '03',
                  step: 'Simpan Nomor & Cetak Bukti Pendaftaran PDF',
                  desc: 'Sistem membuat Nomor Pendaftaran unik secara otomatis. Unduh Bukti Pendaftaran PDF dan Biodata Resmi A4.',
                },
                {
                  num: '04',
                  step: 'Verifikasi Panitia & Pengumuman Hasil',
                  desc: 'Panitia SPMB memverifikasi berkas Anda. Pantau status verifikasi dan kelulusan pada menu "Cek Status Pendaftaran".',
                },
              ].map((item) => (
                <div
                  key={item.num}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4 hover:border-emerald-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-200 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                    {item.num}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">{item.step}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  Daftar Dokumen Persyaratan Tahun Ajaran {config.activeYearLabel}
                </h3>
                <span className="text-xs font-mono font-semibold text-emerald-800">
                  FORMAT: PDF / JPG / PNG
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                {docRequirements.map((req, i) => (
                  <div key={req.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {i + 1}. {req.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>
                    </div>
                    <span
                      className={`text-xs font-mono font-semibold whitespace-nowrap shrink-0 ${
                        req.isRequired ? 'text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {req.isRequired ? 'Wajib' : 'Opsional'} · {req.fieldType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Jadwal & Pengumuman Resmi */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-maarif-emerald-gold text-white rounded-xl p-6 space-y-5 border border-emerald-800">
              <div>
                <p className="text-xs font-mono font-bold text-amber-200">
                  JADWAL RESMI SPMB {config.activeYearLabel}
                </p>
                <h3 className="text-xl font-bold mt-1">Kalender Penerimaan Murid Baru</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="p-3.5 bg-white/10 border border-white/15 rounded-xl flex justify-between items-center">
                  <span className="text-emerald-100">Pembukaan Pendaftaran</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {config.openDate}
                  </span>
                </div>
                <div className="p-3.5 bg-white/10 border border-white/15 rounded-xl flex justify-between items-center">
                  <span className="text-emerald-100">Penutupan Pendaftaran</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {config.closeDate}
                  </span>
                </div>
                <div className="p-3.5 bg-amber-400/15 border border-amber-300/40 rounded-xl flex justify-between items-center">
                  <span className="text-amber-200 font-semibold">Pengumuman Hasil Seleksi</span>
                  <span className="font-mono font-bold text-amber-300 tabular-nums">
                    {config.announcementDate}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                {config.isRegistrationOpen ? (
                  <button
                    type="button"
                    onClick={onOpenRegistration}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-colors"
                  >
                    Isi Formulir Pendaftaran Sekarang (Gratis 100%)
                  </button>
                ) : (
                  <div className="text-xs text-center text-amber-200 py-2">
                    Pendaftaran saat ini sedang ditutup oleh Panitia SPMB.
                  </div>
                )}
              </div>
            </div>

            {/* Pengumuman Resmi */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Pengumuman Resmi Panitia</h3>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  {config.activeYearLabel}
                </span>
              </div>

              {activeAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  Belum ada pengumuman terbaru untuk periode ini.
                </p>
              ) : (
                <div className="space-y-4">
                  {activeAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 bg-emerald-50/40 border border-slate-200 rounded-xl space-y-1.5"
                    >
                      <div className="text-xs text-emerald-800 font-mono font-semibold">
                        Dipublikasikan: {ann.publishDate} · Periode {ann.academicYear}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{ann.title}</h4>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {ann.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* KONTAK, ALAMAT & PETA LOKASI */}
      <footer className="mt-auto bg-emerald-950 text-emerald-100 border-t border-emerald-900">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={config.logoUrl || ASSETS.schoolLogo}
                alt={config.officialName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-lg bg-white p-0.5 object-contain border border-emerald-800"
              />
              <div>
                <p className="text-base font-bold text-white">{config.officialName}</p>
                <p className="text-xs text-amber-300 font-semibold">
                  SPMB Online Tahun Ajaran {config.activeYearLabel} · Gratis 100%
                </p>
              </div>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              {config.address}, Desa/Kel. {config.village}, Kec. {config.district},{' '}
              {config.regency}, Provinsi {config.province} {config.postalCode}.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs">
              {config.mapUrl && (
                <a
                  href={config.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-300 hover:underline flex items-center gap-1 font-semibold"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Buka Peta Lokasi Google Maps
                </a>
              )}
            </div>
          </div>

          <div className="md:col-span-4 space-y-2.5 text-xs">
            <p className="text-sm font-bold text-amber-300">Layanan Informasi & Kontak Panitia</p>
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-amber-300" />
              <span>Telepon: {config.phone}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-amber-300" />
              <span>WhatsApp Panitia: {config.whatsapp}</span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-amber-300" />
              <span>Email: {config.email}</span>
            </p>
            <div className="pt-2 flex items-center gap-4 text-emerald-300">
              {config.facebookUrl && (
                <a
                  href={config.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-300"
                >
                  Facebook
                </a>
              )}
              {config.instagramUrl && (
                <a
                  href={config.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-300"
                >
                  Instagram
                </a>
              )}
              {config.youtubeUrl && (
                <a
                  href={config.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-300"
                >
                  YouTube
                </a>
              )}
            </div>
          </div>

          <div className="md:col-span-3 space-y-3 text-xs">
            <p className="text-sm font-bold text-amber-300">Akses Cepat</p>
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={onOpenRegistration}
                disabled={!config.isRegistrationOpen}
                className="hover:text-amber-300 disabled:opacity-40"
              >
                Formulir Pendaftaran Online
              </button>
              <button type="button" onClick={onOpenStatusCheck} className="hover:text-amber-300">
                Cek Status & Pengumuman
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="hover:text-amber-300"
              >
                Panduan Pendaftaran
              </button>
              <button
                type="button"
                onClick={() => onOpenAdmin('overview')}
                className="text-amber-300 hover:text-amber-200 flex items-center gap-1.5 pt-1 font-bold"
              >
                <Lock className="w-3.5 h-3.5" />
                Login Panitia / Admin Sekolah
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-emerald-900/80 px-6 py-4 text-center text-xs text-emerald-300/70">
          © {new Date().getFullYear()} {config.officialName} (NPSN: {config.npsn}). Seluruh proses
          pendaftaran SPMB Online Gratis 100%.
        </div>
      </footer>

      {/* Modal Panduan Pendaftaran */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Panduan Lengkap SPMB Online {config.officialName} ({config.activeYearLabel})
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950"
              >
                Tutup
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <p className="font-bold text-emerald-900">
                1. Ketentuan Umum (Pendaftaran Gratis 100%)
              </p>
              <p>
                Pendaftaran calon murid baru di {config.officialName} tidak memungut biaya apa pun
                (Gratis 100%). Tidak ada pembayaran formulir maupun sistem pembayaran online.
              </p>
              <p className="font-bold text-emerald-900">
                2. Persiapan Berkas Digital (Ijazah/SKL Opsional)
              </p>
              <p>
                Siapkan foto atau scan jelas Pas Foto 3x4, Kartu Keluarga (KK), dan Akta Kelahiran
                dalam format JPG, PNG, atau PDF (maksimal 500 KB per file). Dokumen Ijazah atau
                Surat Keterangan Lulus (SKL) bersifat <strong>Opsional</strong> saat pendaftaran
                online sehingga formulir tetap dapat dikirim meskipun Ijazah/SKL belum terbit.
              </p>
              <p className="font-bold text-emerald-900">
                3. Pengisian Formulir & Nomor Pendaftaran Unik
              </p>
              <p>
                Setelah seluruh kolom wajib diisi dan dikirim, sistem akan menerbitkan Nomor
                Pendaftaran unik (misal: SPMB-2027-XXXX). Unduh Bukti Pendaftaran PDF sebagai tanda
                bukti resmi.
              </p>
              <p className="font-bold text-emerald-900">
                4. Pemeriksaan Status & Perbaikan Dokumen Mandiri
              </p>
              <p>
                Gunakan menu "Cek Status Pendaftaran" dengan memasukkan Nomor Pendaftaran dan
                Tanggal Lahir. Apabila terdapat dokumen yang perlu diperbaiki, Anda dapat langsung
                mengunggah dokumen pengganti pada halaman tersebut.
              </p>
            </div>
            <div className="pt-4 border-t border-emerald-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 text-white text-xs font-bold rounded-xl"
              >
                Mengerti & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
