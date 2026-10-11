import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  Applicant,
  ApplicantDocument,
  SchoolConfig,
  SchoolItem,
} from '../types';

export interface ZipProgressState {
  isProcessing: boolean;
  processedFiles: number;
  totalFiles: number;
  currentStep: string;
  failedFiles: { fileName: string; reason: string }[];
  missingDocs: string[];
  missingRequiredDocs: string[];
  missingOptionalDocs: string[];
  completed: boolean;
}

function sanitizeFileName(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_');
}

function getExtensionFromMimeOrName(mimeType: string, fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase();
    if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) return ext;
  }
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('png')) return 'png';
  return 'jpg';
}

function mapStandardDocFileName(doc: ApplicantDocument): { folder: string; name: string } {
  const ext = getExtensionFromMimeOrName(doc.mimeType, doc.fileName);
  const labelLower = (doc.docLabel + ' ' + doc.docType).toLowerCase();

  if (labelLower.includes('foto')) {
    return { folder: '', name: `Pas_Foto.${ext}` };
  }
  if (labelLower.includes('keluarga') || labelLower.includes('kk')) {
    return { folder: '', name: `Kartu_Keluarga.${ext}` };
  }
  if (labelLower.includes('akta') || labelLower.includes('kelahiran')) {
    return { folder: '', name: `Akta_Kelahiran.${ext}` };
  }
  if (labelLower.includes('ijazah') || labelLower.includes('skl') || labelLower.includes('lulus')) {
    return { folder: '', name: `Ijazah_SKL.${ext}` };
  }
  const safeLabel = sanitizeFileName(doc.docLabel || doc.fileName || 'Dokumen');
  return { folder: 'Dokumen_Tambahan/', name: `${safeLabel}.${ext}` };
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function formatTimestampId(ts: unknown): string {
  if (!ts) return new Date().toLocaleDateString('id-ID');
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    const secs = (ts as { seconds: number }).seconds;
    return new Date(secs * 1000).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  if (typeof ts === 'string') {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }
    return ts;
  }
  return new Date().toLocaleDateString('id-ID');
}

function drawOfficialHeader(doc: jsPDF, config: SchoolConfig, academicYear: string, subtitle: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(6, 78, 59); // Emerald 900
  doc.text('PANITIA SISTEM PENERIMAAN MURID BARU (SPMB) ONLINE', 105, 16, { align: 'center' });

  doc.setFontSize(15);
  doc.text(config.officialName.toUpperCase(), 105, 23, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `NPSN: ${config.npsn || '-'}  |  Tahun Ajaran: ${academicYear}  |  Pendaftaran GRATIS 100%`,
    105,
    29,
    { align: 'center' }
  );
  doc.text(
    `${config.address}, Kec. ${config.district}, ${config.regency}, ${config.province} ${config.postalCode}`,
    105,
    34,
    { align: 'center' }
  );
  doc.text(`Telp/WA: ${config.whatsapp || config.phone}  |  Email: ${config.email}`, 105, 39, {
    align: 'center',
  });

  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.8);
  doc.line(15, 43, 195, 43);
  doc.setLineWidth(0.2);
  doc.line(15, 44.2, 195, 44.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(subtitle.toUpperCase(), 105, 52, { align: 'center' });

  return 58;
}

