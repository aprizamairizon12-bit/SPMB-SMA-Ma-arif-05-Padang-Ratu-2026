import React, { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Upload,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ApplicantStatusLookup,
  SchoolConfig,
  SchoolItem,
} from '../types';

interface StatusCheckViewProps {
  config: SchoolConfig;
  items: SchoolItem[];
  initialRegNumber?: string;
  initialBirthDate?: string;
  onBackHome: () => void;
}

export const StatusCheckView: React.FC<StatusCheckViewProps> = ({
  config,
  items,
  initialRegNumber = '',
  initialBirthDate = '',
  onBackHome,
}) => {
  const [regNumber, setRegNumber] = useState(initialRegNumber);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ApplicantStatusLookup | null>(null);

  // Document replacement state when status === 'Perlu perbaikan data'
  const [selectedReqId, setSelectedReqId] = useState('');
  const [uploadingRepair, setUploadingRepair] = useState(false);
  const [repairSuccessMsg, setRepairSuccessMsg] = useState<string | null>(null);

  const docRequirements = items
    .filter((i) => i.category === 'doc_requirement' && i.isActive)
    .sort((a, b) => a.order - b.order);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setRepairSuccessMsg(null);

    const cleanReg = regNumber.trim().toUpperCase();
    const cleanDate = birthDate.trim();

    if (!cleanReg || !cleanDate) {
      setErrorMsg('Masukkan Nomor Pendaftaran dan Tanggal Lahir untuk melakukan verifikasi.');
      return;
    }

    const lookupId = `${cleanReg}_${cleanDate}`;
    if (!/^[a-zA-Z0-9_\-]+$/.test(lookupId)) {
      setErrorMsg('Format Nomor Pendaftaran atau Tanggal Lahir tidak valid.');
      return;
    }

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'applicant_status_lookup', lookupId));
      if (!snap.exists()) {
        setResult(null);
        setErrorMsg(
          'Data pendaftaran tidak ditemukan. Pastikan Nomor Pendaftaran (contoh: SPMB-2027-1234) dan Tanggal Lahir sesuai saat mendaftar.'
        );
      } else {
        const data = snap.data() as Omit<ApplicantStatusLookup, 'id'>;
        setResult({
          id: snap.id,
          ...data,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `applicant_status_lookup/${lookupId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRegNumber && initialBirthDate) {
      handleLookup();
    }
  }, [initialRegNumber, initialBirthDate]);

  const handleRepairDocumentUpload = async (file: File | null) => {
    if (!file || !result) return;
    setErrorMsg(null);
    setRepairSuccessMsg(null);

    const req = docRequirements.find((r) => r.id === selectedReqId) || docRequirements[0];
    if (!req) {
      setErrorMsg('Pilih jenis dokumen yang ingin diperbaiki.');
      return;
    }

    const fileExt = (file.name.split('.').pop() || '').toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';
    const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(fileExt);

    if (!isPdf && !isImage) {
      setErrorMsg('Format file hanya diperbolehkan PDF, JPG, atau PNG.');
      return;
    }

    setUploadingRepair(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.readAsDataURL(file);
      });

      if (dataUrl.length > 740000) {
        setErrorMsg('Ukuran file terlalu besar. Maksimal 500 KB.');
        setUploadingRepair(false);
        return;
      }

      const safeDocId = `${result.applicantId}_${req.id.replace(/[^a-zA-Z0-9_\-]/g, '')}`;
      const storagePath = `pendaftar/${result.regNumber}/${file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;

      await setDoc(doc(db, 'applicant_documents', safeDocId), {
        applicantId: result.applicantId,
        regNumber: result.regNumber,
        academicYear: result.academicYear,
        docType: req.id,
        docLabel: req.title,
        fileName: file.name.slice(0, 200),
        mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        fileSize: file.size,
        storagePath: storagePath.slice(0, 500),
        fileDataUrl: dataUrl,
        verificationStatus: 'Menunggu',
        adminNote: 'Diunggah ulang oleh calon murid (Perbaikan Dokumen)',
        uploadedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setRepairSuccessMsg(
        `Dokumen "${req.title}" berhasil diperbarui dan dikirim ulang ke Panitia SPMB untuk diverifikasi.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengunggah dokumen perbaikan.'
      );
    } finally {
      setUploadingRepair(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-10 px-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="bg-maarif-emerald-gold text-white px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800">
          <div>
            <p className="text-xs text-amber-200 font-semibold tracking-wide">
              PORTAL VERIFIKASI MANDIRI · PRIVASI TERLINDUNGI
            </p>
            <h2 className="text-xl md:text-2xl font-bold mt-1 text-white">
              Cek Status Pendaftaran & Pengumuman Hasil Seleksi
            </h2>
          </div>
          <button
            onClick={onBackHome}
            className="self-start sm:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Beranda
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-start gap-3 text-xs text-slate-700">
            <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              Demi melindungi privasi data pribadi calon murid, pemeriksaan status menggunakan kombinasi{' '}
              <span className="font-semibold text-slate-900">Nomor Pendaftaran</span> dan{' '}
              <span className="font-semibold text-slate-900">Tanggal Lahir</span>. Data sensitif seperti
              NIK, alamat rumah, nomor telepon, dan berkas pribadi tidak ditampilkan secara terbuka.
            </div>
          </div>

          <form onSubmit={handleLookup} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Pendaftaran *
              </label>
              <input
                type="text"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                placeholder="Contoh: SPMB-2027-4821"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Lahir Calon Murid *
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Memeriksa...' : 'Cek Status Sekarang'}
            </button>
          </form>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          {result && (
            <div className="mt-6 border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">
                    Nomor Pendaftaran:{' '}
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {result.regNumber}
                    </span>{' '}
                    · Tahun Ajaran:{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {result.academicYear}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">{result.fullName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    NISN: <span className="font-mono">{result.nisn}</span> · Sekolah Asal:{' '}
                    {result.previousSchool}
                  </p>
                </div>

                {/* Status Display */}
                <div className="flex items-center gap-2.5">
                  {result.status === 'Diterima' && (
                    <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      DITERIMA / LULUS SELEKSI
                    </div>
                  )}
                  {result.status === 'Terverifikasi' && (
                    <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      BERKAS TERVERIFIKASI
                    </div>
                  )}
                  {result.status === 'Menunggu verifikasi' && (
                    <div className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex items-center gap-2 text-sm font-bold">
                      <Clock className="w-5 h-5 text-amber-600" />
                      MENUNGGU VERIFIKASI
                    </div>
                  )}
                  {result.status === 'Perlu perbaikan data' && (
                    <div className="px-4 py-2 bg-amber-50 border border-amber-300 text-amber-950 rounded-lg flex items-center gap-2 text-sm font-bold">
                      <AlertTriangle className="w-5 h-5 text-amber-700" />
                      PERLU PERBAIKAN DATA / DOKUMEN
                    </div>
                  )}
                  {result.status === 'Tidak diterima' && (
                    <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-900 rounded-lg flex items-center gap-2 text-sm font-bold">
                      <XCircle className="w-5 h-5 text-red-600" />
                      TIDAK DITERIMA
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-emerald-50/40 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1">
                    Kelengkapan Dokumen Wajib
                  </p>
                  <p className="font-mono font-bold text-slate-900 tabular-nums">
                    {result.docCompleteCount} dari {result.docTotalRequired} Dokumen Wajib Terunggah
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Dokumen Ijazah/SKL bersifat opsional (tetap sah meskipun belum diunggah).
                  </p>
                </div>

                <div className="p-4 bg-emerald-50/40 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1">
                    Jadwal Pengumuman Hasil Seleksi ({result.academicYear})
                  </p>
                  <p className="font-mono font-semibold text-slate-900">
                    {config.announcementDate || 'Sesuai jadwal Panitia SPMB'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                <p className="text-xs font-bold text-emerald-950 mb-1">
                  Catatan Resmi Panitia SPMB:
                </p>
                <p className="text-sm text-slate-800 whitespace-pre-line">
                  {result.verificationNotes || 'Berkas sedang dalam antrean pemeriksaan Panitia SPMB.'}
                </p>
              </div>

              {/* Document Replacement Form when Status === 'Perlu perbaikan data' */}
              {result.status === 'Perlu perbaikan data' && (
                <div className="p-5 bg-amber-50/60 border border-amber-300 rounded-xl space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      Unggah Ulang / Perbaikan Dokumen Persyaratan
                    </h4>
                    <p className="text-xs text-amber-900 mt-0.5">
                      Status pendaftaran Anda memerlukan perbaikan berkas. Silakan pilih jenis dokumen
                      yang diminta oleh panitia pada catatan di atas, lalu unggah file pengganti.
                    </p>
                  </div>

                  {repairSuccessMsg && (
                    <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-medium rounded-lg">
                      {repairSuccessMsg}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <select
                      value={selectedReqId || (docRequirements[0]?.id ?? '')}
                      onChange={(e) => setSelectedReqId(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs font-medium bg-white border border-amber-300 rounded-lg"
                    >
                      {docRequirements.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.fieldType || 'PDF/JPG/PNG'})
                        </option>
                      ))}
                    </select>

                    <label className="cursor-pointer px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0">
                      <Upload className="w-4 h-4" />
                      {uploadingRepair ? 'Mengunggah...' : 'Pilih & Unggah File Pengganti'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        disabled={uploadingRepair}
                        onChange={(e) =>
                          handleRepairDocumentUpload(
                            e.target.files ? e.target.files[0] : null
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
