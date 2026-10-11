import React, { useState, useMemo } from 'react';
import {
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  ArrowLeft,
  ArrowRight,
  Printer,
  Download,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Applicant,
  ApplicantDocument,
  SchoolConfig,
  SchoolItem,
} from '../types';
import {
  downloadRegistrationProofPdf,
  downloadBiodataPdf,
} from '../utils/exportAndZip';

interface RegistrationFormModalProps {
  config: SchoolConfig;
  items: SchoolItem[];
  onClose: () => void;
  onSuccessNavigateStatus: (regNumber: string, birthDate: string) => void;
}

interface PendingDocUpload {
  reqId: string;
  docLabel: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileDataUrl: string;
}

export const RegistrationFormModal: React.FC<RegistrationFormModalProps> = ({
  config,
  items,
  onClose,
  onSuccessNavigateStatus,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);

  // Anti-spam math challenge
  const [spamChallenge] = useState(() => {
    const a = Math.floor(Math.random() * 7) + 2;
    const b = Math.floor(Math.random() * 6) + 2;
    return { a, b, answer: String(a + b) };
  });
  const [spamInput, setSpamInput] = useState('');
  const [agreedDeclaration, setAgreedDeclaration] = useState(false);

  // A. Data Calon Murid
  const [fullName, setFullName] = useState('');
  const [nik, setNik] = useState('');
  const [nisn, setNisn] = useState('');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [religion, setReligion] = useState('Islam');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('Padang Ratu');
  const [regency, setRegency] = useState('Kabupaten Lampung Tengah');
  const [province, setProvince] = useState('Lampung');
  const [postalCode, setPostalCode] = useState('34176');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // B. Data Orang Tua / Wali
  const [fatherName, setFatherName] = useState('');
  const [fatherJob, setFatherJob] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherJob, setMotherJob] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianJob, setGuardianJob] = useState('');
  const [parentAddress, setParentAddress] = useState('');

  // C. Data Pendidikan Sebelumnya
  const [previousSchool, setPreviousSchool] = useState('');
  const [previousSchoolNpsn, setPreviousSchoolNpsn] = useState('');
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState('');
  const [graduationYear, setGraduationYear] = useState(
    config.activeYearLabel.split('/')[0] || '2027'
  );
  const [certificateNumber, setCertificateNumber] = useState('');

  // D. Custom Fields managed by Admin
  const customFields = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.category === 'custom_field' &&
            i.isActive &&
            (i.academicYear === 'ALL' || i.academicYear === config.activeYearLabel)
        )
        .sort((a, b) => a.order - b.order),
    [items, config.activeYearLabel]
  );

  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // E. Document Requirements managed by Admin
  const docRequirements = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.category === 'doc_requirement' &&
            i.isActive &&
            (i.academicYear === 'ALL' || i.academicYear === config.activeYearLabel)
        )
        .sort((a, b) => a.order - b.order),
    [items, config.activeYearLabel]
  );

  const [uploadedDocs, setUploadedDocs] = useState<Record<string, PendingDocUpload>>({});

  // Submitted Result State
  const [submittedApplicant, setSubmittedApplicant] = useState<Applicant | null>(null);
  const [submittedDocs, setSubmittedDocs] = useState<ApplicantDocument[]>([]);

  if (!config.isRegistrationOpen) {
    return (
      <div className="max-w-3xl mx-auto my-12 bg-white border border-slate-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Periode Pendaftaran SPMB Sedang Ditutup
        </h2>
        <p className="text-slate-600 mb-6">
          Pendaftaran daring untuk Tahun Ajaran{' '}
          <span className="font-semibold text-slate-900">{config.activeYearLabel}</span> saat ini
          belum dibuka atau telah berakhir. Silakan hubungi Panitia SPMB {config.officialName} untuk
          informasi lebih lanjut.
        </p>
        <button
          onClick={onClose}
          className="px-5 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900 transition-colors"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const validateStep1 = (): boolean => {
    setErrorMsg(null);
    if (fullName.trim().length < 2) {
      setErrorMsg('Nama lengkap calon murid wajib diisi (minimal 2 karakter).');
      return false;
    }
    if (!/^\d{8,20}$/.test(nik.trim())) {
      setErrorMsg('NIK wajib berupa angka valid (8–20 digit sesuai Kartu Keluarga).');
      return false;
    }
    if (!/^\d{5,20}$/.test(nisn.trim())) {
      setErrorMsg('NISN wajib berupa angka valid (5–20 digit).');
      return false;
    }
    if (!birthPlace.trim()) {
      setErrorMsg('Tempat lahir wajib diisi.');
      return false;
    }
    if (!birthDate.trim()) {
      setErrorMsg('Tanggal lahir wajib dipilih.');
      return false;
    }
    if (!address.trim() || !village.trim() || !district.trim() || !regency.trim()) {
      setErrorMsg('Alamat lengkap, Desa/Kelurahan, Kecamatan, dan Kabupaten wajib diisi.');
      return false;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      setErrorMsg('Nomor HP/WhatsApp aktif calon murid wajib diisi.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    setErrorMsg(null);
    if (!fatherName.trim() || !motherName.trim()) {
      setErrorMsg('Nama Ayah dan Nama Ibu kandung wajib diisi.');
      return false;
    }
    if (!fatherPhone.trim() && !motherPhone.trim()) {
      setErrorMsg('Minimal salah satu nomor HP Orang Tua (Ayah atau Ibu) wajib diisi.');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    setErrorMsg(null);
    if (!previousSchool.trim() || previousSchool.trim().length < 3) {
      setErrorMsg('Nama SMP atau MTs asal wajib diisi.');
      return false;
    }
    if (!graduationYear.trim()) {
      setErrorMsg('Tahun lulus wajib diisi.');
      return false;
    }
    for (const field of customFields) {
      if (field.isRequired && !(customValues[field.id] || '').trim()) {
        setErrorMsg(`Kolom "${field.title}" wajib diisi.`);
        return false;
      }
    }
    return true;
  };

  const validateStep4 = (): boolean => {
    setErrorMsg(null);
    for (const req of docRequirements) {
      if (req.isRequired && !uploadedDocs[req.id]) {
        setErrorMsg(`Dokumen wajib "${req.title}" belum diunggah. Silakan pilih file terlebih dahulu.`);
        return false;
      }
    }
    return true;
  };

  const handleFileChange = async (req: SchoolItem, file: File | null) => {
    if (!file) return;
    setErrorMsg(null);

    const allowedExts = req.fieldType
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const fileExt = (file.name.split('.').pop() || '').toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';
    const isImage =
      file.type.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(fileExt);

    if (allowedExts.length > 0) {
      const extAllowed =
        allowedExts.includes(fileExt) ||
        (fileExt === 'jpeg' && allowedExts.includes('jpg'));
      if (!extAllowed) {
        setErrorMsg(
          `Format file "${file.name}" tidak didukung untuk ${req.title}. Gunakan format: ${req.fieldType}.`
        );
        return;
      }
    } else if (!isPdf && !isImage) {
      setErrorMsg('Format file hanya diperbolehkan PDF, JPG, atau PNG.');
      return;
    }

    const maxBytes = (req.maxSizeKb > 0 ? req.maxSizeKb : 500) * 1024;
    if (file.size > maxBytes * 2.5 && isPdf) {
      setErrorMsg(
        `Ukuran file PDF terlalu besar (${Math.round(file.size / 1024)} KB). Maksimal ${req.maxSizeKb || 500} KB.`
      );
      return;
    }

    setUploadingReqId(req.id);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        if (isImage && file.size > 350 * 1024) {
          // Optimize large image so it fits safely within Firestore & Cloud Storage limits
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const maxDim = 1000;
              let w = img.width;
              let h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.78));
              } else {
                resolve(String(reader.result));
              }
            };
            img.onerror = () => reject(new Error('Gagal memproses gambar.'));
            img.src = String(reader.result);
          };
          reader.onerror = () => reject(new Error('Gagal membaca file.'));
          reader.readAsDataURL(file);
        } else {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Gagal membaca file.'));
          reader.readAsDataURL(file);
        }
      });

      if (dataUrl.length > 740000) {
        setErrorMsg(
          `Ukuran file "${file.name}" melebihi batas penyimpanan (${Math.round(dataUrl.length / 1024)} KB). Mohon kompres file hingga di bawah 500 KB.`
        );
        setUploadingReqId(null);
        return;
      }

      setUploadedDocs((prev) => ({
        ...prev,
        [req.id]: {
          reqId: req.id,
          docLabel: req.title,
          fileName: file.name.slice(0, 180),
          mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          fileSize: file.size,
          fileDataUrl: dataUrl,
        },
      }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setUploadingReqId(null);
    }
  };

  const handleSubmitRegistration = async () => {
    setErrorMsg(null);
    if (spamInput.trim() !== spamChallenge.answer) {
      setErrorMsg('Jawaban verifikasi keamanan (penjumlahan angka) belum tepat.');
      return;
    }
    if (!agreedDeclaration) {
      setErrorMsg('Anda wajib menyetujui pernyataan kebenaran data sebelum mengirim formulir.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate unique Registration Number tied to the active academic year
      const yearPrefix = config.activeYearLabel.split('/')[0].replace(/[^0-9]/g, '') || '2027';
      const randomDigits = String(Math.floor(1000 + Math.random() * 9000));
      const regNumber = `SPMB-${yearPrefix}-${randomDigits}`;
      const applicantId = regNumber;
      const cleanBirthDate = birthDate.trim().replace(/[^0-9\-]/g, '');
      const lookupId = `${regNumber}_${cleanBirthDate}`;

      const customSummaryParts = customFields.map(
        (cf) => `${cf.title}: ${(customValues[cf.id] || '-').trim()}`
      );
      const customDataSummary = customSummaryParts.join(' | ').slice(0, 1950);

      const requiredDocsCount = docRequirements.filter((r) => r.isRequired).length;
      const uploadedRequiredCount = docRequirements.filter(
        (r) => r.isRequired && Boolean(uploadedDocs[r.id])
      ).length;

      const batch = writeBatch(db);

      const applicantRef = doc(db, 'applicants', applicantId);
      const applicantPayload = {
        regNumber,
        academicYear: config.activeYearLabel.slice(0, 20),
        fullName: fullName.trim().slice(0, 150),
        nik: nik.trim().slice(0, 20),
        nisn: nisn.trim().slice(0, 20),
        gender,
        birthPlace: birthPlace.trim().slice(0, 100),
        birthDate: cleanBirthDate.slice(0, 20),
        religion: religion.trim().slice(0, 40),
        address: address.trim().slice(0, 500),
        village: village.trim().slice(0, 100),
        district: district.trim().slice(0, 100),
        regency: regency.trim().slice(0, 100),
        province: province.trim().slice(0, 100),
        postalCode: postalCode.trim().slice(0, 20),
        phone: phone.trim().slice(0, 30),
        email: email.trim().slice(0, 150),
        fatherName: fatherName.trim().slice(0, 150),
        fatherJob: (fatherJob.trim() || '-').slice(0, 100),
        fatherPhone: (fatherPhone.trim() || '-').slice(0, 30),
        motherName: motherName.trim().slice(0, 150),
        motherJob: (motherJob.trim() || '-').slice(0, 100),
        motherPhone: (motherPhone.trim() || '-').slice(0, 30),
        guardianName: (guardianName.trim() || '-').slice(0, 150),
        guardianJob: (guardianJob.trim() || '-').slice(0, 100),
        parentAddress: (parentAddress.trim() || address.trim()).slice(0, 500),
        previousSchool: previousSchool.trim().slice(0, 150),
        previousSchoolNpsn: (previousSchoolNpsn.trim() || '-').slice(0, 30),
        previousSchoolAddress: (previousSchoolAddress.trim() || '-').slice(0, 500),
        graduationYear: graduationYear.trim().slice(0, 10),
        certificateNumber: (certificateNumber.trim() || '-').slice(0, 100),
        customDataSummary: customDataSummary || '-',
        status: 'Menunggu verifikasi' as const,
        verificationNotes: 'Pendaftaran berhasil diterima sistem. Menunggu verifikasi berkas oleh Panitia SPMB.',
        docCompleteCount: uploadedRequiredCount,
        docTotalRequired: requiredDocsCount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(applicantRef, applicantPayload);

      // 2. PII-isolated status lookup document
      const lookupRef = doc(db, 'applicant_status_lookup', lookupId);
      batch.set(lookupRef, {
        applicantId,
        regNumber,
        academicYear: config.activeYearLabel.slice(0, 20),
        fullName: fullName.trim().slice(0, 150),
        nisn: nisn.trim().slice(0, 20),
        birthDate: cleanBirthDate.slice(0, 20),
        previousSchool: previousSchool.trim().slice(0, 150),
        status: 'Menunggu verifikasi',
        verificationNotes: 'Pendaftaran berhasil diterima sistem. Menunggu verifikasi berkas oleh Panitia SPMB.',
        docCompleteCount: uploadedRequiredCount,
        docTotalRequired: requiredDocsCount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Uploaded documents
      const savedDocsList: ApplicantDocument[] = [];
      for (const up of Object.values(uploadedDocs) as PendingDocUpload[]) {
        const safeDocId = `${applicantId}_${up.reqId.replace(/[^a-zA-Z0-9_\-]/g, '')}`;
        const docRef = doc(db, 'applicant_documents', safeDocId);
        const storagePath = `pendaftar/${regNumber}/${up.fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
        batch.set(docRef, {
          applicantId,
          regNumber,
          academicYear: config.activeYearLabel.slice(0, 20),
          docType: up.reqId.slice(0, 100),
          docLabel: up.docLabel.slice(0, 150),
          fileName: up.fileName.slice(0, 200),
          mimeType: up.mimeType.slice(0, 100),
          fileSize: up.fileSize,
          storagePath: storagePath.slice(0, 500),
          fileDataUrl: up.fileDataUrl,
          verificationStatus: 'Menunggu',
          adminNote: '-',
          uploadedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        savedDocsList.push({
          id: safeDocId,
          applicantId,
          regNumber,
          academicYear: config.activeYearLabel,
          docType: up.reqId,
          docLabel: up.docLabel,
          fileName: up.fileName,
          mimeType: up.mimeType,
          fileSize: up.fileSize,
          storagePath,
          fileDataUrl: up.fileDataUrl,
          verificationStatus: 'Menunggu',
          adminNote: '-',
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `applicants/${applicantId}`);
      }

      setSubmittedApplicant({
        id: applicantId,
        ...applicantPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSubmittedDocs(savedDocsList);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Gagal mengirim pendaftaran: ${err.message}`
          : 'Terjadi kesalahan saat menyimpan pendaftaran.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmation View after successful submission
  if (submittedApplicant) {
    return (
      <div className="max-w-4xl mx-auto my-8 bg-white border border-slate-200 rounded-xl p-6 md:p-10 shadow-xs">
        <div className="text-center border-b border-slate-200 pb-6 mb-6">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-xs font-semibold text-emerald-700 tracking-wide">
            PENDAFTARAN BERHASIL TERKIRIM · GRATIS 100%
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            Bukti Pendaftaran SPMB Online {config.officialName}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Tahun Ajaran Aktif: <span className="font-semibold text-slate-900">{submittedApplicant.academicYear}</span>
          </p>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-5 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-emerald-900 font-medium">Nomor Pendaftaran Resmi Anda (Harap Dicatat / Disimpan):</p>
            <p className="text-2xl font-mono font-bold text-emerald-900 tabular-nums mt-0.5">
              {submittedApplicant.regNumber}
            </p>
            <p className="text-xs text-emerald-800 mt-1">
              Tanggal Lahir Verifikasi: <span className="font-mono font-semibold">{submittedApplicant.birthDate}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => downloadRegistrationProofPdf(submittedApplicant, config)}
              className="px-4 py-2.5 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              Unduh Bukti Pendaftaran (PDF)
            </button>
            <button
              onClick={() => downloadBiodataPdf(submittedApplicant, submittedDocs, config)}
              className="px-4 py-2.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              Unduh Biodata Lengkap (PDF)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mb-8">
          <div className="space-y-2.5 border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Identitas Calon Murid
            </h3>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Nama Lengkap</span>
              <span className="font-medium text-slate-900 text-right">{submittedApplicant.fullName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">NISN / NIK</span>
              <span className="font-mono text-slate-900 tabular-nums">
                {submittedApplicant.nisn} / {submittedApplicant.nik}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Tempat, Tanggal Lahir</span>
              <span className="text-slate-900 text-right">
                {submittedApplicant.birthPlace}, {submittedApplicant.birthDate}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Asal Sekolah</span>
              <span className="text-slate-900 text-right">{submittedApplicant.previousSchool}</span>
            </div>
          </div>

          <div className="space-y-2.5 border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Status Pendaftaran & Berkas
            </h3>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Tahun Ajaran</span>
              <span className="font-mono font-semibold text-slate-900">{submittedApplicant.academicYear}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Status Saat Ini</span>
              <span className="font-semibold text-emerald-800">{submittedApplicant.status}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Dokumen Wajib</span>
              <span className="font-mono text-emerald-800 font-semibold tabular-nums">
                {submittedApplicant.docCompleteCount}/{submittedApplicant.docTotalRequired} Lengkap
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Biaya Pendaftaran</span>
              <span className="font-semibold text-emerald-800">GRATIS 100% (Rp 0)</span>
            </div>
          </div>
        </div>

        <div className="mb-8 border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Rincian Status Unggahan Dokumen Persyaratan
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {docRequirements.map((req) => {
              const matched = submittedDocs.find((d) => d.docType === req.id);
              return (
                <div key={req.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-medium text-slate-900">{req.title}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-500">
                      {req.isRequired ? 'Wajib' : 'Opsional'}
                    </span>
                  </div>
                  <span
                    className={`font-medium ${
                      matched
                        ? 'text-emerald-700'
                        : req.isRequired
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {matched
                      ? `Tersedia (${matched.fileName})`
                      : req.isRequired
                      ? 'Belum diunggah'
                      : 'Belum diunggah (opsional)'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Kembali ke Beranda
          </button>
          <button
            onClick={() =>
              onSuccessNavigateStatus(submittedApplicant.regNumber, submittedApplicant.birthDate)
            }
            className="px-5 py-2.5 bg-emerald-800 text-white text-sm font-semibold rounded-lg hover:bg-emerald-900"
          >
            Buka Halaman Cek Status Pendaftaran
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Form Header */}
      <div className="bg-maarif-emerald-gold text-white px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-emerald-800">
        <div>
          <div className="text-xs text-amber-200 font-semibold tracking-wide">
            FORMULIR RESMI SPMB ONLINE · TAHUN AJARAN {config.activeYearLabel} · GRATIS 100%
          </div>
          <h2 className="text-xl md:text-2xl font-bold mt-1 text-white">
            Pendaftaran Calon Murid Baru {config.officialName}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="self-start md:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          Kembali ke Beranda
        </button>
      </div>

      {/* Stepper Bar */}
      <div className="px-6 py-4 bg-emerald-50/60 border-b border-slate-200 flex items-center justify-between overflow-x-auto gap-4">
        {[
          { num: 1, label: '01. Data Calon Murid' },
          { num: 2, label: '02. Data Orang Tua/Wali' },
          { num: 3, label: '03. Sekolah Asal & Peminatan' },
          { num: 4, label: '04. Unggah Dokumen' },
          { num: 5, label: '05. Periksa & Kirim' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => {
              if (s.num < step) setStep(s.num as 1 | 2 | 3 | 4 | 5);
            }}
            className={`text-xs font-semibold whitespace-nowrap shrink-0 pb-1.5 border-b-2 transition-colors ${
              step === s.num
                ? 'border-emerald-800 text-emerald-950 font-bold'
                : step > s.num
                ? 'border-emerald-500 text-emerald-700 cursor-pointer'
                : 'border-transparent text-slate-400 cursor-default'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-6 md:p-8">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* STEP 1: DATA CALON MURID */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">A. Identitas Pribadi Calon Murid</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Isi sesuai dengan Ijazah/SKL dan Kartu Keluarga. Kolom bertanda (*) wajib diisi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Calon Murid *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Ahmad Fauzan Pratama"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIK (Nomor Induk Kependudukan) *
                </label>
                <input
                  type="text"
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={16}
                  placeholder="16 digit NIK sesuai KK"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NISN (Nomor Induk Siswa Nasional) *
                </label>
                <input
                  type="text"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={12}
                  placeholder="10 digit NISN"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Kelamin *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'Laki-laki' | 'Perempuan')}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-700"
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Agama *</label>
                <select
                  value={religion}
                  onChange={(e) => setReligion(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-700"
                >
                  <option value="Islam">Islam</option>
                  <option value="Kristen">Kristen</option>
                  <option value="Katolik">Katolik</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Buddha">Buddha</option>
                  <option value="Konghucu">Konghucu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tempat Lahir *
                </label>
                <input
                  type="text"
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  placeholder="Contoh: Padang Ratu"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Lahir *
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap (Jalan / Dusun / RT / RW) *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Dusun II RT 004 RW 002 Jl. KH. Hasyim Asy'ari"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Desa / Kelurahan *
                </label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="Contoh: Padang Ratu"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kecamatan *
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kabupaten / Kota *
                </label>
                <input
                  type="text"
                  value={regency}
                  onChange={(e) => setRegency(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Provinsi *
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Pos
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp Calon Murid *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email (Opsional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DATA ORANG TUA ATAU WALI */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">B. Data Orang Tua atau Wali</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lengkapi identitas Ayah, Ibu, dan Wali (jika ada) sesuai Kartu Keluarga.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Ayah *
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Nama Ayah Kandung"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pekerjaan Ayah
                </label>
                <input
                  type="text"
                  value={fatherJob}
                  onChange={(e) => setFatherJob(e.target.value)}
                  placeholder="Contoh: Petani / Wiraswasta / PNS"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP Ayah *
                </label>
                <input
                  type="tel"
                  value={fatherPhone}
                  onChange={(e) => setFatherPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Ibu *
                </label>
                <input
                  type="text"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="Nama Ibu Kandung"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pekerjaan Ibu
                </label>
                <input
                  type="text"
                  value={motherJob}
                  onChange={(e) => setMotherJob(e.target.value)}
                  placeholder="Contoh: Ibu Rumah Tangga / Guru"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP Ibu
                </label>
                <input
                  type="tel"
                  value={motherPhone}
                  onChange={(e) => setMotherPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Wali (Opsional)
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Kosongkan jika bersama orang tua"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pekerjaan Wali (Opsional)
                </label>
                <input
                  type="text"
                  value={guardianJob}
                  onChange={(e) => setGuardianJob(e.target.value)}
                  placeholder="Pekerjaan Wali"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Orang Tua / Wali
                </label>
                <input
                  type="text"
                  value={parentAddress}
                  onChange={(e) => setParentAddress(e.target.value)}
                  placeholder="Kosongkan jika sama dengan alamat murid"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DATA PENDIDIKAN SEBELUMNYA & DATA TAMBAHAN DINAMIS */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                C. Data Pendidikan Sebelumnya (SMP / MTs Asal)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Masukkan informasi sekolah asal tempat calon murid menyelesaikan pendidikan SMP/MTs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama SMP / MTs Asal *
                </label>
                <input
                  type="text"
                  value={previousSchool}
                  onChange={(e) => setPreviousSchool(e.target.value)}
                  placeholder="Contoh: MTs Ma'arif 02 Padang Ratu / SMPN 1 Padang Ratu"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NPSN Sekolah Asal (Jika Tersedia)
                </label>
                <input
                  type="text"
                  value={previousSchoolNpsn}
                  onChange={(e) => setPreviousSchoolNpsn(e.target.value)}
                  placeholder="8 digit NPSN sekolah asal"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Sekolah Asal
                </label>
                <input
                  type="text"
                  value={previousSchoolAddress}
                  onChange={(e) => setPreviousSchoolAddress(e.target.value)}
                  placeholder="Kecamatan / Kabupaten lokasi SMP/MTs asal"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tahun Lulus *
                </label>
                <input
                  type="text"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={4}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Seri Ijazah / SKL (Jika Sudah Ada)
                </label>
                <input
                  type="text"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  placeholder="Kosongkan jika ijazah belum terbit"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            {customFields.length > 0 && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    D. Informasi Tambahan & Peminatan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kolom tambahan sesuai konfigurasi Panitia SPMB Tahun Ajaran {config.activeYearLabel}.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map((field) => (
                    <div key={field.id} className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {field.title} {field.isRequired ? '*' : '(Opsional)'}
                      </label>
                      {field.description && (
                        <p className="text-xs text-slate-500 mb-1.5">{field.description}</p>
                      )}
                      <input
                        type={field.fieldType === 'number' ? 'number' : 'text'}
                        value={customValues[field.id] || ''}
                        onChange={(e) =>
                          setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder={`Isi ${field.title}`}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: UNGGAH DOKUMEN PERSYARATAN */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  E. Unggah Dokumen Persyaratan Calon Murid
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format yang didukung: PDF, JPG, atau PNG. Ijazah atau Surat Keterangan Lulus (SKL) bersifat{' '}
                  <strong className="text-slate-700">Opsional</strong> dan tidak wajib diunggah saat pendaftaran online.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-600 tabular-nums">
                Dokumen Wajib Terunggah:{' '}
                {docRequirements.filter((r) => r.isRequired && uploadedDocs[r.id]).length} /{' '}
                {docRequirements.filter((r) => r.isRequired).length}
              </div>
            </div>

            <div className="space-y-3">
              {docRequirements.map((req) => {
                const uploaded = uploadedDocs[req.id];
                const isUploading = uploadingReqId === req.id;

                return (
                  <div
                    key={req.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      uploaded
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <span>{req.title}</span>
                          <span className="text-slate-400">·</span>
                          <span
                            className={`text-xs font-medium ${
                              req.isRequired ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            {req.isRequired ? 'Wajib Diunggah' : 'Opsional'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{req.description}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          Format: {req.fieldType || 'PDF,JPG,PNG'} · Maks: {req.maxSizeKb || 500} KB ·{' '}
                          <span className={uploaded ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {uploaded
                              ? 'Sudah diunggah'
                              : req.isRequired
                              ? 'Belum diunggah'
                              : 'Belum diunggah (opsional)'}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {uploaded ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              {uploaded.fileName.slice(0, 22)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedDocs((prev) => {
                                  const copy = { ...prev };
                                  delete copy[req.id];
                                  return copy;
                                })
                              }
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus & Ganti File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0">
                            <Upload className="w-3.5 h-3.5" />
                            {isUploading ? 'Memproses...' : 'Pilih File'}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                              className="hidden"
                              disabled={isUploading}
                              onChange={(e) =>
                                handleFileChange(req, e.target.files ? e.target.files[0] : null)
                              }
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: RINGKASAN & KONFIRMASI PENGIRIMAN */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                F. Ringkasan Data & Konfirmasi Pengiriman
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Periksa kembali seluruh data di bawah ini sebelum mengirim pendaftaran untuk Tahun Ajaran{' '}
                <span className="font-semibold text-slate-900">{config.activeYearLabel}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-emerald-50/40 p-5 rounded-xl border border-slate-200">
              <div className="space-y-2">
                <p className="font-bold text-slate-900 text-sm mb-2">1. Data Calon Murid</p>
                <p><span className="text-slate-500">Nama Lengkap:</span> <span className="font-semibold text-slate-900">{fullName}</span></p>
                <p><span className="text-slate-500">NIK / NISN:</span> <span className="font-mono text-slate-900">{nik} / {nisn}</span></p>
                <p><span className="text-slate-500">Jenis Kelamin:</span> {gender}</p>
                <p><span className="text-slate-500">Tempat, Tgl Lahir:</span> {birthPlace}, {birthDate}</p>
                <p><span className="text-slate-500">Alamat:</span> {address}, {village}, Kec. {district}, {regency}</p>
                <p><span className="text-slate-500">Nomor HP:</span> <span className="font-mono">{phone}</span></p>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-slate-900 text-sm mb-2">2. Orang Tua, Sekolah Asal & Berkas</p>
                <p><span className="text-slate-500">Nama Ayah / Ibu:</span> {fatherName} / {motherName}</p>
                <p><span className="text-slate-500">No. HP Orang Tua:</span> <span className="font-mono">{fatherPhone || motherPhone}</span></p>
                <p><span className="text-slate-500">SMP / MTs Asal:</span> {previousSchool} ({graduationYear})</p>
                <p><span className="text-slate-500">Tahun Ajaran Daftar:</span> <span className="font-mono font-bold text-emerald-800">{config.activeYearLabel}</span></p>
                <p>
                  <span className="text-slate-500">Dokumen Wajib:</span>{' '}
                  <span className="font-mono font-semibold text-emerald-800">
                    {docRequirements.filter((r) => r.isRequired && uploadedDocs[r.id]).length} /{' '}
                    {docRequirements.filter((r) => r.isRequired).length} Lengkap
                  </span>
                </p>
                <p><span className="text-slate-500">Biaya Pendaftaran:</span> <span className="font-bold text-emerald-800">GRATIS 100%</span></p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <p className="font-semibold text-slate-900">Status Berkas Persyaratan:</p>
              <div className="divide-y divide-slate-100">
                {docRequirements.map((req) => {
                  const up = uploadedDocs[req.id];
                  return (
                    <div key={req.id} className="py-2 flex items-center justify-between gap-3">
                      <span className="text-slate-700">
                        {req.title}{' '}
                        <span className="text-slate-400">
                          ({req.isRequired ? 'Wajib' : 'Opsional'})
                        </span>
                      </span>
                      <span
                        className={
                          up
                            ? 'text-emerald-700 font-semibold'
                            : req.isRequired
                            ? 'text-amber-700 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {up
                          ? `Terunggah (${up.fileName.slice(0, 24)})`
                          : req.isRequired
                          ? 'Belum diunggah'
                          : 'Belum diunggah (opsional)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Spam Protection & Final Declaration */}
            <div className="p-4 border border-slate-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Verifikasi Keamanan Anti-Spam: Berapakah hasil dari{' '}
                  <span className="font-mono font-bold text-emerald-900">
                    {spamChallenge.a} + {spamChallenge.b}
                  </span>{' '}
                  ? *
                </label>
                <input
                  type="text"
                  value={spamInput}
                  onChange={(e) => setSpamInput(e.target.value)}
                  placeholder="Ketik angka jawaban"
                  className="w-40 px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={agreedDeclaration}
                  onChange={(e) => setAgreedDeclaration(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                />
                <span>
                  Saya menyatakan bahwa seluruh data dan dokumen yang saya unggah adalah benar,
                  asli, dan dapat dipertanggungjawabkan sesuai ketentuan SPMB {config.officialName}.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5)}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Sebelumnya
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !validateStep1()) return;
                if (step === 2 && !validateStep2()) return;
                if (step === 3 && !validateStep3()) return;
                if (step === 4 && !validateStep4()) return;
                setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
              }}
              className="px-5 py-2.5 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              Lanjutkan
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitRegistration}
              className="px-6 py-2.5 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <FileText className="w-4 h-4" />
              {isSubmitting ? 'Mengirim Pendaftaran...' : 'Kirim Pendaftaran Sekarang (Gratis 100%)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