export function createRegistrationProofPdfBytes(
  applicant: Applicant,
  config: SchoolConfig
): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawOfficialHeader(
    doc,
    config,
    applicant.academicYear,
    `TANDA BUKTI PENDAFTARAN SPMB TAHUN AJARAN ${applicant.academicYear}`
  );

  // Registration Number Highlight Box
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(15, y, 180, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 78, 59);
  doc.text(`NOMOR PENDAFTARAN: ${applicant.regNumber}`, 20, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Status Saat Ini: ${applicant.status.toUpperCase()}`, 20, y + 13.5);
  doc.text(`Biaya Pendaftaran: GRATIS 100% (Rp 0,-)`, 190, y + 10.5, { align: 'right' });

  y += 25;

  const rows: [string, string][] = [
    ['Tahun Ajaran Pendaftaran', applicant.academicYear],
    ['Tanggal Pendaftaran', formatTimestampId(applicant.createdAt)],
    ['Nama Lengkap Calon Murid', applicant.fullName],
    ['NISN / NIK', `${applicant.nisn} / ${applicant.nik}`],
    ['Jenis Kelamin', applicant.gender],
    ['Tempat, Tanggal Lahir', `${applicant.birthPlace}, ${applicant.birthDate}`],
    ['Agama', applicant.religion],
    [
      'Alamat Lengkap',
      `${applicant.address}, ${applicant.village}, Kec. ${applicant.district}, ${applicant.regency}`,
    ],
    ['Nomor HP / WhatsApp', applicant.phone],
    ['Sekolah Asal (SMP/MTs)', `${applicant.previousSchool} (NPSN: ${applicant.previousSchoolNpsn || '-'})`],
    ['Tahun Lulus', applicant.graduationYear],
    ['Nama Ayah / Ibu', `${applicant.fatherName} / ${applicant.motherName}`],
    [
      'Kelengkapan Dokumen',
      `${applicant.docCompleteCount} dari ${applicant.docTotalRequired} Dokumen Wajib Terunggah`,
    ],
    ['Catatan Verifikasi Panitia', applicant.verificationNotes || 'Menunggu pemeriksaan berkas oleh panitia.'],
  ];

  doc.setFontSize(9.5);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(label, 18, y);
    doc.text(':', 72, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const splitVal = doc.splitTextToSize(String(value || '-'), 115);
    doc.text(splitVal, 76, y);
    y += Math.max(7, splitVal.length * 5);
  }

  y += 6;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(217, 119, 6);
  doc.roundedRect(15, y, 180, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text('INFORMASI PENTING:', 19, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(
    '1. Simpan bukti pendaftaran ini untuk melakukan Cek Status Pendaftaran dan Daftar Ulang.\n2. Seluruh proses SPMB SMA Ma\'arif 05 Padang Ratu tidak dipungut biaya pendaftaran (GRATIS 100%).',
    19,
    y + 11
  );

  y += 28;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(`Padang Ratu, ${formatTimestampId(new Date().toISOString())}`, 140, y);

  doc.text('Calon Murid,', 30, y + 6);
  doc.text('Ketua Panitia SPMB,', 140, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(`( ${applicant.fullName} )`, 30, y + 28);
  doc.text(`( ${config.committeeHeadName || 'Panitia SPMB'} )`, 140, y + 28);

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

export function createBiodataPdfBytes(
  applicant: Applicant,
  docs: ApplicantDocument[],
  config: SchoolConfig
): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawOfficialHeader(
    doc,
    config,
    applicant.academicYear,
    `BIODATA RESMI CALON MURID BARU TAHUN AJARAN ${applicant.academicYear}`
  );

  // Try to embed Pas Foto if uploaded as JPEG/PNG
  const photoDoc = docs.find(
    (d) =>
      d.applicantId === applicant.id &&
      d.docLabel.toLowerCase().includes('foto') &&
      d.fileDataUrl.startsWith('data:image/')
  );
  if (photoDoc) {
    try {
      const imgFormat = photoDoc.mimeType.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(photoDoc.fileDataUrl, imgFormat, 162, y, 28, 36);
      doc.setDrawColor(148, 163, 184);
      doc.rect(162, y, 28, 36);
    } catch {
      // Fallback box if image parsing fails
      doc.setDrawColor(148, 163, 184);
      doc.rect(162, y, 28, 36);
      doc.setFontSize(8);
      doc.text('Pas Foto 3x4', 176, y + 18, { align: 'center' });
    }
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.rect(162, y, 28, 36);
    doc.setFontSize(8);
    doc.text('Pas Foto 3x4', 176, y + 18, { align: 'center' });
  }

  const drawSectionTitle = (title: string, currentY: number) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(15, currentY - 4, 142, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text(title, 17, currentY + 0.5);
    return currentY + 7;
  };

  const drawField = (label: string, val: string, currentY: number, maxWidth = 90) => {
    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(51, 65, 85);
    doc.text(label, 17, currentY);
    doc.text(':', 66, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(String(val || '-'), maxWidth);
    doc.text(lines, 70, currentY);
    return currentY + Math.max(5.5, lines.length * 4.5);
  };

  y = drawSectionTitle('A. IDENTITAS PENDAFTARAN & PRIBADI CALON MURID', y);
  y = drawField('Nomor Pendaftaran', applicant.regNumber, y, 85);
  y = drawField('Tahun Ajaran', applicant.academicYear, y, 85);
  y = drawField('Status Seleksi / Verifikasi', applicant.status, y, 85);
  y = drawField('Nama Lengkap', applicant.fullName, y, 85);
  y = drawField('NIK', applicant.nik, y, 85);
  y = drawField('NISN', applicant.nisn, y, 85);
  y = drawField('Jenis Kelamin', applicant.gender, y, 115);
  y = drawField('Tempat, Tanggal Lahir', `${applicant.birthPlace}, ${applicant.birthDate}`, y, 115);
  y = drawField('Agama', applicant.religion, y, 115);
  y = drawField(
    'Alamat Lengkap',
    `${applicant.address}, Desa/Kel. ${applicant.village}, Kec. ${applicant.district}, ${applicant.regency}, ${applicant.province} (${applicant.postalCode || '-'})`,
    y,
    115
  );
  y = drawField('Nomor HP / Email', `${applicant.phone} / ${applicant.email || '-'}`, y, 115);

  y += 2;
  y = drawSectionTitle('B. DATA ORANG TUA ATAU WALI', y);
  y = drawField('Nama Ayah Kandung', `${applicant.fatherName} (Pekerjaan: ${applicant.fatherJob || '-'})`, y, 115);
  y = drawField('Nomor HP Ayah', applicant.fatherPhone || '-', y, 115);
  y = drawField('Nama Ibu Kandung', `${applicant.motherName} (Pekerjaan: ${applicant.motherJob || '-'})`, y, 115);
  y = drawField('Nomor HP Ibu', applicant.motherPhone || '-', y, 115);
  y = drawField('Nama Wali (Jika Ada)', `${applicant.guardianName || '-'} (${applicant.guardianJob || '-'})`, y, 115);
  y = drawField('Alamat Orang Tua / Wali', applicant.parentAddress || applicant.address, y, 115);

  y += 2;
  y = drawSectionTitle('C. DATA PENDIDIKAN SEBELUMNYA & TAMBAHAN', y);
  y = drawField('Nama SMP / MTs Asal', applicant.previousSchool, y, 115);
  y = drawField('NPSN Sekolah Asal', applicant.previousSchoolNpsn || '-', y, 115);
  y = drawField('Alamat Sekolah Asal', applicant.previousSchoolAddress || '-', y, 115);
  y = drawField('Tahun Lulus & No. Ijazah', `${applicant.graduationYear} / ${applicant.certificateNumber || '-'}`, y, 115);
  y = drawField('Data Tambahan / Peminatan', applicant.customDataSummary || '-', y, 115);
  y = drawField('Tanggal Pendaftaran', formatTimestampId(applicant.createdAt), y, 115);

  if (y > 240) {
    doc.addPage();
    y = 25;
  } else {
    y += 8;
  }

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Padang Ratu, ${formatTimestampId(new Date().toISOString())}`, 140, y);

  doc.text('Orang Tua / Wali,', 20, y + 6);
  doc.text('Calon Murid,', 82, y + 6);
  doc.text('Kepala Sekolah / Ketua Panitia,', 140, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(`( ${applicant.fatherName || applicant.motherName || '...................'} )`, 20, y + 26);
  doc.text(`( ${applicant.fullName} )`, 82, y + 26);
  doc.text(`( ${config.committeeHeadName || config.principalName} )`, 140, y + 26);

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

export function createDocumentCompletenessReportPdfBytes(
  applicant: Applicant,
  docs: ApplicantDocument[],
  requirements: SchoolItem[],
  config: SchoolConfig,
  failedDownloads: { fileName: string; reason: string }[] = []
): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawOfficialHeader(
    doc,
    config,
    applicant.academicYear,
    `LAPORAN KELENGKAPAN DOKUMEN PENDAFTAR (${applicant.regNumber})`
  );

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Nama Calon Murid : ${applicant.fullName}`, 15, y);
  doc.text(`Nomor Pendaftaran : ${applicant.regNumber}`, 120, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Asal Sekolah : ${applicant.previousSchool}`, 15, y);
  doc.text(`Tahun Ajaran : ${applicant.academicYear}`, 120, y);
  y += 6;
  doc.text(`Status Pendaftaran : ${applicant.status}`, 15, y);
  y += 9;

  // Table Header
  doc.setFillColor(6, 78, 59);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('No', 18, y + 5.5);
  doc.text('Nama Dokumen Persyaratan', 28, y + 5.5);
  doc.text('Sifat', 95, y + 5.5);
  doc.text('Status Unggah', 118, y + 5.5);
  doc.text('Verifikasi & Catatan', 152, y + 5.5);
  y += 8;

  const applicantDocs = docs.filter(
    (d) => d.applicantId === applicant.id && d.regNumber === applicant.regNumber
  );

  const activeReqs = requirements
    .filter((r) => r.category === 'doc_requirement' && r.isActive)
    .sort((a, b) => a.order - b.order);

  const missingRequiredList: string[] = [];
  const missingOptionalList: string[] = [];

  activeReqs.forEach((req, idx) => {
    const matched = applicantDocs.find(
      (d) => d.docType === req.id || d.docLabel.toLowerCase() === req.title.toLowerCase()
    );
    if (!matched) {
      if (req.isRequired) {
        missingRequiredList.push(req.title);
      } else {
        missingOptionalList.push(`${req.title}: Belum diunggah (opsional)`);
      }
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, 180, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(idx + 1), 18, y + 6);
    doc.text(req.title.slice(0, 36), 28, y + 6);
    doc.text(req.isRequired ? 'Wajib' : 'Opsional', 95, y + 6);
    doc.text(
      matched
        ? 'Tersedia'
        : req.isRequired
        ? 'Belum diunggah'
        : 'Belum diunggah (opsional)',
      118,
      y + 6
    );
    doc.text(
      matched ? `${matched.verificationStatus} ${matched.adminNote ? '(' + matched.adminNote.slice(0, 15) + ')' : ''}` : '-',
      152,
      y + 6
    );
    y += 9;
  });

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(6, 78, 59);
  doc.text('1. Ringkasan Dokumen Wajib:', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  if (missingRequiredList.length === 0) {
    doc.text('- Seluruh dokumen wajib telah lengkap dan tersedia.', 18, y);
    y += 5;
  } else {
    missingRequiredList.forEach((item) => {
      doc.text(`- ${item}: Belum tersedia (Wajib)`, 18, y);
      y += 5;
    });
  }

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('2. Ringkasan Dokumen Opsional (Termasuk Ijazah/SKL jika belum terbit):', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  if (missingOptionalList.length === 0) {
    doc.text('- Seluruh dokumen opsional telah diunggah.', 18, y);
    y += 5;
  } else {
    missingOptionalList.forEach((item) => {
      doc.text(`- ${item}`, 18, y);
      y += 5;
    });
  }

  if (failedDownloads.length > 0) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text('Daftar Dokumen yang Gagal Diproses:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    failedDownloads.forEach((f) => {
      doc.text(`- ${f.fileName}: ${f.reason}`, 18, y);
      y += 5;
    });
  }

  y += 8;
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8.5);
  doc.text(
    `Dicetak otomatis oleh Sistem SPMB Online ${config.officialName} pada ${new Date().toLocaleString('id-ID')}.`,
    15,
    y
  );

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function downloadRegistrationProofPdf(applicant: Applicant, config: SchoolConfig) {
  const bytes = createRegistrationProofPdfBytes(applicant, config);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const safeName = sanitizeFileName(applicant.fullName);
  triggerBrowserDownload(blob, `Bukti_Pendaftaran_${safeName}_${applicant.regNumber}.pdf`);
}

export function downloadBiodataPdf(
  applicant: Applicant,
  docs: ApplicantDocument[],
  config: SchoolConfig
) {
  const bytes = createBiodataPdfBytes(applicant, docs, config);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const safeName = sanitizeFileName(applicant.fullName);
  triggerBrowserDownload(blob, `Biodata_${safeName}_${applicant.regNumber}.pdf`);
}

/**
 * Section 12.A: Unduh Semua Dokumen (ZIP)
 */
export async function downloadAllDocumentsZip(
  applicant: Applicant,
  allDocs: ApplicantDocument[],
  requirements: SchoolItem[],
  onProgress: (state: ZipProgressState) => void
): Promise<ZipProgressState> {
  // Strictly isolate to this single applicant
  const applicantDocs = allDocs.filter(
    (d) => d.applicantId === applicant.id && d.regNumber === applicant.regNumber
  );

  const activeReqs = requirements.filter((r) => r.category === 'doc_requirement' && r.isActive);
  const missingDocs: string[] = [];
  const missingRequiredDocs: string[] = [];
  const missingOptionalDocs: string[] = [];

  activeReqs.forEach((req) => {
    const exists = applicantDocs.some(
      (d) => d.docType === req.id || d.docLabel.toLowerCase() === req.title.toLowerCase()
    );
    if (!exists) {
      if (req.isRequired) {
        const msg = `${req.title}: Belum tersedia (Wajib)`;
        missingRequiredDocs.push(msg);
        missingDocs.push(msg);
      } else {
        const msg = `${req.title}: Belum diunggah (opsional)`;
        missingOptionalDocs.push(msg);
        missingDocs.push(msg);
      }
    }
  });

  const state: ZipProgressState = {
    isProcessing: true,
    processedFiles: 0,
    totalFiles: applicantDocs.length,
    currentStep: 'Mempersiapkan arsip dokumen pendaftar...',
    failedFiles: [],
    missingDocs,
    missingRequiredDocs,
    missingOptionalDocs,
    completed: false,
  };
  onProgress({ ...state });

  const zip = new JSZip();
  const rootFolder = zip.folder(applicant.regNumber);

  if (!rootFolder) {
    throw new Error('Gagal membuat direktori utama di dalam arsip ZIP.');
  }

  for (let i = 0; i < applicantDocs.length; i++) {
    const docItem = applicantDocs[i];
    state.currentStep = `Mengunduh dan mengemas: ${docItem.docLabel} (${docItem.fileName})...`;
    onProgress({ ...state });

    try {
      if (!docItem.fileDataUrl || docItem.fileDataUrl.length < 15) {
        throw new Error('Konten file kosong atau referensi tidak ditemukan di penyimpanan.');
      }
      const bytes = dataUrlToUint8Array(docItem.fileDataUrl);
      const mapped = mapStandardDocFileName(docItem);
      rootFolder.file(`${mapped.folder}${mapped.name}`, bytes);
      state.processedFiles += 1;
      onProgress({ ...state });
    } catch (err) {
      state.failedFiles.push({
        fileName: docItem.fileName || docItem.docLabel,
        reason: err instanceof Error ? err.message : 'Gagal membaca file dari penyimpanan.',
      });
      onProgress({ ...state });
    }
  }

  // Include completeness summary note inside the folder separating required vs optional
  const summaryLines = [
    `ARSIP DOKUMEN CALON MURID - ${applicant.regNumber}`,
    `Nama Lengkap     : ${applicant.fullName}`,
    `Tahun Ajaran     : ${applicant.academicYear}`,
    `Asal Sekolah     : ${applicant.previousSchool}`,
    `Status Verifikasi: ${applicant.status}`,
    `Waktu Unduh ZIP  : ${new Date().toLocaleString('id-ID')}`,
    '',
    '=== DOKUMEN TERUNGGAH ===',
    ...(applicantDocs.length > 0
      ? applicantDocs.map(
          (d, idx) => `${idx + 1}. ${d.docLabel} -> ${d.fileName} [Status: ${d.verificationStatus}]`
        )
      : ['Belum ada dokumen yang diunggah.']),
    '',
    '=== DOKUMEN WAJIB BELUM TERSEDIA ===',
    ...(missingRequiredDocs.length > 0
      ? missingRequiredDocs
      : ['Seluruh dokumen wajib telah lengkap.']),
    '',
    '=== DOKUMEN OPSIONAL BELUM DIUNGGAH ===',
    ...(missingOptionalDocs.length > 0
      ? missingOptionalDocs
      : ['Seluruh dokumen opsional telah diunggah.']),
    '',
    ...(state.failedFiles.length > 0
      ? [
          '=== DOKUMEN GAGAL DIPROSES ===',
          ...state.failedFiles.map((f) => `- ${f.fileName}: ${f.reason}`),
        ]
      : []),
  ];

  rootFolder.file('Catatan_Kelengkapan_Dokumen.txt', summaryLines.join('\n'));

  state.currentStep = 'Menyusun file arsip ZIP...';
  onProgress({ ...state });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const safeName = sanitizeFileName(applicant.fullName);
  triggerBrowserDownload(zipBlob, `${safeName}_${applicant.regNumber}.zip`);

  state.isProcessing = false;
  state.completed = true;
  state.currentStep =
    state.failedFiles.length > 0
      ? `Arsip diunduh dengan ${state.failedFiles.length} peringatan file gagal.`
      : 'Seluruh dokumen tersedia berhasil dikemas dan diunduh.';
  onProgress({ ...state });
  return state;
}

/**
 * Section 12.B: Unduh Biodata + Semua Dokumen (ZIP)
 */
export async function downloadBiodataAndDocumentsZip(
  applicant: Applicant,
  allDocs: ApplicantDocument[],
  requirements: SchoolItem[],
  config: SchoolConfig,
  onProgress: (state: ZipProgressState) => void
): Promise<ZipProgressState> {
  const applicantDocs = allDocs.filter(
    (d) => d.applicantId === applicant.id && d.regNumber === applicant.regNumber
  );

  const activeReqs = requirements.filter((r) => r.category === 'doc_requirement' && r.isActive);
  const missingDocs: string[] = [];
  const missingRequiredDocs: string[] = [];
  const missingOptionalDocs: string[] = [];

  activeReqs.forEach((req) => {
    const exists = applicantDocs.some(
      (d) => d.docType === req.id || d.docLabel.toLowerCase() === req.title.toLowerCase()
    );
    if (!exists) {
      if (req.isRequired) {
        const msg = `${req.title}: Belum tersedia (Wajib)`;
        missingRequiredDocs.push(msg);
        missingDocs.push(msg);
      } else {
        const msg = `${req.title}: Belum diunggah (opsional)`;
        missingOptionalDocs.push(msg);
        missingDocs.push(msg);
      }
    }
  });

  const state: ZipProgressState = {
    isProcessing: true,
    processedFiles: 0,
    totalFiles: applicantDocs.length + 2, // + Biodata_Pendaftar.pdf + Laporan_Kelengkapan_Dokumen.pdf
    currentStep: 'Membuat Biodata_Pendaftar.pdf resmi (A4)...',
    failedFiles: [],
    missingDocs,
    missingRequiredDocs,
    missingOptionalDocs,
    completed: false,
  };
  onProgress({ ...state });

  const zip = new JSZip();
  const rootFolder = zip.folder(applicant.regNumber);

  if (!rootFolder) {
    throw new Error('Gagal membuat direktori utama di dalam arsip ZIP.');
  }

  // 1. Add Biodata_Pendaftar.pdf
  const biodataBytes = createBiodataPdfBytes(applicant, applicantDocs, config);
  rootFolder.file('Biodata_Pendaftar.pdf', biodataBytes);
  state.processedFiles += 1;
  onProgress({ ...state });

  // 2. Process all uploaded documents (including Ijazah/SKL if available; never fails if optional docs are absent)
  for (let i = 0; i < applicantDocs.length; i++) {
    const docItem = applicantDocs[i];
    state.currentStep = `Mengemas dokumen asli: ${docItem.docLabel} (${docItem.fileName})...`;
    onProgress({ ...state });

    try {
      if (!docItem.fileDataUrl || docItem.fileDataUrl.length < 15) {
        throw new Error('Konten file kosong atau gagal diambil dari penyimpanan.');
      }
      const bytes = dataUrlToUint8Array(docItem.fileDataUrl);
      const mapped = mapStandardDocFileName(docItem);
      rootFolder.file(`${mapped.folder}${mapped.name}`, bytes);
      state.processedFiles += 1;
      onProgress({ ...state });
    } catch (err) {
      state.failedFiles.push({
        fileName: docItem.fileName || docItem.docLabel,
        reason: err instanceof Error ? err.message : 'Gagal membaca file dari penyimpanan.',
      });
      onProgress({ ...state });
    }
  }

  // 3. Add Laporan_Kelengkapan_Dokumen.pdf
  state.currentStep = 'Membuat Laporan_Kelengkapan_Dokumen.pdf...';
  onProgress({ ...state });
  const reportBytes = createDocumentCompletenessReportPdfBytes(
    applicant,
    applicantDocs,
    requirements,
    config,
    state.failedFiles
  );
  rootFolder.file('Laporan_Kelengkapan_Dokumen.pdf', reportBytes);
  state.processedFiles += 1;
  onProgress({ ...state });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const safeName = sanitizeFileName(applicant.fullName);
  triggerBrowserDownload(zipBlob, `${safeName}_${applicant.regNumber}_Biodata_dan_Dokumen.zip`);

  state.isProcessing = false;
  state.completed = true;
  state.currentStep =
    state.failedFiles.length > 0
      ? `Arsip selesai dengan ${state.failedFiles.length} peringatan file gagal.`
      : 'Biodata PDF, Laporan Kelengkapan PDF, dan seluruh dokumen tersedia berhasil diunduh.';
  onProgress({ ...state });
  return state;
}

/**
 * Section 13: Ekspor Excel (.xlsx) dan CSV (.csv) berdasarkan filter Tahun Ajaran
 */
export function exportApplicantsToExcel(applicants: Applicant[], academicYearFilter: string) {
  const rows = applicants.map((a, index) => ({
    No: index + 1,
    'Nomor Pendaftaran': a.regNumber,
    'Tahun Ajaran': a.academicYear,
    'Nama Lengkap': a.fullName,
    NIK: a.nik,
    NISN: a.nisn,
    'Jenis Kelamin': a.gender,
    'Tempat Lahir': a.birthPlace,
    'Tanggal Lahir': a.birthDate,
    Agama: a.religion,
    Alamat: a.address,
    'Desa/Kelurahan': a.village,
    Kecamatan: a.district,
    'Kabupaten/Kota': a.regency,
    Provinsi: a.province,
    'Kode Pos': a.postalCode,
    'No. HP Murid': a.phone,
    Email: a.email,
    'Nama Ayah': a.fatherName,
    'Pekerjaan Ayah': a.fatherJob,
    'No. HP Ayah': a.fatherPhone,
    'Nama Ibu': a.motherName,
    'Pekerjaan Ibu': a.motherJob,
    'No. HP Ibu': a.motherPhone,
    'Nama Wali': a.guardianName,
    'Asal Sekolah (SMP/MTs)': a.previousSchool,
    'NPSN Sekolah Asal': a.previousSchoolNpsn,
    'Tahun Lulus': a.graduationYear,
    'No. Ijazah/SKL': a.certificateNumber,
    'Data Tambahan': a.customDataSummary,
    'Dokumen Terunggah': `${a.docCompleteCount}/${a.docTotalRequired}`,
    'Status Pendaftaran': a.status,
    'Catatan Verifikasi': a.verificationNotes,
    'Tanggal Daftar': formatTimestampId(a.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Pendaftar_${academicYearFilter.replace('/', '-')}`);
  XLSX.writeFile(
    workbook,
    `Data_Pendaftar_SPMB_SMA_Maarif_05_${academicYearFilter.replace('/', '-')}.xlsx`
  );
}

export function exportApplicantsToCsv(applicants: Applicant[], academicYearFilter: string) {
  const headers = [
    'No',
    'Nomor Pendaftaran',
    'Tahun Ajaran',
    'Nama Lengkap',
    'NIK',
    'NISN',
    'Jenis Kelamin',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Agama',
    'Alamat',
    'Kecamatan',
    'Kabupaten',
    'No HP',
    'Nama Ayah',
    'Nama Ibu',
    'Asal Sekolah',
    'NPSN Asal',
    'Tahun Lulus',
    'Kelengkapan Dokumen',
    'Status Pendaftaran',
    'Tanggal Daftar',
  ];

  const escapeCsv = (val: unknown) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines = [
    headers.map(escapeCsv).join(','),
    ...applicants.map((a, idx) =>
      [
        idx + 1,
        a.regNumber,
        a.academicYear,
        a.fullName,
        a.nik,
        a.nisn,
        a.gender,
        a.birthPlace,
        a.birthDate,
        a.religion,
        `${a.address}, ${a.village}`,
        a.district,
        a.regency,
        a.phone,
        a.fatherName,
        a.motherName,
        a.previousSchool,
        a.previousSchoolNpsn,
        a.graduationYear,
        `${a.docCompleteCount}/${a.docTotalRequired}`,
        a.status,
        formatTimestampId(a.createdAt),
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerBrowserDownload(
    blob,
    `Data_Pendaftar_SPMB_SMA_Maarif_05_${academicYearFilter.replace('/', '-')}.csv`
  );
}

export type ReportPrintMode =
  | 'all'
  | 'by_status'
  | 'by_gender'
  | 'by_school'
  | 'by_docs';

export function downloadSummaryReportPdf(
  applicants: Applicant[],
  config: SchoolConfig,
  academicYearFilter: string,
  mode: ReportPrintMode
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const modeTitles: Record<ReportPrintMode, string> = {
    all: `LAPORAN DAFTAR SELURUH PENDAFTAR TAHUN AJARAN ${academicYearFilter}`,
    by_status: `LAPORAN REKAPITULASI PENDAFTAR BERDASARKAN STATUS (${academicYearFilter})`,
    by_gender: `LAPORAN REKAPITULASI PENDAFTAR BERDASARKAN JENIS KELAMIN (${academicYearFilter})`,
    by_school: `LAPORAN REKAPITULASI PENDAFTAR BERDASARKAN ASAL SEKOLAH (${academicYearFilter})`,
    by_docs: `LAPORAN REKAPITULASI KELENGKAPAN DOKUMEN PENDAFTAR (${academicYearFilter})`,
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(6, 78, 59);
  doc.text(config.officialName.toUpperCase(), 148.5, 14, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `NPSN: ${config.npsn} | Alamat: ${config.address}, Kec. ${config.district}, ${config.regency}`,
    148.5,
    20,
    { align: 'center' }
  );

  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.6);
  doc.line(15, 24, 282, 24);

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(modeTitles[mode], 148.5, 31, { align: 'center' });

  let y = 38;

  if (mode === 'by_gender') {
    const male = applicants.filter((a) => a.gender === 'Laki-laki').length;
    const female = applicants.filter((a) => a.gender === 'Perempuan').length;
    doc.setFontSize(10);
    doc.text(
      `Ringkasan Tahun Ajaran ${academicYearFilter}: Total = ${applicants.length} Murid  |  Laki-laki = ${male} Murid  |  Perempuan = ${female} Murid`,
      15,
      y
    );
    y += 7;
  } else if (mode === 'by_school') {
    const schoolCounts: Record<string, number> = {};
    applicants.forEach((a) => {
      const key = a.previousSchool || 'Tidak Diketahui';
      schoolCounts[key] = (schoolCounts[key] || 0) + 1;
    });
    doc.setFontSize(9.5);
    doc.text('Rekapitulasi Jumlah Pendaftar per Sekolah Asal (SMP/MTs):', 15, y);
    y += 6;
    Object.entries(schoolCounts).forEach(([sch, count], idx) => {
      if (y > 180) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'normal');
      doc.text(`${idx + 1}. ${sch}: ${count} calon murid`, 18, y);
      y += 5.5;
    });
    y += 4;
  }

  // Table header
  doc.setFillColor(6, 78, 59);
  doc.rect(15, y, 267, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('No', 18, y + 5.5);
  doc.text('No. Pendaftaran', 28, y + 5.5);
  doc.text('Thn Ajaran', 65, y + 5.5);
  doc.text('Nama Lengkap Calon Murid', 88, y + 5.5);
  doc.text('L/P', 148, y + 5.5);
  doc.text('NISN', 162, y + 5.5);
  doc.text('Asal Sekolah (SMP/MTs)', 188, y + 5.5);
  doc.text('Dokumen', 235, y + 5.5);
  doc.text('Status Seleksi', 253, y + 5.5);
  y += 8;

  applicants.forEach((a, index) => {
    if (y > 185) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, 267, 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(String(index + 1), 18, y + 5);
    doc.text(a.regNumber, 28, y + 5);
    doc.text(a.academicYear, 65, y + 5);
    doc.text(a.fullName.slice(0, 32), 88, y + 5);
    doc.text(a.gender === 'Laki-laki' ? 'L' : 'P', 148, y + 5);
    doc.text(a.nisn, 162, y + 5);
    doc.text(a.previousSchool.slice(0, 25), 188, y + 5);
    doc.text(`${a.docCompleteCount}/${a.docTotalRequired}`, 235, y + 5);
    doc.text(a.status, 253, y + 5);
    y += 7.5;
  });

  y += 10;
  if (y > 175) {
    doc.addPage();
    y = 25;
  }
  doc.setFontSize(9);
  doc.text(`Padang Ratu, ${formatTimestampId(new Date().toISOString())}`, 220, y);
  doc.text('Mengetahui, Kepala Sekolah', 30, y + 5);
  doc.text('Ketua Panitia SPMB', 220, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${config.principalName} )`, 30, y + 22);
  doc.text(`( ${config.committeeHeadName} )`, 220, y + 22);

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([new Uint8Array(arrayBuffer)], { type: 'application/pdf' });
  triggerBrowserDownload(
    blob,
    `Laporan_SPMB_${mode}_${academicYearFilter.replace('/', '-')}.pdf`
  );
}
