import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Calendar,
  Building2,
  FileSpreadsheet,
  Bell,
  Shield,
  Database,
  LogOut,
  Search,
  Printer,
  Download,
  FolderArchive,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  BookOpen,
  Eye,
  ArrowLeft,
  Lock,
  Edit3,
  Upload,
  CheckCircle2,
  X,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AcademicYear,
  AdminRole,
  AdminUser,
  Announcement,
  Applicant,
  ApplicantDocument,
  ApplicantStatus,
  ASSETS,
  AuditLog,
  DEFAULT_ACADEMIC_YEARS,
  DEFAULT_ANNOUNCEMENTS,
  DEFAULT_SCHOOL_CONFIG,
  DEFAULT_SCHOOL_ITEMS,
  SchoolConfig,
  SchoolItem,
  SchoolItemCategory,
} from '../types';
import {
  downloadAllDocumentsZip,
  downloadBiodataAndDocumentsZip,
  downloadBiodataPdf,
  downloadRegistrationProofPdf,
  downloadSummaryReportPdf,
  exportApplicantsToCsv,
  exportApplicantsToExcel,
  formatTimestampId,
  ReportPrintMode,
  ZipProgressState,
} from '../utils/exportAndZip';

interface AdminDashboardProps {
  currentUser: User | null;
  config: SchoolConfig;
  academicYears: AcademicYear[];
  items: SchoolItem[];
  announcements: Announcement[];
  initialTab?: string;
  onBackToPublic: () => void;
}

type AdminTab =
  | 'overview'
  | 'applicants'
  | 'verification'
  | 'reports'
  | 'academic_years'
  | 'school_settings'
  | 'form_docs'
  | 'announcements_gallery'
  | 'accounts_security'
  | 'audit_backup_guide';

async function compressImageFileToDataUrl(file: File, maxDim = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!file.type.startsWith('image/')) {
        resolve(String(reader.result));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
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
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(String(reader.result));
        }
      };
      img.onerror = () => reject(new Error('Gagal memproses gambar.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  config,
  academicYears: propAcademicYears,
  items: propItems,
  announcements: propAnnouncements,
  initialTab = 'overview',
  onBackToPublic,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>((initialTab as AdminTab) || 'overview');
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as AdminTab);
    }
  }, [initialTab]);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(
    config.activeYearLabel || '2027/2028'
  );
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Full Admin collections (including inactive/draft items)
  const [allAcademicYears, setAllAcademicYears] = useState<AcademicYear[]>(propAcademicYears);
  const [allItems, setAllItems] = useState<SchoolItem[]>(propItems);
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>(propAnnouncements);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [documents, setDocuments] = useState<ApplicantDocument[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Detail & ZIP state
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgressState | null>(null);
  const [lastZipMode, setLastZipMode] = useState<'docs_only' | 'biodata_and_docs' | null>(null);

  // Search & Filter on Applicants table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [genderFilter, setGenderFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Category filter on Tab 7 (Konten, Formulir & Persyaratan)
  const [itemCategoryFilter, setItemCategoryFilter] = useState<SchoolItemCategory | 'ALL'>('ALL');

  // Editable School Config state
  const [editConfig, setEditConfig] = useState<SchoolConfig>(config);
  useEffect(() => {
    setEditConfig(config);
  }, [config]);

  // EDIT MODALS STATE (Admin can edit EVERYTHING)
  const [editingApplicant, setEditingApplicant] = useState<Applicant | null>(null);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [editingItem, setEditingItem] = useState<SchoolItem | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editingAdminUser, setEditingAdminUser] = useState<AdminUser | null>(null);

  // Admin document upload for a specific applicant
  const [adminDocReqId, setAdminDocReqId] = useState<string>('');
  const [uploadingAdminDoc, setUploadingAdminDoc] = useState(false);

  // Confirmation modal for switching active Academic Year
  const [confirmYearSwitch, setConfirmYearSwitch] = useState<AcademicYear | null>(null);
  // Confirmation modal for deleting item/applicant/year/announcement/admin
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    type: 'applicant' | 'item' | 'announcement' | 'year' | 'admin' | 'document';
    id: string;
    label: string;
  } | null>(null);

  // Forms for adding new records
  const [newYearLabel, setNewYearLabel] = useState('2028/2029');
  const [newYearOpenDate, setNewYearOpenDate] = useState('2028-01-15');
  const [newYearCloseDate, setNewYearCloseDate] = useState('2028-07-10');
  const [newYearAnnounceDate, setNewYearAnnounceDate] = useState('2028-07-15');
  const [newYearQuota, setNewYearQuota] = useState(180);

  const [newItemCategory, setNewItemCategory] = useState<SchoolItemCategory>('program');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemRequired, setNewItemRequired] = useState(false);
  const [newItemFieldType, setNewItemFieldType] = useState('text');
  const [newItemMaxSizeKb, setNewItemMaxSizeKb] = useState(500);
  const [newItemAcademicYear, setNewItemAcademicYear] = useState('ALL');

  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnImageUrl, setNewAnnImageUrl] = useState('');
  const [newAnnDate, setNewAnnDate] = useState(new Date().toISOString().slice(0, 10));

  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('Panitia SPMB');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  // Determine current user's Role
  const currentUserRole: AdminRole | null = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.email === 'aprizamairizon12@gmail.com') return 'Super Admin';
    const matched = adminUsers.find((a) => a.uid === currentUser.uid && a.isActive);
    return matched ? matched.role : null;
  }, [currentUser, adminUsers]);

  const canManageConfig =
    currentUserRole === 'Super Admin' || currentUserRole === 'Admin SPMB';
  const canVerifyApplicants =
    canManageConfig || currentUserRole === 'Panitia SPMB';
  const isSuperAdmin = currentUserRole === 'Super Admin';

  // Attach real-time listeners when authenticated as staff
  useEffect(() => {
    if (!currentUser) return;
    setLoadingData(true);

    const unsubAdmins = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const list: AdminUser[] = [];
        snap.forEach((d) => list.push(d.data() as AdminUser));
        setAdminUsers(list);
      },
      () => {}
    );

    const unsubYears = onSnapshot(
      collection(db, 'academic_years'),
      (snap) => {
        if (!snap.empty) {
          const list: AcademicYear[] = [];
          snap.forEach((d) =>
            list.push({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) })
          );
          setAllAcademicYears(list);
        }
      },
      () => {}
    );

    const unsubItems = onSnapshot(
      collection(db, 'school_items'),
      (snap) => {
        if (!snap.empty) {
          const list: SchoolItem[] = [];
          snap.forEach((d) =>
            list.push({ id: d.id, ...(d.data() as Omit<SchoolItem, 'id'>) })
          );
          setAllItems(list.sort((a, b) => a.order - b.order));
        }
      },
      () => {}
    );

    const unsubAnns = onSnapshot(
      collection(db, 'announcements'),
      (snap) => {
        if (!snap.empty) {
          const list: Announcement[] = [];
          snap.forEach((d) =>
            list.push({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) })
          );
          setAllAnnouncements(list);
        }
      },
      () => {}
    );

    const unsubApplicants = onSnapshot(
      collection(db, 'applicants'),
      (snap) => {
        const list: Applicant[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...(d.data() as Omit<Applicant, 'id'>) })
        );
        setApplicants(list);
        setLoadingData(false);
      },
      () => {
        setLoadingData(false);
      }
    );

    const unsubDocs = onSnapshot(
      collection(db, 'applicant_documents'),
      (snap) => {
        const list: ApplicantDocument[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...(d.data() as Omit<ApplicantDocument, 'id'>) })
        );
        setDocuments(list);
      },
      () => {}
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list: AuditLog[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) })
        );
        setAuditLogs(list);
      },
      () => {}
    );

    return () => {
      unsubAdmins();
      unsubYears();
      unsubItems();
      unsubAnns();
      unsubApplicants();
      unsubDocs();
      unsubLogs();
    };
  }, [currentUser]);

  const recordAudit = async (action: string, targetId: string, details: string) => {
    if (!currentUser || !currentUserRole) return;
    const logId = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    try {
      await setDoc(doc(db, 'audit_logs', logId), {
        actorUid: currentUser.uid,
        actorEmail: (currentUser.email || '-').slice(0, 150),
        actorRole: currentUserRole,
        action: action.slice(0, 150),
        targetId: targetId.slice(0, 128),
        details: details.slice(0, 1000),
        academicYear: selectedYearFilter.slice(0, 20),
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking audit log write
    }
  };

  // Seed / Sync initial configuration into Firestore if needed
  const handleInitializeDatabaseDefaults = async () => {
    if (!canManageConfig) return;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'school_config', 'main'), {
        ...DEFAULT_SCHOOL_CONFIG,
        updatedAt: serverTimestamp(),
      });
      for (const yr of DEFAULT_ACADEMIC_YEARS) {
        batch.set(doc(db, 'academic_years', yr.id), {
          yearLabel: yr.yearLabel,
          isActive: yr.isActive,
          isPublicDisplay: yr.isPublicDisplay,
          registrationStatus: yr.registrationStatus,
          openDate: yr.openDate,
          closeDate: yr.closeDate,
          announcementDate: yr.announcementDate,
          quota: yr.quota,
          notes: yr.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const item of DEFAULT_SCHOOL_ITEMS) {
        batch.set(doc(db, 'school_items', item.id), {
          category: item.category,
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl,
          order: item.order,
          isActive: item.isActive,
          isRequired: item.isRequired,
          fieldType: item.fieldType,
          maxSizeKb: item.maxSizeKb,
          academicYear: item.academicYear,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const ann of DEFAULT_ANNOUNCEMENTS) {
        batch.set(doc(db, 'announcements', ann.id), {
          title: ann.title,
          content: ann.content,
          imageUrl: ann.imageUrl,
          publishDate: ann.publishDate,
          isPublished: ann.isPublished,
          academicYear: ann.academicYear,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await recordAudit(
        'Reset / Sinkronisasi Konfigurasi Default Sekolah',
        'school_config/main',
        'Menyimpan identitas awal SMA Ma\'arif 05 Padang Ratu dan Tahun Ajaran 2027/2028 ke Cloud Firestore.'
      );
      showToast('success', 'Konfigurasi awal database Cloud Firestore berhasil disinkronkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school_config/main');
    }
  };

  // Filtered applicants strictly by selected Academic Year
  const yearApplicants = useMemo(
    () => applicants.filter((a) => a.academicYear === selectedYearFilter),
    [applicants, selectedYearFilter]
  );

  const filteredApplicants = useMemo(() => {
    return yearApplicants.filter((a) => {
      const matchesSearch =
        !searchTerm.trim() ||
        a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.regNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.nisn.includes(searchTerm) ||
        a.previousSchool.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const matchesGender = genderFilter === 'ALL' || a.gender === genderFilter;
      return matchesSearch && matchesStatus && matchesGender;
    });
  }, [yearApplicants, searchTerm, statusFilter, genderFilter]);

  const paginatedApplicants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredApplicants.slice(start, start + pageSize);
  }, [filteredApplicants, currentPage]);

  const selectedApplicant = useMemo(
    () => applicants.find((a) => a.id === selectedApplicantId) || null,
    [applicants, selectedApplicantId]
  );

  const selectedApplicantDocs = useMemo(
    () =>
      selectedApplicant
        ? documents.filter(
            (d) =>
              d.applicantId === selectedApplicant.id &&
              d.regNumber === selectedApplicant.regNumber
          )
        : [],
    [documents, selectedApplicant]
  );

  // Statistics for Selected Academic Year
  const stats = useMemo(() => {
    const total = yearApplicants.length;
    const male = yearApplicants.filter((a) => a.gender === 'Laki-laki').length;
    const female = yearApplicants.filter((a) => a.gender === 'Perempuan').length;
    const verified = yearApplicants.filter((a) => a.status === 'Terverifikasi').length;
    const accepted = yearApplicants.filter((a) => a.status === 'Diterima').length;
    const needRepair = yearApplicants.filter((a) => a.status === 'Perlu perbaikan data').length;
    const waiting = yearApplicants.filter((a) => a.status === 'Menunggu verifikasi').length;
    const incompleteDocs = yearApplicants.filter(
      (a) => a.docCompleteCount < a.docTotalRequired
    ).length;

    const schoolMap: Record<string, number> = {};
    yearApplicants.forEach((a) => {
      const k = a.previousSchool || 'Lainnya';
      schoolMap[k] = (schoolMap[k] || 0) + 1;
    });

    return {
      total,
      male,
      female,
      verified,
      accepted,
      needRepair,
      waiting,
      incompleteDocs,
      schoolBreakdown: Object.entries(schoolMap).sort((a, b) => b[1] - a[1]),
    };
  }, [yearApplicants]);

  // Save Full Edited Applicant (Admin can edit ALL fields of an applicant)
  const handleSaveEditedApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canVerifyApplicants || !editingApplicant) return;
    try {
      const batch = writeBatch(db);
      const appRef = doc(db, 'applicants', editingApplicant.id);
      const cleanDate = editingApplicant.birthDate.trim().replace(/[^0-9\-]/g, '');
      const lookupRef = doc(
        db,
        'applicant_status_lookup',
        `${editingApplicant.regNumber}_${cleanDate}`
      );

      const { id: _unusedId, ...cleanApp } = editingApplicant;
      const payload = {
        ...cleanApp,
        fullName: cleanApp.fullName.trim().slice(0, 150),
        nik: cleanApp.nik.trim().slice(0, 20),
        nisn: cleanApp.nisn.trim().slice(0, 20),
        birthPlace: cleanApp.birthPlace.trim().slice(0, 100),
        birthDate: cleanDate.slice(0, 20),
        address: cleanApp.address.trim().slice(0, 500),
        village: cleanApp.village.trim().slice(0, 100),
        district: cleanApp.district.trim().slice(0, 100),
        regency: cleanApp.regency.trim().slice(0, 100),
        province: cleanApp.province.trim().slice(0, 100),
        postalCode: cleanApp.postalCode.trim().slice(0, 20),
        phone: cleanApp.phone.trim().slice(0, 30),
        email: cleanApp.email.trim().slice(0, 150),
        fatherName: cleanApp.fatherName.trim().slice(0, 150),
        fatherJob: cleanApp.fatherJob.trim().slice(0, 100),
        fatherPhone: cleanApp.fatherPhone.trim().slice(0, 30),
        motherName: cleanApp.motherName.trim().slice(0, 150),
        motherJob: cleanApp.motherJob.trim().slice(0, 100),
        motherPhone: cleanApp.motherPhone.trim().slice(0, 30),
        guardianName: cleanApp.guardianName.trim().slice(0, 150),
        guardianJob: cleanApp.guardianJob.trim().slice(0, 100),
        parentAddress: cleanApp.parentAddress.trim().slice(0, 500),
        previousSchool: cleanApp.previousSchool.trim().slice(0, 150),
        previousSchoolNpsn: cleanApp.previousSchoolNpsn.trim().slice(0, 30),
        previousSchoolAddress: cleanApp.previousSchoolAddress.trim().slice(0, 500),
        graduationYear: cleanApp.graduationYear.trim().slice(0, 10),
        certificateNumber: cleanApp.certificateNumber.trim().slice(0, 100),
        customDataSummary: cleanApp.customDataSummary.trim().slice(0, 2000),
        verificationNotes: cleanApp.verificationNotes.trim().slice(0, 1000),
        createdAt: cleanApp.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(appRef, payload);
      batch.set(lookupRef, {
        applicantId: editingApplicant.id,
        regNumber: editingApplicant.regNumber,
        academicYear: editingApplicant.academicYear,
        fullName: payload.fullName,
        nisn: payload.nisn,
        birthDate: payload.birthDate,
        previousSchool: payload.previousSchool,
        status: payload.status,
        verificationNotes: payload.verificationNotes,
        docCompleteCount: payload.docCompleteCount,
        docTotalRequired: payload.docTotalRequired,
        createdAt: cleanApp.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      await recordAudit(
        'Edit Biodata Lengkap Pendaftar',
        editingApplicant.regNumber,
        `Memperbarui biodata lengkap ${payload.fullName} (${editingApplicant.regNumber}).`
      );
      setEditingApplicant(null);
      showToast('success', `Biodata lengkap ${payload.fullName} berhasil diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `applicants/${editingApplicant.id}`);
    }
  };

  // Update Applicant Status & Sync with Status Lookup
  const handleUpdateApplicantStatus = async (
    applicant: Applicant,
    newStatus: ApplicantStatus,
    newNotes: string
  ) => {
    if (!canVerifyApplicants) return;
    try {
      const batch = writeBatch(db);
      const appRef = doc(db, 'applicants', applicant.id);
      const cleanDate = applicant.birthDate.trim().replace(/[^0-9\-]/g, '');
      const lookupRef = doc(
        db,
        'applicant_status_lookup',
        `${applicant.regNumber}_${cleanDate}`
      );

      const updatedPayload = {
        ...applicant,
        status: newStatus,
        verificationNotes: newNotes.slice(0, 1000),
        updatedAt: serverTimestamp(),
      };
      const { id: _unusedId, ...firestoreApplicantData } = updatedPayload;
      batch.set(appRef, firestoreApplicantData);

      batch.set(lookupRef, {
        applicantId: applicant.id,
        regNumber: applicant.regNumber,
        academicYear: applicant.academicYear,
        fullName: applicant.fullName,
        nisn: applicant.nisn,
        birthDate: cleanDate,
        previousSchool: applicant.previousSchool,
        status: newStatus,
        verificationNotes: newNotes.slice(0, 1000),
        docCompleteCount: applicant.docCompleteCount,
        docTotalRequired: applicant.docTotalRequired,
        createdAt: applicant.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      await recordAudit(
        `Ubah Status Pendaftar -> ${newStatus}`,
        applicant.regNumber,
        `Status ${applicant.fullName} (${applicant.regNumber}) diubah menjadi ${newStatus}. Catatan: ${newNotes}`
      );
      showToast(
        'success',
        `Status pendaftar ${applicant.fullName} berhasil diperbarui menjadi "${newStatus}".`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `applicants/${applicant.id}`);
    }
  };

  // Admin Upload / Replace Document for Applicant
  const handleAdminUploadApplicantDoc = async (applicant: Applicant, file: File | null) => {
    if (!file || !canVerifyApplicants) return;
    const docReqs = allItems.filter((i) => i.category === 'doc_requirement');
    const req = docReqs.find((r) => r.id === adminDocReqId) || docReqs[0];
    if (!req) return;

    setUploadingAdminDoc(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      if (dataUrl.length > 740000) {
        showToast('error', 'Ukuran file melebihi batas 500 KB.');
        setUploadingAdminDoc(false);
        return;
      }
      const safeDocId = `${applicant.id}_${req.id.replace(/[^a-zA-Z0-9_\-]/g, '')}`;
      const storagePath = `pendaftar/${applicant.regNumber}/${file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;

      await setDoc(doc(db, 'applicant_documents', safeDocId), {
        applicantId: applicant.id,
        regNumber: applicant.regNumber,
        academicYear: applicant.academicYear,
        docType: req.id,
        docLabel: req.title,
        fileName: file.name.slice(0, 200),
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
        storagePath: storagePath.slice(0, 500),
        fileDataUrl: dataUrl,
        verificationStatus: 'Valid',
        adminNote: 'Diunggah/diperbarui langsung oleh Admin SPMB',
        uploadedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Recalculate required document completeness count
      const activeRequiredReqs = docReqs.filter((r) => r.isActive && r.isRequired);
      const currentAppDocs = documents.filter((d) => d.applicantId === applicant.id);
      const updatedDocTypes = new Set([
        ...currentAppDocs.map((d) => d.docType),
        req.id,
      ]);
      const newCompleteCount = activeRequiredReqs.filter((r) =>
        updatedDocTypes.has(r.id)
      ).length;
      const newTotalRequired = activeRequiredReqs.length || 3;

      const { id: _unusedId, ...cleanApplicant } = applicant;
      await setDoc(doc(db, 'applicants', applicant.id), {
        ...cleanApplicant,
        docCompleteCount: newCompleteCount,
        docTotalRequired: newTotalRequired,
        updatedAt: serverTimestamp(),
      });

      await recordAudit(
        `Unggah/Ganti Dokumen oleh Admin (${req.title})`,
        applicant.regNumber,
        `Admin mengunggah dokumen ${req.title} untuk ${applicant.fullName}.`
      );
      showToast('success', `Dokumen "${req.title}" berhasil diunggah untuk ${applicant.fullName}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setUploadingAdminDoc(false);
    }
  };

  // Verify Single Document
  const handleVerifyDocument = async (
    docItem: ApplicantDocument,
    status: 'Menunggu' | 'Valid' | 'Perlu Perbaikan',
    note: string
  ) => {
    if (!canVerifyApplicants) return;
    try {
      const { id: docId, ...rest } = docItem;
      await setDoc(doc(db, 'applicant_documents', docId), {
        ...rest,
        verificationStatus: status,
        adminNote: (note || '-').slice(0, 500),
        updatedAt: serverTimestamp(),
      });
      await recordAudit(
        `Verifikasi Dokumen (${docItem.docLabel}) -> ${status}`,
        docItem.regNumber,
        `Dokumen ${docItem.docLabel} milik ${docItem.regNumber}: ${status} (${note})`
      );
      showToast('success', `Status dokumen "${docItem.docLabel}" disimpan (${status}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `applicant_documents/${docItem.id}`);
    }
  };

  // Trigger Section 12.A or 12.B ZIP Download
  const handleRunZipDownload = async (
    applicant: Applicant,
    mode: 'docs_only' | 'biodata_and_docs'
  ) => {
    if (!canVerifyApplicants && currentUserRole !== 'Kepala Sekolah') {
      showToast('error', 'Anda tidak memiliki izin untuk mengunduh arsip dokumen.');
      return;
    }
    setLastZipMode(mode);
    try {
      if (mode === 'docs_only') {
        await downloadAllDocumentsZip(applicant, documents, allItems, (st) =>
          setZipProgress({ ...st })
        );
        await recordAudit(
          'Unduh Semua Dokumen (ZIP)',
          applicant.regNumber,
          `Mengunduh arsip ZIP dokumen untuk ${applicant.fullName} (${applicant.regNumber}).`
        );
      } else {
        await downloadBiodataAndDocumentsZip(
          applicant,
          documents,
          allItems,
          config,
          (st) => setZipProgress({ ...st })
        );
        await recordAudit(
          'Unduh Biodata + Semua Dokumen (ZIP)',
          applicant.regNumber,
          `Mengunduh arsip ZIP Biodata A4 + Laporan Kelengkapan + Dokumen untuk ${applicant.fullName}.`
        );
      }
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal membuat arsip ZIP.'
      );
    }
  };

  // Activate Academic Year
  const handleConfirmActivateAcademicYear = async (targetYear: AcademicYear) => {
    if (!canManageConfig) return;
    try {
      const batch = writeBatch(db);
      for (const yr of allAcademicYears) {
        const isTarget = yr.id === targetYear.id;
        batch.set(doc(db, 'academic_years', yr.id), {
          yearLabel: yr.yearLabel,
          isActive: isTarget,
          isPublicDisplay: isTarget ? true : yr.isPublicDisplay,
          registrationStatus: yr.registrationStatus,
          openDate: yr.openDate,
          closeDate: yr.closeDate,
          announcementDate: yr.announcementDate,
          quota: yr.quota,
          notes: yr.notes,
          createdAt: yr.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const { updatedAt: _u, ...cleanConfig } = config;
      batch.set(doc(db, 'school_config', 'main'), {
        ...cleanConfig,
        activeYearLabel: targetYear.yearLabel,
        openDate: targetYear.openDate,
        closeDate: targetYear.closeDate,
        announcementDate: targetYear.announcementDate,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setSelectedYearFilter(targetYear.yearLabel);
      setConfirmYearSwitch(null);
      await recordAudit(
        'Ubah Tahun Ajaran Aktif',
        targetYear.yearLabel,
        `Mengaktifkan Tahun Ajaran ${targetYear.yearLabel}. Data pendaftar tahun ajaran lama tetap tersimpan sebagai arsip.`
      );
      showToast(
        'success',
        `Tahun Ajaran Aktif berhasil diubah menjadi ${targetYear.yearLabel}. Seluruh data lama tetap aman di arsip.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school_config/main');
    }
  };

  // Save Edited Academic Year
  const handleSaveEditedYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageConfig || !editingYear) return;
    try {
      const { id: yearId, ...rest } = editingYear;
      await setDoc(doc(db, 'academic_years', yearId), {
        ...rest,
        quota: Number(rest.quota) || 180,
        createdAt: rest.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If this is the currently active academic year, also sync dates to school_config/main
      if (config.activeYearLabel === rest.yearLabel) {
        const { updatedAt: _u, ...cleanConfig } = config;
        await setDoc(doc(db, 'school_config', 'main'), {
          ...cleanConfig,
          openDate: rest.openDate,
          closeDate: rest.closeDate,
          announcementDate: rest.announcementDate,
          updatedAt: serverTimestamp(),
        });
      }

      await recordAudit(
        'Edit Tahun Ajaran & Jadwal Periode',
        yearId,
        `Memperbarui konfigurasi Tahun Ajaran ${rest.yearLabel}.`
      );
      setEditingYear(null);
      showToast('success', `Tahun Ajaran ${rest.yearLabel} berhasil diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `academic_years/${editingYear.id}`);
    }
  };

  // Save School Config
  const handleSaveSchoolConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canManageConfig) return;
    try {
      const { updatedAt: _u, ...clean } = editConfig;
      await setDoc(doc(db, 'school_config', 'main'), {
        ...clean,
        updatedAt: serverTimestamp(),
      });
      await recordAudit(
        'Simpan Pengaturan Sekolah & Periode SPMB',
        'school_config/main',
        `Memperbarui konfigurasi sekolah (${editConfig.officialName}), Tahun Ajaran: ${editConfig.activeYearLabel}, Status Buka: ${editConfig.isRegistrationOpen}`
      );
      showToast('success', 'Seluruh pengaturan sekolah, logo, banner, dan jadwal berhasil disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school_config/main');
    }
  };

  // Add New Academic Year
  const handleAddAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageConfig) return;
    const cleanLabel = newYearLabel.trim();
    if (!/^\d{4}\/\d{4}$/.test(cleanLabel)) {
      showToast('error', 'Format Tahun Ajaran harus YYYY/YYYY, contoh: 2028/2029.');
      return;
    }
    const yearId = cleanLabel.replace('/', '-');
    try {
      await setDoc(doc(db, 'academic_years', yearId), {
        yearLabel: cleanLabel,
        isActive: false,
        isPublicDisplay: true,
        registrationStatus: 'scheduled',
        openDate: newYearOpenDate,
        closeDate: newYearCloseDate,
        announcementDate: newYearAnnounceDate,
        quota: Number(newYearQuota) || 180,
        notes: `Periode SPMB Tahun Ajaran ${cleanLabel}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordAudit(
        'Tambah Tahun Ajaran Baru',
        yearId,
        `Menambahkan Tahun Ajaran ${cleanLabel} ke dalam database.`
      );
      showToast('success', `Tahun Ajaran ${cleanLabel} berhasil ditambahkan.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `academic_years/${yearId}`);
    }
  };

  // Add New School Item
  const handleAddSchoolItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageConfig || !newItemTitle.trim()) return;
    const itemId = `item_${Date.now()}`;
    try {
      await setDoc(doc(db, 'school_items', itemId), {
        category: newItemCategory,
        title: newItemTitle.trim().slice(0, 200),
        description: (newItemDesc.trim() || '-').slice(0, 2000),
        imageUrl: newItemImageUrl.trim().slice(0, 600000),
        order: allItems.filter((i) => i.category === newItemCategory).length + 1,
        isActive: true,
        isRequired: newItemRequired,
        fieldType: (newItemFieldType.trim() || 'text').slice(0, 100),
        maxSizeKb: Number(newItemMaxSizeKb) || 500,
        academicYear: newItemAcademicYear || 'ALL',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewItemTitle('');
      setNewItemDesc('');
      setNewItemImageUrl('');
      await recordAudit(
        `Tambah Item (${newItemCategory})`,
        itemId,
        `Menambahkan item "${newItemTitle}" pada kategori ${newItemCategory}.`
      );
      showToast('success', `Data "${newItemTitle}" berhasil ditambahkan.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `school_items/${itemId}`);
    }
  };

  // Save Edited School Item
  const handleSaveEditedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageConfig || !editingItem) return;
    try {
      const { id: itemId, ...rest } = editingItem;
      await setDoc(doc(db, 'school_items', itemId), {
        ...rest,
        title: rest.title.trim().slice(0, 200),
        description: (rest.description.trim() || '-').slice(0, 2000),
        imageUrl: (rest.imageUrl || '').slice(0, 600000),
        order: Number(rest.order) || 1,
        maxSizeKb: Number(rest.maxSizeKb) || 500,
        createdAt: rest.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordAudit(
        `Edit Item (${rest.category})`,
        itemId,
        `Memperbarui item "${rest.title}" (${rest.category}).`
      );
      setEditingItem(null);
      showToast('success', `Item "${rest.title}" berhasil diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `school_items/${editingItem.id}`);
    }
  };

  // Change Item Order (Move Up / Down)
  const handleMoveItemOrder = async (item: SchoolItem, direction: 'up' | 'down') => {
    if (!canManageConfig) return;
    const newOrder = direction === 'up' ? Math.max(1, item.order - 1) : item.order + 1;
    try {
      const { id: itemId, ...rest } = item;
      await setDoc(doc(db, 'school_items', itemId), {
        ...rest,
        order: newOrder,
        createdAt: rest.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `school_items/${item.id}`);
    }
  };

  // Add Announcement
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageConfig || !newAnnTitle.trim()) return;
    const annId = `ann_${Date.now()}`;
    try {
      await setDoc(doc(db, 'announcements', annId), {
        title: newAnnTitle.trim().slice(0, 200),
        content: newAnnContent.trim().slice(0, 5000),
        imageUrl: newAnnImageUrl.slice(0, 600000),
        publishDate: newAnnDate,
        isPublished: true,
        academicYear: selectedYearFilter,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewAnnTitle('');
      setNewAnnContent('');
      setNewAnnImageUrl('');
      await recordAudit(
        'Tambah Pengumuman',
        annId,
        `Membuat pengumuman "${newAnnTitle}" untuk Tahun Ajaran ${selectedYearFilter}.`
      );
      showToast('success', 'Pengumuman berhasil diterbitkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `announcements/${annId}`);
    }
  };

  // Save Edited Announcement
  const handleSaveEditedAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageConfig || !editingAnnouncement) return;
    try {
      const { id: annId, ...rest } = editingAnnouncement;
      await setDoc(doc(db, 'announcements', annId), {
        ...rest,
        title: rest.title.trim().slice(0, 200),
        content: rest.content.trim().slice(0, 5000),
        imageUrl: (rest.imageUrl || '').slice(0, 600000),
        createdAt: rest.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordAudit(
        'Edit Pengumuman',
        annId,
        `Memperbarui pengumuman "${rest.title}".`
      );
      setEditingAnnouncement(null);
      showToast('success', `Pengumuman "${rest.title}" berhasil diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `announcements/${editingAnnouncement.id}`);
    }
  };

  // Add or Save Admin / Committee User
  const handleAddAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !newAdminUid.trim() || !newAdminEmail.trim()) return;
    const cleanUid = newAdminUid.trim();
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        email: newAdminEmail.trim().slice(0, 150),
        fullName: (newAdminName.trim() || newAdminEmail.trim()).slice(0, 150),
        role: newAdminRole,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      await recordAudit(
        'Tambah Akun Pengelola SPMB',
        cleanUid,
        `Menambahkan ${newAdminEmail} sebagai ${newAdminRole}.`
      );
      showToast('success', `Akun ${newAdminEmail} (${newAdminRole}) berhasil disimpan.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `admins/${cleanUid}`);
    }
  };

  const handleSaveEditedAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || !editingAdminUser) return;
    try {
      await setDoc(doc(db, 'admins', editingAdminUser.uid), {
        ...editingAdminUser,
        createdAt: editingAdminUser.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordAudit(
        'Edit Hak Akses Akun',
        editingAdminUser.uid,
        `Memperbarui akun ${editingAdminUser.email} menjadi peran ${editingAdminUser.role} (Aktif: ${editingAdminUser.isActive}).`
      );
      setEditingAdminUser(null);
      showToast('success', `Akun ${editingAdminUser.email} berhasil diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `admins/${editingAdminUser.uid}`);
    }
  };

  // Backup Configuration & Applicant Metadata
  const handleDownloadBackupJson = () => {
    const backupObject = {
      exportedAt: new Date().toISOString(),
      schoolConfig: config,
      academicYears: allAcademicYears,
      schoolItems: allItems,
      announcements: allAnnouncements,
      applicantsMetadata: applicants,
      note: 'Dokumen pribadi calon murid tidak disertakan dalam file cadangan JSON ini demi keamanan privasi.',
    };
    const blob = new Blob([JSON.stringify(backupObject, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cadangan_Database_SPMB_SMA_Maarif_05_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    recordAudit(
      'Unduh Cadangan Database (JSON)',
      'backup',
      'Mengekspor cadangan konfigurasi sekolah dan data pendaftar.'
    );
  };

  // Unauthenticated Admin Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-maarif-canvas flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-emerald-200 rounded-2xl p-8 space-y-6 shadow-xs">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-900 text-amber-300 flex items-center justify-center mx-auto border border-amber-400">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-xs font-mono font-bold text-amber-700">
              PORTAL ADMINISTRASI RESMI
            </p>
            <h1 className="text-2xl font-bold text-emerald-950">
              Login Dashboard Admin & Panitia SPMB
            </h1>
            <p className="text-xs text-slate-600">
              {config.officialName} · Tahun Ajaran Aktif {config.activeYearLabel}
            </p>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5">
            <p className="font-bold">Kendali Penuh & Otorisasi Berbasis Peran (RBAC):</p>
            <p>
              Melalui dashboard ini, Admin dapat mengedit seluruh informasi sekolah, tahun ajaran,
              periode pendaftaran, biodata pendaftar, persyaratan dokumen, galeri, dan pengumuman.
            </p>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await signInWithPopup(auth, googleProvider);
              } catch (err) {
                showToast(
                  'error',
                  err instanceof Error ? err.message : 'Gagal masuk dengan Google.'
                );
              }
            }}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-900 hover:to-teal-900 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4 text-amber-300" />
            Masuk Menggunakan Akun Google Resmi
          </button>

          <button
            type="button"
            onClick={onBackToPublic}
            className="w-full py-2.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Beranda Publik SPMB
          </button>
        </div>
      </div>
    );
  }

  // Logged in, but not an authorized Admin/Committee user
  if (!currentUserRole) {
    return (
      <div className="min-h-screen bg-maarif-canvas flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border-2 border-amber-300 rounded-2xl p-8 space-y-5 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto" />
          <h2 className="text-xl font-bold text-emerald-950">
            Akun Belum Memiliki Hak Akses Dashboard Admin
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Anda masuk sebagai <span className="font-bold text-slate-900">{currentUser.email}</span>{' '}
            (UID: <span className="font-mono text-slate-900">{currentUser.uid}</span>). Hubungi Super
            Admin sekolah untuk mendaftarkan UID Anda pada menu Pengaturan Akun & Hak Akses.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
            >
              Keluar Akun
            </button>
            <button
              type="button"
              onClick={onBackToPublic}
              className="px-4 py-2 bg-emerald-800 text-white text-xs font-bold rounded-xl"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayedItems = allItems
    .filter((i) => itemCategoryFilter === 'ALL' || i.category === itemCategoryFilter)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen flex bg-maarif-canvas text-slate-900">
      {/* Sidebar Navigation (265px) with Deep Royal Emerald & Gold */}
      <aside className="w-68 bg-gradient-to-b from-emerald-950 via-emerald-900 to-teal-950 text-emerald-100 flex flex-col shrink-0 border-r border-emerald-800">
        <div className="p-5 border-b border-emerald-800/80 flex items-center gap-3">
          <img
            src={config.logoUrl || ASSETS.schoolLogo}
            alt="Logo"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-lg bg-white p-0.5 object-contain border border-amber-400 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-mono font-bold text-amber-400">KENDALI PENUH ADMIN</p>
            <h1 className="text-sm font-bold text-white truncate">{config.officialName}</h1>
            <p className="text-[11px] text-emerald-300 truncate">
              Peran: <span className="font-bold text-amber-300">{currentUserRole}</span>
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto text-xs font-medium">
          {[
            { id: 'overview', label: '01. Dashboard & Statistik', icon: LayoutDashboard },
            { id: 'applicants', label: '02. Data & Edit Pendaftar', icon: Users },
            { id: 'verification', label: '03. Verifikasi & Unduh ZIP', icon: FileCheck },
            { id: 'reports', label: '04. Cetak & Ekspor Laporan', icon: FileSpreadsheet },
            { id: 'academic_years', label: '05. Edit Tahun Ajaran & Jadwal', icon: Calendar },
            { id: 'school_settings', label: '06. Edit Identitas & Logo Sekolah', icon: Building2 },
            { id: 'form_docs', label: '07. Edit Konten, Form & Berkas', icon: BookOpen },
            { id: 'announcements_gallery', label: '08. Edit Pengumuman & Galeri', icon: Bell },
            { id: 'accounts_security', label: '09. Edit Akun & Hak Akses', icon: Shield },
            { id: 'audit_backup_guide', label: '10. Audit, Cadangan & Hosting', icon: Database },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left whitespace-nowrap ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-emerald-100/80 hover:bg-emerald-800/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-800/80 space-y-2">
          <button
            type="button"
            onClick={onBackToPublic}
            className="w-full px-3 py-2 text-xs font-semibold text-emerald-100 hover:text-white bg-emerald-800/70 hover:bg-emerald-800 rounded-xl flex items-center justify-center gap-2"
          >
            <Eye className="w-3.5 h-3.5 text-amber-300" />
            Lihat Halaman Publik
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full px-3 py-2 text-xs font-semibold text-red-200 hover:text-white hover:bg-red-900/50 rounded-xl flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar ({currentUser.email?.split('@')[0]})
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white/95 backdrop-blur border-b border-emerald-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-emerald-950">
              Tahun Ajaran Aktif Publik:{' '}
              <span className="font-mono text-amber-700">{config.activeYearLabel}</span>
            </span>
            <span className="text-emerald-300">·</span>
            <span className="text-xs text-slate-600">
              Status Pendaftaran:{' '}
              <strong className={config.isRegistrationOpen ? 'text-emerald-700' : 'text-red-600'}>
                {config.isRegistrationOpen ? 'DIBUKA' : 'DITUTUP'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-emerald-950">
              Filter Data Tahun Ajaran:
            </label>
            <select
              value={selectedYearFilter}
              onChange={(e) => {
                setSelectedYearFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-xs font-mono font-bold bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-lg"
            >
              {Array.from(
                new Set([
                  config.activeYearLabel,
                  ...allAcademicYears.map((y) => y.yearLabel),
                  ...applicants.map((a) => a.academicYear),
                  '2027/2028',
                  '2028/2029',
                  '2026/2027',
                ])
              ).map((yr) => (
                <option key={yr} value={yr}>
                  Tahun Ajaran {yr} {yr === config.activeYearLabel ? '(Aktif)' : '(Arsip/Periode Lain)'}
                </option>
              ))}
            </select>

            {canManageConfig && (
              <button
                type="button"
                onClick={handleInitializeDatabaseDefaults}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="Sinkronkan konfigurasi awal ke Firestore"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                Sinkronkan Data Awal
              </button>
            )}
          </div>
        </header>

        {toast && (
          <div
            className={`mx-6 mt-4 p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="underline ml-4">
              Tutup
            </button>
          </div>
        )}

        <main className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* TAB 1: OVERVIEW & QUICK EDIT SHORTCUTS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-emerald-950">
                    Pusat Kendali Admin & Statistik Pendaftar ({selectedYearFilter})
                  </h2>
                  <p className="text-xs text-slate-600">
                    Kelola dan edit seluruh aspek aplikasi SPMB secara real-time tanpa mengubah kode program.
                  </p>
                </div>

                {canManageConfig && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const nextOpen = !config.isRegistrationOpen;
                        const { updatedAt: _u, ...clean } = config;
                        await setDoc(doc(db, 'school_config', 'main'), {
                          ...clean,
                          isRegistrationOpen: nextOpen,
                          updatedAt: serverTimestamp(),
                        });
                        await recordAudit(
                          nextOpen ? 'Buka Pendaftaran Manual' : 'Tutup Pendaftaran Manual',
                          'school_config/main',
                          `Mengubah status pendaftaran menjadi ${nextOpen ? 'DIBUKA' : 'DITUTUP'}`
                        );
                        showToast(
                          'success',
                          `Pendaftaran berhasil ${nextOpen ? 'DIBUKA' : 'DITUTUP'}.`
                        );
                      }}
                      className={`px-4 py-2.5 text-xs font-bold rounded-xl text-white transition-colors ${
                        config.isRegistrationOpen
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-emerald-700 hover:bg-emerald-800'
                      }`}
                    >
                      {config.isRegistrationOpen
                        ? 'Tutup Pendaftaran Sekarang'
                        : 'Buka Pendaftaran Sekarang'}
                    </button>
                  </div>
                )}
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 border border-emerald-200 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-emerald-800">Total Pendaftar ({selectedYearFilter})</p>
                  <p className="text-3xl font-mono font-bold text-emerald-950 tabular-nums mt-1">
                    {stats.total}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    Laki-laki: {stats.male} · Perempuan: {stats.female}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50/40 border border-amber-300 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-amber-800">Menunggu Verifikasi & Perbaikan</p>
                  <p className="text-3xl font-mono font-bold text-amber-700 tabular-nums mt-1">
                    {stats.waiting + stats.needRepair}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    Menunggu: {stats.waiting} · Perlu Perbaikan: {stats.needRepair}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-100/70 via-white to-teal-50/50 border border-emerald-300 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-emerald-900">Terverifikasi & Diterima</p>
                  <p className="text-3xl font-mono font-bold text-emerald-800 tabular-nums mt-1">
                    {stats.verified + stats.accepted}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    Terverifikasi: {stats.verified} · Diterima: {stats.accepted}
                  </p>
                </div>

                <div className="bg-white border border-emerald-200 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-slate-600">Dokumen Belum Lengkap</p>
                  <p className="text-3xl font-mono font-bold text-slate-900 tabular-nums mt-1">
                    {stats.incompleteDocs}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Pendaftar dengan berkas wajib kurang
                  </p>
                </div>
              </div>

              {/* Breakdown & Full Edit Center Shortcuts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-emerald-950">
                    Rekapitulasi Asal Sekolah SMP / MTs ({selectedYearFilter})
                  </h3>
                  {stats.schoolBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">
                      Belum ada data pendaftar pada Tahun Ajaran {selectedYearFilter}.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {stats.schoolBreakdown.map(([sch, cnt], idx) => (
                        <div key={sch} className="py-2.5 flex justify-between items-center">
                          <span className="font-medium text-slate-800">
                            {idx + 1}. {sch}
                          </span>
                          <span className="font-mono font-bold text-emerald-800 tabular-nums">
                            {cnt} murid
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-emerald-950">
                    Pintasan Edit Semua Modul Aplikasi
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('school_settings')}
                      className="p-3.5 border border-emerald-200 rounded-xl hover:border-amber-400 hover:bg-emerald-50/40 text-left transition-colors"
                    >
                      <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        Edit Identitas, Logo & Banner
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ubah nama sekolah, NPSN, sejarah, visi-misi, foto
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('academic_years')}
                      className="p-3.5 border border-emerald-200 rounded-xl hover:border-amber-400 hover:bg-emerald-50/40 text-left transition-colors"
                    >
                      <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        Edit Tahun Ajaran & Jadwal
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Saat ini aktif: {config.activeYearLabel}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('form_docs')}
                      className="p-3.5 border border-emerald-200 rounded-xl hover:border-amber-400 hover:bg-emerald-50/40 text-left transition-colors"
                    >
                      <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                        Edit Program, Fasilitas & Berkas
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Edit semua item profil, kolom form & syarat dokumen
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('applicants')}
                      className="p-3.5 border border-emerald-200 rounded-xl hover:border-amber-400 hover:bg-emerald-50/40 text-left transition-colors"
                    >
                      <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-600" />
                        Edit Biodata & Berkas Pendaftar
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Edit data murid, verifikasi & unduh ZIP
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: APPLICANTS TABLE, FULL EDIT BIODATA, VERIFICATION + ZIP DOWNLOAD */}
          {(activeTab === 'applicants' || activeTab === 'verification') && (
            <div className="space-y-6">
              {/* Filter & Search Bar */}
              <div className="bg-white border border-emerald-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-emerald-950">
                      Data Pendaftar, Edit Biodata & Verifikasi — Tahun Ajaran {selectedYearFilter}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Menampilkan {filteredApplicants.length} calon murid untuk periode{' '}
                      {selectedYearFilter}. Admin dapat mengedit seluruh biodata pendaftar,
                      mengunggah/mengganti berkas, dan mengunduh arsip ZIP.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canVerifyApplicants && (
                      <button
                        type="button"
                        onClick={() => {
                          const yrPrefix =
                            selectedYearFilter.split('/')[0].replace(/[^0-9]/g, '') || '2027';
                          const newReg = `SPMB-${yrPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
                          setEditingApplicant({
                            id: newReg,
                            regNumber: newReg,
                            academicYear: selectedYearFilter,
                            fullName: 'Calon Murid Baru',
                            nik: '1802010000000001',
                            nisn: '0090000001',
                            gender: 'Laki-laki',
                            birthPlace: 'Padang Ratu',
                            birthDate: '2012-05-10',
                            religion: 'Islam',
                            address: 'Jl. Raya Padang Ratu',
                            village: 'Padang Ratu',
                            district: 'Padang Ratu',
                            regency: 'Kabupaten Lampung Tengah',
                            province: 'Lampung',
                            postalCode: '34176',
                            phone: '081200000000',
                            email: '-',
                            fatherName: 'Nama Ayah',
                            fatherJob: 'Wiraswasta',
                            fatherPhone: '081200000000',
                            motherName: 'Nama Ibu',
                            motherJob: 'Ibu Rumah Tangga',
                            motherPhone: '081200000000',
                            guardianName: '-',
                            guardianJob: '-',
                            parentAddress: 'Jl. Raya Padang Ratu',
                            previousSchool: 'SMP Negeri 1 Padang Ratu',
                            previousSchoolNpsn: '10801900',
                            previousSchoolAddress: 'Padang Ratu',
                            graduationYear: yrPrefix,
                            certificateNumber: '-',
                            customDataSummary: 'Program Peminatan: MIPA Sains',
                            status: 'Menunggu verifikasi',
                            verificationNotes: 'Diinput manual oleh Admin SPMB',
                            docCompleteCount: 0,
                            docTotalRequired:
                              allItems.filter(
                                (i) => i.category === 'doc_requirement' && i.isActive && i.isRequired
                              ).length || 3,
                          });
                        }}
                        className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Input Pendaftar Baru
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => exportApplicantsToExcel(filteredApplicants, selectedYearFilter)}
                      className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Ekspor Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => exportApplicantsToCsv(filteredApplicants, selectedYearFilter)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Ekspor CSV
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Cari Nama, No. Pendaftaran, NISN, SMP..."
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="ALL">Semua Status Pendaftaran</option>
                    <option value="Menunggu verifikasi">Menunggu verifikasi</option>
                    <option value="Perlu perbaikan data">Perlu perbaikan data</option>
                    <option value="Terverifikasi">Terverifikasi</option>
                    <option value="Diterima">Diterima</option>
                    <option value="Tidak diterima">Tidak diterima</option>
                  </select>

                  <select
                    value={genderFilter}
                    onChange={(e) => {
                      setGenderFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="ALL">Semua Jenis Kelamin</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
              </div>

              {/* Applicants Data Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-50/60 border-b border-slate-200 text-slate-800 font-bold">
                        <th className="py-3.5 px-4">No. Pendaftaran</th>
                        <th className="py-3.5 px-4">Thn Ajaran</th>
                        <th className="py-3.5 px-4">Nama Lengkap</th>
                        <th className="py-3.5 px-4">L/P</th>
                        <th className="py-3.5 px-4">NISN</th>
                        <th className="py-3.5 px-4">Asal SMP/MTs</th>
                        <th className="py-3.5 px-4">Berkas Wajib</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Aksi & Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingData ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            Memuat data pendaftar dari Cloud Firestore...
                          </td>
                        </tr>
                      ) : paginatedApplicants.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-500">
                            Belum ada data pendaftar pada Tahun Ajaran {selectedYearFilter} yang
                            sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedApplicants.map((app) => (
                          <tr
                            key={app.id}
                            className={`hover:bg-emerald-50/40 transition-colors ${
                              selectedApplicantId === app.id ? 'bg-amber-50/50' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-mono font-bold text-emerald-950 tabular-nums">
                              {app.regNumber}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                              {app.academicYear}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {app.fullName}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {app.gender === 'Laki-laki' ? 'L' : 'P'}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                              {app.nisn}
                            </td>
                            <td className="py-3 px-4 text-slate-700">{app.previousSchool}</td>
                            <td className="py-3 px-4 font-mono tabular-nums">
                              <span
                                className={
                                  app.docCompleteCount >= app.docTotalRequired
                                    ? 'text-emerald-700 font-bold'
                                    : 'text-amber-700 font-bold'
                                }
                              >
                                {app.docCompleteCount}/{app.docTotalRequired} Lengkap
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-emerald-900">
                              {app.status}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canVerifyApplicants && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingApplicant({ ...app })}
                                    className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg flex items-center gap-1 whitespace-nowrap"
                                    title="Edit Biodata Lengkap Pendaftar"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Edit Biodata
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedApplicantId(app.id)}
                                  className="px-2.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg whitespace-nowrap"
                                >
                                  Verifikasi & ZIP
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadBiodataPdf(
                                      app,
                                      documents.filter((d) => d.applicantId === app.id),
                                      config
                                    )
                                  }
                                  className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg whitespace-nowrap"
                                  title="Cetak Biodata PDF"
                                >
                                  PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredApplicants.length > pageSize && (
                  <div className="px-4 py-3 bg-emerald-50/40 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span>
                      Halaman {currentPage} dari {Math.ceil(filteredApplicants.length / pageSize)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="px-3 py-1 border border-slate-300 rounded-lg bg-white disabled:opacity-40"
                      >
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={currentPage >= Math.ceil(filteredApplicants.length / pageSize)}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="px-3 py-1 border border-slate-300 rounded-lg bg-white disabled:opacity-40"
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SELECTED APPLICANT DETAIL & SECTION 12 ZIP DOWNLOAD PANEL */}
              {selectedApplicant && (
                <div className="bg-white border border-emerald-600 rounded-2xl p-6 space-y-6 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                    <div>
                      <p className="text-xs font-mono text-amber-700 font-bold">
                        DETAIL CALON MURID · NOMOR PENDAFTARAN: {selectedApplicant.regNumber} ·
                        TAHUN AJARAN: {selectedApplicant.academicYear}
                      </p>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        {selectedApplicant.fullName}
                      </h3>
                      <p className="text-xs text-slate-600">
                        NIK: <span className="font-mono">{selectedApplicant.nik}</span> · NISN:{' '}
                        <span className="font-mono">{selectedApplicant.nisn}</span> · Sekolah Asal:{' '}
                        {selectedApplicant.previousSchool}
                      </p>
                    </div>

                    {/* SECTION 12: TWO MANDATORY ZIP BUTTONS + EDIT + PDF PRINT BUTTONS */}
                    <div className="flex flex-wrap items-center gap-2">
                      {canVerifyApplicants && (
                        <button
                          type="button"
                          onClick={() => setEditingApplicant({ ...selectedApplicant })}
                          className="px-3.5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit Biodata Lengkap
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRunZipDownload(selectedApplicant, 'docs_only')}
                        className="px-3.5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <FolderArchive className="w-4 h-4 text-amber-300" />
                        Unduh Semua Dokumen (ZIP)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRunZipDownload(selectedApplicant, 'biodata_and_docs')}
                        className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <FolderArchive className="w-4 h-4" />
                        Unduh Biodata + Semua Dokumen (ZIP)
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          downloadBiodataPdf(selectedApplicant, selectedApplicantDocs, config)
                        }
                        className="px-3 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Biodata PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadRegistrationProofPdf(selectedApplicant, config)}
                        className="px-3 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Bukti PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApplicantId(null);
                          setZipProgress(null);
                        }}
                        className="px-3 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>

                  {/* ZIP Progress & Retry Indicator */}
                  {zipProgress && (
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-emerald-950">
                        <span>{zipProgress.currentStep}</span>
                        <span className="font-mono tabular-nums">
                          {zipProgress.processedFiles} / {zipProgress.totalFiles} File Diproses
                        </span>
                      </div>
                      <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-700 transition-all"
                          style={{
                            width: `${
                              zipProgress.totalFiles > 0
                                ? Math.round(
                                    (zipProgress.processedFiles / zipProgress.totalFiles) * 100
                                  )
                                : 100
                            }%`,
                          }}
                        />
                      </div>
                      {zipProgress.missingRequiredDocs && zipProgress.missingRequiredDocs.length > 0 && (
                        <div className="text-amber-800 pt-1">
                          <strong>Dokumen Wajib Belum Tersedia:</strong>{' '}
                          {zipProgress.missingRequiredDocs.join(' · ')}
                        </div>
                      )}
                      {zipProgress.missingOptionalDocs && zipProgress.missingOptionalDocs.length > 0 && (
                        <div className="text-slate-600 pt-0.5">
                          <strong>Dokumen Opsional Belum Diunggah (Tidak Menggagalkan ZIP):</strong>{' '}
                          {zipProgress.missingOptionalDocs.join(' · ')}
                        </div>
                      )}
                      {zipProgress.failedFiles.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-1">
                          <p className="font-bold">Daftar File Gagal Diunduh:</p>
                          {zipProgress.failedFiles.map((f) => (
                            <p key={f.fileName}>
                              - {f.fileName}: {f.reason}
                            </p>
                          ))}
                          {lastZipMode && (
                            <button
                              type="button"
                              onClick={() => handleRunZipDownload(selectedApplicant, lastZipMode)}
                              className="mt-2 px-3 py-1 bg-red-700 text-white rounded font-semibold"
                            >
                              Coba Ulang Unduh ZIP
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full Student Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                    <div className="p-4 bg-emerald-50/40 rounded-xl border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                        A. Identitas Calon Murid
                      </h4>
                      <p><span className="text-slate-500">Tempat, Tgl Lahir:</span> {selectedApplicant.birthPlace}, {selectedApplicant.birthDate}</p>
                      <p><span className="text-slate-500">Jenis Kelamin / Agama:</span> {selectedApplicant.gender} / {selectedApplicant.religion}</p>
                      <p><span className="text-slate-500">Alamat:</span> {selectedApplicant.address}, {selectedApplicant.village}, Kec. {selectedApplicant.district}, {selectedApplicant.regency}</p>
                      <p><span className="text-slate-500">No. HP / Email:</span> <span className="font-mono">{selectedApplicant.phone}</span> / {selectedApplicant.email || '-'}</p>
                    </div>

                    <div className="p-4 bg-emerald-50/40 rounded-xl border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                        B. Orang Tua / Wali & Asal Sekolah
                      </h4>
                      <p><span className="text-slate-500">Ayah:</span> {selectedApplicant.fatherName} ({selectedApplicant.fatherJob}) · <span className="font-mono">{selectedApplicant.fatherPhone}</span></p>
                      <p><span className="text-slate-500">Ibu:</span> {selectedApplicant.motherName} ({selectedApplicant.motherJob}) · <span className="font-mono">{selectedApplicant.motherPhone}</span></p>
                      <p><span className="text-slate-500">Asal SMP/MTs:</span> {selectedApplicant.previousSchool} (NPSN: {selectedApplicant.previousSchoolNpsn})</p>
                      <p><span className="text-slate-500">Tahun Lulus / Ijazah:</span> {selectedApplicant.graduationYear} / {selectedApplicant.certificateNumber}</p>
                      <p><span className="text-slate-500">Data Tambahan:</span> {selectedApplicant.customDataSummary}</p>
                    </div>

                    {/* Status & Notes Control */}
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                      <h4 className="font-bold text-slate-900 border-b border-amber-200 pb-1.5">
                        C. Keputusan Verifikasi & Seleksi
                      </h4>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Ubah Status Pendaftaran:
                        </label>
                        <select
                          value={selectedApplicant.status}
                          disabled={!canVerifyApplicants}
                          onChange={(e) =>
                            handleUpdateApplicantStatus(
                              selectedApplicant,
                              e.target.value as ApplicantStatus,
                              selectedApplicant.verificationNotes
                            )
                          }
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-bold"
                        >
                          <option value="Menunggu verifikasi">Menunggu verifikasi</option>
                          <option value="Perlu perbaikan data">Perlu perbaikan data</option>
                          <option value="Terverifikasi">Terverifikasi</option>
                          <option value="Diterima">Diterima</option>
                          <option value="Tidak diterima">Tidak diterima</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Catatan Verifikasi / Perbaikan Data:
                        </label>
                        <textarea
                          rows={3}
                          defaultValue={selectedApplicant.verificationNotes}
                          id={`notes_${selectedApplicant.id}`}
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-lg"
                        />
                        {canVerifyApplicants && (
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(
                                `notes_${selectedApplicant.id}`
                              ) as HTMLTextAreaElement | null;
                              if (el) {
                                handleUpdateApplicantStatus(
                                  selectedApplicant,
                                  selectedApplicant.status,
                                  el.value
                                );
                              }
                            }}
                            className="mt-2 w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg"
                          >
                            Simpan Catatan & Sinkronkan Status
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin Upload / Replace Document for this Applicant */}
                  {canVerifyApplicants && (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">
                          Unggah / Ganti Berkas Dokumen Pendaftar oleh Admin:
                        </p>
                        <p className="text-slate-600">
                          Pilih jenis dokumen dan unggah file baru untuk menambah atau mengganti berkas milik {selectedApplicant.fullName}.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <select
                          value={
                            adminDocReqId ||
                            (allItems.find((i) => i.category === 'doc_requirement')?.id ?? '')
                          }
                          onChange={(e) => setAdminDocReqId(e.target.value)}
                          className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                        >
                          {allItems
                            .filter((i) => i.category === 'doc_requirement')
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.title} ({r.isRequired ? 'Wajib' : 'Opsional'})
                              </option>
                            ))}
                        </select>
                        <label className="cursor-pointer px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                          <Upload className="w-3.5 h-3.5 text-amber-300" />
                          {uploadingAdminDoc ? 'Mengunggah...' : 'Unggah / Ganti Dokumen'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            disabled={uploadingAdminDoc}
                            onChange={(e) =>
                              handleAdminUploadApplicantDoc(
                                selectedApplicant,
                                e.target.files ? e.target.files[0] : null
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Full Document Requirements & Uploaded Files Verification Matrix */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Status Kelengkapan & Verifikasi Dokumen Calon Murid ({selectedApplicantDocs.length} File Diunggah)
                      </h4>
                      <span className="text-xs text-slate-500">
                        Ijazah / SKL bersifat opsional saat pendaftaran online
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allItems
                        .filter((i) => i.category === 'doc_requirement' && i.isActive)
                        .sort((a, b) => a.order - b.order)
                        .map((req) => {
                          const docItem = selectedApplicantDocs.find(
                            (d) => d.docType === req.id || d.docLabel === req.title
                          );
                          return (
                            <div
                              key={req.id}
                              className={`p-4 border rounded-xl flex flex-col justify-between gap-3 ${
                                docItem
                                  ? 'border-emerald-200 bg-white'
                                  : req.isRequired
                                  ? 'border-amber-200 bg-amber-50/30'
                                  : 'border-slate-200 bg-slate-50/60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="text-xs font-bold text-slate-900">
                                      {req.title}
                                    </p>
                                    <span
                                      className={`text-[11px] font-semibold ${
                                        req.isRequired ? 'text-amber-700' : 'text-slate-500'
                                      }`}
                                    >
                                      ({req.isRequired ? 'Wajib' : 'Opsional'})
                                    </span>
                                  </div>

                                  {docItem ? (
                                    <>
                                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                                        {docItem.fileName} ({Math.round(docItem.fileSize / 1024)} KB)
                                      </p>
                                      <p className="text-xs text-emerald-700 font-bold mt-1">
                                        Sudah diunggah · Status: {docItem.verificationStatus}
                                      </p>
                                      {docItem.adminNote && docItem.adminNote !== '-' && (
                                        <p className="text-xs text-amber-800 mt-0.5">
                                          Catatan: {docItem.adminNote}
                                        </p>
                                      )}
                                    </>
                                  ) : (
                                    <p
                                      className={`text-xs font-semibold mt-1.5 ${
                                        req.isRequired ? 'text-amber-700' : 'text-slate-500'
                                      }`}
                                    >
                                      {req.isRequired
                                        ? 'Belum diunggah'
                                        : 'Belum diunggah (opsional)'}
                                    </p>
                                  )}
                                </div>

                                {docItem && (
                                  <div className="flex items-center gap-1.5">
                                    {docItem.fileDataUrl && (
                                      <a
                                        href={docItem.fileDataUrl}
                                        download={docItem.fileName}
                                        className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-bold hover:bg-emerald-100"
                                      >
                                        Unduh
                                      </a>
                                    )}
                                    {canManageConfig && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDeleteTarget({
                                            type: 'document',
                                            id: docItem.id,
                                            label: `Dokumen ${docItem.docLabel} (${docItem.regNumber})`,
                                          })
                                        }
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                        title="Hapus Dokumen"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {docItem && canVerifyApplicants && (
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleVerifyDocument(docItem, 'Valid', 'Berkas sesuai & valid')
                                    }
                                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg"
                                  >
                                    Set Valid
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleVerifyDocument(
                                        docItem,
                                        'Perlu Perbaikan',
                                        'Mohon unggah ulang dokumen yang lebih jelas'
                                      )
                                    }
                                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg"
                                  >
                                    Minta Perbaikan
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div className="pt-4 border-t border-slate-200 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteTarget({
                            type: 'applicant',
                            id: selectedApplicant.id,
                            label: `${selectedApplicant.fullName} (${selectedApplicant.regNumber})`,
                          })
                        }
                        className="px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Data Pendaftar (Super Admin)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CETAK & EKSPOR LAPORAN */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-emerald-950">
                  Pusat Cetak & Ekspor Laporan Resmi — Tahun Ajaran {selectedYearFilter}
                </h2>
                <p className="text-xs text-slate-600">
                  Seluruh laporan di bawah ini difilter secara ketat berdasarkan Tahun Ajaran{' '}
                  <strong className="font-mono text-amber-700">{selectedYearFilter}</strong> (
                  {yearApplicants.length} pendaftar) dan mencantumkan kop resmi{' '}
                  {config.officialName}.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {[
                    {
                      mode: 'all' as ReportPrintMode,
                      title: '1. Cetak Daftar Seluruh Pendaftar (PDF)',
                      desc: 'Laporan lengkap seluruh calon murid pada tahun ajaran terpilih.',
                    },
                    {
                      mode: 'by_status' as ReportPrintMode,
                      title: '2. Cetak Daftar Berdasarkan Status (PDF)',
                      desc: 'Rekapitulasi status verifikasi, diterima, dan tidak diterima.',
                    },
                    {
                      mode: 'by_gender' as ReportPrintMode,
                      title: '3. Cetak Rekap Berdasarkan Jenis Kelamin (PDF)',
                      desc: 'Perbandingan jumlah pendaftar laki-laki dan perempuan.',
                    },
                    {
                      mode: 'by_school' as ReportPrintMode,
                      title: '4. Cetak Rekap Berdasarkan Asal Sekolah (PDF)',
                      desc: 'Distribusi pendaftar berdasarkan SMP / MTs asal.',
                    },
                    {
                      mode: 'by_docs' as ReportPrintMode,
                      title: '5. Cetak Rekap Kelengkapan Dokumen (PDF)',
                      desc: 'Status kelengkapan unggahan berkas persyaratan.',
                    },
                  ].map((rep) => (
                    <div
                      key={rep.mode}
                      className="p-5 border border-emerald-200 rounded-2xl flex flex-col justify-between gap-4 bg-emerald-50/30"
                    >
                      <div>
                        <h3 className="text-sm font-bold text-emerald-950">{rep.title}</h3>
                        <p className="text-xs text-slate-600 mt-1">{rep.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          downloadSummaryReportPdf(
                            yearApplicants,
                            config,
                            selectedYearFilter,
                            rep.mode
                          )
                        }
                        className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-300" />
                        Unduh / Cetak PDF ({selectedYearFilter})
                      </button>
                    </div>
                  ))}

                  <div className="p-5 border border-amber-300 rounded-2xl flex flex-col justify-between gap-4 bg-amber-50/40">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950">
                        6. Ekspor Data Spreadsheet (Excel & CSV)
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Unduh seluruh kolom biodata pendaftar Tahun Ajaran {selectedYearFilter}{' '}
                        untuk pengolahan lanjutan.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => exportApplicantsToExcel(yearApplicants, selectedYearFilter)}
                        className="flex-1 py-2.5 bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold rounded-xl"
                      >
                        Ekspor Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={() => exportApplicantsToCsv(yearApplicants, selectedYearFilter)}
                        className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl"
                      >
                        Ekspor CSV (.csv)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PENGATURAN & EDIT TAHUN AJARAN DAN PERIODE SPMB */}
          {activeTab === 'academic_years' && (
            <div className="space-y-6">
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-emerald-950">
                    Pengaturan & Edit Tahun Ajaran Dinamis serta Periode SPMB
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Admin dapat menambah, mengedit jadwal/kuota/catatan setiap tahun ajaran, atau
                    mengubah tahun ajaran aktif kapan saja tanpa mengubah kode program.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-maarif-emerald-gold text-white rounded-2xl border border-amber-400/50">
                  <div>
                    <p className="text-xs text-emerald-200">Tahun Ajaran Aktif Saat Ini</p>
                    <p className="text-2xl font-mono font-bold text-amber-300 mt-0.5">
                      {config.activeYearLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-200">Status Pendaftaran Publik</p>
                    <p className="text-sm font-bold text-white mt-1">
                      {config.isRegistrationOpen
                        ? 'DIBUKA (Menerima Pendaftar Baru)'
                        : 'DITUTUP (Formulir Dinonaktifkan)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-200">Rentang Jadwal Aktif</p>
                    <p className="text-xs font-mono font-bold text-amber-300 mt-1">
                      {config.openDate} s/d {config.closeDate} (Pengumuman: {config.announcementDate})
                    </p>
                  </div>
                </div>

                {/* List of Academic Years with Full Edit & Delete */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-emerald-950">
                    Daftar Tahun Ajaran & Arsip Periode SPMB (Klik "Edit" untuk Mengubah)
                  </h3>
                  <div className="divide-y divide-emerald-100 border border-emerald-200 rounded-2xl">
                    {allAcademicYears.map((yr) => {
                      const countInYear = applicants.filter(
                        (a) => a.academicYear === yr.yearLabel
                      ).length;
                      const isCurrentActive = config.activeYearLabel === yr.yearLabel;

                      return (
                        <div
                          key={yr.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-mono font-bold text-emerald-950">
                                Tahun Ajaran {yr.yearLabel}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span
                                className={`text-xs font-bold ${
                                  isCurrentActive ? 'text-amber-700' : 'text-slate-500'
                                }`}
                              >
                                {isCurrentActive ? '★ AKTIF DIGUNAKAN' : 'ARSIP / PERIODE LAIN'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-mono mt-0.5">
                              Buka: {yr.openDate} · Tutup: {yr.closeDate} · Pengumuman:{' '}
                              {yr.announcementDate} · Kuota: {yr.quota} · Pendaftar:{' '}
                              <strong>{countInYear} murid</strong>
                            </p>
                            {yr.notes && (
                              <p className="text-xs text-slate-500 mt-0.5">{yr.notes}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {canManageConfig && (
                              <button
                                type="button"
                                onClick={() => setEditingYear({ ...yr })}
                                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit Periode
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedYearFilter(yr.yearLabel);
                                setActiveTab('applicants');
                              }}
                              className="px-3 py-1.5 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 hover:bg-emerald-50"
                            >
                              Lihat Pendaftar ({countInYear})
                            </button>

                            {!isCurrentActive && canManageConfig && (
                              <button
                                type="button"
                                onClick={() => setConfirmYearSwitch(yr)}
                                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl"
                              >
                                Aktifkan
                              </button>
                            )}

                            {!isCurrentActive && isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteTarget({
                                    type: 'year',
                                    id: yr.id,
                                    label: `Tahun Ajaran ${yr.yearLabel}`,
                                  })
                                }
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Hapus Tahun Ajaran"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add New Academic Year Form */}
                {canManageConfig && (
                  <form
                    onSubmit={handleAddAcademicYear}
                    className="pt-4 border-t border-emerald-200 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-emerald-950">
                      Tambah Tahun Ajaran / Periode SPMB Baru
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tahun Ajaran (YYYY/YYYY)
                        </label>
                        <input
                          type="text"
                          value={newYearLabel}
                          onChange={(e) => setNewYearLabel(e.target.value)}
                          placeholder="2028/2029"
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tanggal Buka
                        </label>
                        <input
                          type="date"
                          value={newYearOpenDate}
                          onChange={(e) => setNewYearOpenDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tanggal Tutup
                        </label>
                        <input
                          type="date"
                          value={newYearCloseDate}
                          onChange={(e) => setNewYearCloseDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tanggal Pengumuman
                        </label>
                        <input
                          type="date"
                          value={newYearAnnounceDate}
                          onChange={(e) => setNewYearAnnounceDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kuota Murid
                        </label>
                        <input
                          type="number"
                          value={newYearQuota}
                          onChange={(e) => setNewYearQuota(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tambah
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: EDIT SELURUH INFORMASI SEKOLAH, LOGO, BANNER & MEDIA SOSIAL (SECTION 5) */}
          {activeTab === 'school_settings' && (
            <form
              onSubmit={handleSaveSchoolConfig}
              className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-emerald-950">
                    Edit Seluruh Identitas Sekolah, Logo, Banner Utama, Jadwal & Media Sosial
                  </h2>
                  <p className="text-xs text-slate-600">
                    Admin dapat mengubah teks, mengunggah gambar logo/banner langsung dari perangkat,
                    dan memperbarui jadwal publik secara instan.
                  </p>
                </div>
                {canManageConfig && (
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0"
                  >
                    <Save className="w-4 h-4 text-amber-300" />
                    Simpan Semua Perubahan Sekolah
                  </button>
                )}
              </div>

              {/* Direct Image Upload for Logo & Hero Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl text-xs">
                <div className="flex items-start gap-4">
                  <img
                    src={editConfig.logoUrl || ASSETS.schoolLogo}
                    alt="Logo Sekolah"
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 object-contain rounded-xl bg-white border border-amber-400 p-1 shrink-0"
                  />
                  <div className="space-y-2 flex-1">
                    <label className="block font-bold text-emerald-950">
                      Logo Resmi Sekolah
                    </label>
                    <input
                      type="text"
                      value={editConfig.logoUrl}
                      onChange={(e) => setEditConfig({ ...editConfig, logoUrl: e.target.value })}
                      placeholder="URL Logo atau unggah file..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Unggah File Logo Baru
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const dataUrl = await compressImageFileToDataUrl(file, 500);
                          setEditConfig((prev) => ({ ...prev, logoUrl: dataUrl }));
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <img
                    src={editConfig.heroBannerUrl || ASSETS.heroBuilding}
                    alt="Banner Gedung"
                    referrerPolicy="no-referrer"
                    className="w-28 h-20 object-cover rounded-xl bg-white border border-amber-400 shrink-0"
                  />
                  <div className="space-y-2 flex-1">
                    <label className="block font-bold text-emerald-950">
                      Foto Banner Utama / Gedung Sekolah
                    </label>
                    <input
                      type="text"
                      value={editConfig.heroBannerUrl}
                      onChange={(e) =>
                        setEditConfig({ ...editConfig, heroBannerUrl: e.target.value })
                      }
                      placeholder="URL Foto Banner atau unggah file..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Unggah Foto Gedung Baru
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const dataUrl = await compressImageFileToDataUrl(file, 1200);
                          setEditConfig((prev) => ({ ...prev, heroBannerUrl: dataUrl }));
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Active Academic Year & Schedule Quick Edit inside School Settings */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-amber-50/60 border border-amber-300 rounded-2xl text-xs">
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Tahun Ajaran Aktif Publik
                  </label>
                  <input
                    type="text"
                    value={editConfig.activeYearLabel}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, activeYearLabel: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono font-bold bg-white border border-amber-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Status Pendaftaran
                  </label>
                  <select
                    value={editConfig.isRegistrationOpen ? 'open' : 'closed'}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        isRegistrationOpen: e.target.value === 'open',
                      })
                    }
                    className="w-full px-3 py-2 font-bold bg-white border border-amber-300 rounded-lg"
                  >
                    <option value="open">DIBUKA</option>
                    <option value="closed">DITUTUP</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Tanggal Buka Pendaftaran
                  </label>
                  <input
                    type="date"
                    value={editConfig.openDate}
                    onChange={(e) => setEditConfig({ ...editConfig, openDate: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-white border border-amber-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Tanggal Tutup Pendaftaran
                  </label>
                  <input
                    type="date"
                    value={editConfig.closeDate}
                    onChange={(e) => setEditConfig({ ...editConfig, closeDate: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-white border border-amber-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Tanggal Pengumuman Hasil
                  </label>
                  <input
                    type="date"
                    value={editConfig.announcementDate}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, announcementDate: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-amber-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Resmi Sekolah
                  </label>
                  <input
                    type="text"
                    value={editConfig.officialName}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, officialName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Singkat Sekolah
                  </label>
                  <input
                    type="text"
                    value={editConfig.shortName}
                    onChange={(e) => setEditConfig({ ...editConfig, shortName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
                  <input
                    type="text"
                    value={editConfig.npsn}
                    onChange={(e) => setEditConfig({ ...editConfig, npsn: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                  <input
                    type="text"
                    value={editConfig.address}
                    onChange={(e) => setEditConfig({ ...editConfig, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Desa / Kelurahan
                  </label>
                  <input
                    type="text"
                    value={editConfig.village}
                    onChange={(e) => setEditConfig({ ...editConfig, village: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
                  <input
                    type="text"
                    value={editConfig.district}
                    onChange={(e) => setEditConfig({ ...editConfig, district: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kabupaten / Kota
                  </label>
                  <input
                    type="text"
                    value={editConfig.regency}
                    onChange={(e) => setEditConfig({ ...editConfig, regency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Provinsi & Kode Pos
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editConfig.province}
                      onChange={(e) => setEditConfig({ ...editConfig, province: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                    <input
                      type="text"
                      value={editConfig.postalCode}
                      onChange={(e) =>
                        setEditConfig({ ...editConfig, postalCode: e.target.value })
                      }
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon</label>
                  <input
                    type="text"
                    value={editConfig.phone}
                    onChange={(e) => setEditConfig({ ...editConfig, phone: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp Panitia
                  </label>
                  <input
                    type="text"
                    value={editConfig.whatsapp}
                    onChange={(e) => setEditConfig({ ...editConfig, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Resmi</label>
                  <input
                    type="email"
                    value={editConfig.email}
                    onChange={(e) => setEditConfig({ ...editConfig, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={editConfig.principalName}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, principalName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={editConfig.principalNip}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, principalNip: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Ketua Panitia SPMB
                  </label>
                  <input
                    type="text"
                    value={editConfig.committeeHeadName}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, committeeHeadName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                {/* Social Media & Google Maps URL */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tautan Google Maps Lokasi
                  </label>
                  <input
                    type="text"
                    value={editConfig.mapUrl}
                    onChange={(e) => setEditConfig({ ...editConfig, mapUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tautan Facebook & Instagram
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editConfig.facebookUrl}
                      onChange={(e) =>
                        setEditConfig({ ...editConfig, facebookUrl: e.target.value })
                      }
                      placeholder="URL Facebook"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                    <input
                      type="text"
                      value={editConfig.instagramUrl}
                      onChange={(e) =>
                        setEditConfig({ ...editConfig, instagramUrl: e.target.value })
                      }
                      placeholder="URL Instagram"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tautan YouTube Resmi
                  </label>
                  <input
                    type="text"
                    value={editConfig.youtubeUrl}
                    onChange={(e) => setEditConfig({ ...editConfig, youtubeUrl: e.target.value })}
                    placeholder="URL YouTube"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sejarah Singkat Sekolah
                  </label>
                  <textarea
                    rows={3}
                    value={editConfig.history}
                    onChange={(e) => setEditConfig({ ...editConfig, history: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Visi Sekolah</label>
                  <textarea
                    rows={2}
                    value={editConfig.vision}
                    onChange={(e) => setEditConfig({ ...editConfig, vision: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Misi Sekolah</label>
                  <textarea
                    rows={4}
                    value={editConfig.mission}
                    onChange={(e) => setEditConfig({ ...editConfig, mission: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </form>
          )}

          {/* TAB 7: EDIT SELURUH KONTEN SEKOLAH, KOLOM FORMULIR & PERSYARATAN DOKUMEN */}
          {activeTab === 'form_docs' && (
            <div className="space-y-6">
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-emerald-950">
                      Edit Program Unggulan, Fasilitas, Ekskul, Prestasi, Galeri, Form & Dokumen
                    </h2>
                    <p className="text-xs text-slate-600">
                      Klik tombol <strong>"Edit Lengkap"</strong> pada item mana pun untuk mengubah
                      judul, deskripsi, foto/gambar, urutan tampil, atau batas ukuran file.
                    </p>
                  </div>
                </div>

                {/* Category Filter Bar */}
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                  {[
                    { id: 'ALL', label: 'Semua Kategori' },
                    { id: 'program', label: 'Program Unggulan' },
                    { id: 'facility', label: 'Fasilitas' },
                    { id: 'extracurricular', label: 'Ekstrakurikuler' },
                    { id: 'achievement', label: 'Prestasi' },
                    { id: 'gallery', label: 'Galeri Foto' },
                    { id: 'custom_field', label: 'Kolom Formulir' },
                    { id: 'doc_requirement', label: 'Syarat Dokumen' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setItemCategoryFilter(cat.id as SchoolItemCategory | 'ALL')
                      }
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                        itemCategoryFilter === cat.id
                          ? 'bg-emerald-800 text-amber-300'
                          : 'text-emerald-900 hover:bg-emerald-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {canManageConfig && (
                  <form
                    onSubmit={handleAddSchoolItem}
                    className="p-5 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/50 border border-emerald-200 rounded-2xl space-y-4 text-xs"
                  >
                    <h3 className="font-bold text-emerald-950">
                      + Tambah Item Baru (Program / Fasilitas / Galeri / Kolom Form / Syarat Dokumen)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                        <select
                          value={newItemCategory}
                          onChange={(e) =>
                            setNewItemCategory(e.target.value as SchoolItemCategory)
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                        >
                          <option value="program">Program Unggulan</option>
                          <option value="facility">Fasilitas Sekolah</option>
                          <option value="extracurricular">Ekstrakurikuler</option>
                          <option value="achievement">Prestasi Sekolah</option>
                          <option value="gallery">Galeri Foto Sekolah</option>
                          <option value="custom_field">Kolom Tambahan Formulir</option>
                          <option value="doc_requirement">Persyaratan Dokumen Unggahan</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Judul / Nama Kolom / Nama Dokumen *
                        </label>
                        <input
                          type="text"
                          value={newItemTitle}
                          onChange={(e) => setNewItemTitle(e.target.value)}
                          placeholder="Contoh: Laboratorium Bahasa / Kartu Indonesia Pintar"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Format / Tipe Input
                        </label>
                        <input
                          type="text"
                          value={newItemFieldType}
                          onChange={(e) => setNewItemFieldType(e.target.value)}
                          placeholder="PDF,JPG,PNG atau text"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Deskripsi / Keterangan Lengkap
                        </label>
                        <input
                          type="text"
                          value={newItemDesc}
                          onChange={(e) => setNewItemDesc(e.target.value)}
                          placeholder="Deskripsi yang ditampilkan pada halaman publik atau formulir..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Foto / Gambar (URL atau Unggah dari Perangkat)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newItemImageUrl}
                            onChange={(e) => setNewItemImageUrl(e.target.value)}
                            placeholder="URL Gambar (Opsional)"
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl"
                          />
                          <label className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl cursor-pointer flex items-center gap-1 whitespace-nowrap">
                            <Upload className="w-3.5 h-3.5" />
                            Pilih Foto
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const dataUrl = await compressImageFileToDataUrl(file, 900);
                                setNewItemImageUrl(dataUrl);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={newItemRequired}
                            onChange={(e) => setNewItemRequired(e.target.checked)}
                          />
                          <span>Wajib Diisi / Diunggah Calon Murid</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span>Batas Ukuran (KB):</span>
                          <input
                            type="number"
                            value={newItemMaxSizeKb}
                            onChange={(e) => setNewItemMaxSizeKb(Number(e.target.value))}
                            className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4 text-amber-300" />
                        Tambah Item Baru
                      </button>
                    </div>
                  </form>
                )}

                {/* Items List with Full Edit, Order Up/Down, Active Toggle & Delete */}
                <div className="divide-y divide-emerald-100 border border-emerald-200 rounded-2xl text-xs">
                  {displayedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-emerald-50/30 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-16 h-14 object-cover rounded-xl border border-emerald-200 shrink-0"
                          />
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono uppercase text-amber-700 font-bold">
                              [{item.category}]
                            </span>
                            <span className="font-mono text-slate-400">Urutan #{item.order}</span>
                            <strong className="text-slate-900 text-sm">{item.title}</strong>
                            {(item.category === 'doc_requirement' ||
                              item.category === 'custom_field') && (
                              <span
                                className={`font-bold ${
                                  item.isRequired ? 'text-amber-700' : 'text-slate-500'
                                }`}
                              >
                                ({item.isRequired ? 'Wajib' : 'Opsional'})
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 mt-1">{item.description}</p>
                          {(item.category === 'doc_requirement' ||
                            item.category === 'custom_field') && (
                            <p className="text-slate-400 font-mono mt-0.5">
                              Format/Tipe: {item.fieldType} · Maks: {item.maxSizeKb} KB · Periode:{' '}
                              {item.academicYear}
                            </p>
                          )}
                        </div>
                      </div>

                      {canManageConfig && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveItemOrder(item, 'up')}
                            className="p-1.5 border border-slate-300 rounded-lg hover:bg-stone-100"
                            title="Naikkan Urutan"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItemOrder(item, 'down')}
                            className="p-1.5 border border-slate-300 rounded-lg hover:bg-stone-100"
                            title="Turunkan Urutan"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {(item.category === 'doc_requirement' ||
                            item.category === 'custom_field') && (
                            <button
                              type="button"
                              onClick={async () => {
                                const { id: itemId, ...rest } = item;
                                const nextReq = !item.isRequired;
                                await setDoc(doc(db, 'school_items', itemId), {
                                  ...rest,
                                  isRequired: nextReq,
                                  createdAt: rest.createdAt || serverTimestamp(),
                                  updatedAt: serverTimestamp(),
                                });
                                await recordAudit(
                                  `Ubah Status Wajib/Opsional (${item.title})`,
                                  itemId,
                                  `Mengubah status "${item.title}" menjadi ${
                                    nextReq ? 'WAJIB' : 'OPSIONAL'
                                  }.`
                                );
                                showToast(
                                  'success',
                                  `Status "${item.title}" berhasil diubah menjadi ${
                                    nextReq ? 'Wajib' : 'Opsional'
                                  }.`
                                );
                              }}
                              className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                                item.isRequired
                                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                              }`}
                              title="Klik untuk mengubah status Wajib atau Opsional"
                            >
                              {item.isRequired ? 'Status: Wajib' : 'Status: Opsional'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setEditingItem({ ...item })}
                            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Lengkap
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const { id: itemId, ...rest } = item;
                              await setDoc(doc(db, 'school_items', itemId), {
                                ...rest,
                                isActive: !item.isActive,
                                createdAt: rest.createdAt || serverTimestamp(),
                                updatedAt: serverTimestamp(),
                              });
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold ${
                              item.isActive
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {item.isActive ? 'Aktif' : 'Disembunyikan'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteTarget({
                                type: 'item',
                                id: item.id,
                                label: item.title,
                              })
                            }
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: EDIT PENGUMUMAN & GALERI */}
          {activeTab === 'announcements_gallery' && (
            <div className="space-y-6">
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-emerald-950">
                      Pengelolaan & Edit Pengumuman Resmi serta Galeri Dokumentasi Sekolah
                    </h2>
                    <p className="text-xs text-slate-600">
                      Tambah, edit, unggah gambar pengumuman, serta kelola foto galeri kegiatan sekolah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setItemCategoryFilter('gallery');
                      setNewItemCategory('gallery');
                      setActiveTab('form_docs');
                    }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Kelola & Tambah Foto Galeri ({allItems.filter((i) => i.category === 'gallery').length})
                  </button>
                </div>

                {canManageConfig && (
                  <form
                    onSubmit={handleAddAnnouncement}
                    className="p-5 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/50 border border-emerald-200 rounded-2xl space-y-3 text-xs"
                  >
                    <h3 className="font-bold text-emerald-950">
                      + Terbitkan Pengumuman Baru (Periode {selectedYearFilter})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block font-semibold mb-1">Judul Pengumuman *</label>
                        <input
                          type="text"
                          value={newAnnTitle}
                          onChange={(e) => setNewAnnTitle(e.target.value)}
                          placeholder="Contoh: Pengumuman Hasil Seleksi Tahap 1"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Tanggal Publikasi</label>
                        <input
                          type="date"
                          value={newAnnDate}
                          onChange={(e) => setNewAnnDate(e.target.value)}
                          className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block font-semibold mb-1">
                          Gambar / Poster Pengumuman (Opsional)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newAnnImageUrl}
                            onChange={(e) => setNewAnnImageUrl(e.target.value)}
                            placeholder="URL Gambar atau unggah file..."
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl"
                          />
                          <label className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
                            <Upload className="w-3.5 h-3.5" />
                            Unggah Gambar
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const dataUrl = await compressImageFileToDataUrl(file, 900);
                                setNewAnnImageUrl(dataUrl);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block font-semibold mb-1">Isi Pengumuman *</label>
                        <textarea
                          rows={3}
                          value={newAnnContent}
                          onChange={(e) => setNewAnnContent(e.target.value)}
                          className="w-full p-3 bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl"
                    >
                      Terbitkan Pengumuman
                    </button>
                  </form>
                )}

                <div className="divide-y divide-emerald-100 border border-emerald-200 rounded-2xl text-xs">
                  {allAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        {ann.imageUrl && (
                          <img
                            src={ann.imageUrl}
                            alt={ann.title}
                            referrerPolicy="no-referrer"
                            className="w-16 h-14 object-cover rounded-xl border border-emerald-200 shrink-0"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2 font-mono text-amber-700 font-bold">
                            <span>{ann.publishDate}</span>
                            <span>·</span>
                            <span>Tahun Ajaran {ann.academicYear}</span>
                            <span>·</span>
                            <span>{ann.isPublished ? 'Dipublikasikan' : 'Draft Tersembunyi'}</span>
                          </div>
                          <h4 className="font-bold text-emerald-950 text-sm mt-0.5">{ann.title}</h4>
                          <p className="text-slate-600 mt-1 whitespace-pre-line">{ann.content}</p>
                        </div>
                      </div>
                      {canManageConfig && (
                        <div className="flex items-center gap-2 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => setEditingAnnouncement({ ...ann })}
                            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const { id: annId, ...rest } = ann;
                              await setDoc(doc(db, 'announcements', annId), {
                                ...rest,
                                isPublished: !ann.isPublished,
                                createdAt: rest.createdAt || serverTimestamp(),
                                updatedAt: serverTimestamp(),
                              });
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold ${
                              ann.isPublished
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {ann.isPublished ? 'Publik' : 'Draft'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteTarget({
                                type: 'announcement',
                                id: ann.id,
                                label: ann.title,
                              })
                            }
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: EDIT AKUN, HAK AKSES & KEAMANAN */}
          {activeTab === 'accounts_security' && (
            <div className="space-y-6">
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-emerald-950">
                  Pengaturan & Edit Akun Pengelola Berbasis Peran (RBAC)
                </h2>
                <p className="text-xs text-slate-600">
                  Atur dan edit hak akses untuk Super Admin, Admin SPMB, Panitia SPMB, dan Kepala
                  Sekolah. Keamanan ditegakkan langsung melalui Firebase Security Rules.
                </p>

                {isSuperAdmin && (
                  <form
                    onSubmit={handleAddAdminUser}
                    className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-end"
                  >
                    <div>
                      <label className="block font-semibold mb-1">Firebase Auth UID *</label>
                      <input
                        type="text"
                        value={newAdminUid}
                        onChange={(e) => setNewAdminUid(e.target.value)}
                        placeholder="UID pengguna Google"
                        className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Nama Lengkap *</label>
                      <input
                        type="text"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder="Nama Panitia / Admin"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Email Google *</label>
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="panitia@gmail.com"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Peran Hak Akses *</label>
                      <select
                        value={newAdminRole}
                        onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                      >
                        <option value="Super Admin">Super Admin</option>
                        <option value="Admin SPMB">Admin SPMB</option>
                        <option value="Panitia SPMB">Panitia SPMB</option>
                        <option value="Kepala Sekolah">Kepala Sekolah</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl"
                    >
                      Tambah Akun
                    </button>
                  </form>
                )}

                <div className="divide-y divide-emerald-100 border border-emerald-200 rounded-2xl text-xs">
                  <div className="p-4 flex justify-between items-center bg-emerald-50/40">
                    <div>
                      <p className="font-bold text-emerald-950">
                        aprizamairizon12@gmail.com (Bootstrapped Super Admin)
                      </p>
                      <p className="text-slate-500">
                        Memiliki akses penuh ke seluruh konfigurasi sekolah, tahun ajaran, dan
                        manajemen akun.
                      </p>
                    </div>
                    <span className="font-mono font-bold text-amber-700">Super Admin</span>
                  </div>
                  {adminUsers.map((adm) => (
                    <div key={adm.uid} className="p-4 flex justify-between items-center gap-4">
                      <div>
                        <p className="font-bold text-emerald-950">
                          {adm.fullName} ({adm.email})
                        </p>
                        <p className="font-mono text-slate-500">
                          UID: {adm.uid} · Status: {adm.isActive ? 'Aktif' : 'Nonaktif'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-800">{adm.role}</span>
                        {isSuperAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingAdminUser({ ...adm })}
                              className="px-3 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteTarget({
                                  type: 'admin',
                                  id: adm.uid,
                                  label: adm.email,
                                })
                              }
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: AUDIT AKTIVITAS, CADANGAN & PANDUAN FIREBASE / HOSTING */}
          {activeTab === 'audit_backup_guide' && (
            <div className="space-y-6">
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-emerald-950">
                      Cadangan Data (Backup) & Audit Aktivitas Admin
                    </h2>
                    <p className="text-xs text-slate-500">
                      Ekspor konfigurasi sekolah dan metadata pendaftar dalam format JSON terstruktur
                      (dokumen pribadi tidak disertakan demi privasi).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBackupJson}
                    className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    Unduh Cadangan Database (JSON)
                  </button>
                </div>

                {/* Audit Log Table */}
                <div className="pt-4">
                  <h3 className="text-sm font-bold text-emerald-950 mb-3">
                    Catatan Aktivitas Penting Admin (Audit Trail)
                  </h3>
                  <div className="border border-emerald-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-emerald-50 border-b border-emerald-200 text-emerald-950">
                        <tr>
                          <th className="py-2.5 px-3">Waktu</th>
                          <th className="py-2.5 px-3">Pelaksana</th>
                          <th className="py-2.5 px-3">Aksi</th>
                          <th className="py-2.5 px-3">Rincian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">
                              Belum ada catatan aktivitas.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.slice(0, 30).map((log) => (
                            <tr key={log.id}>
                              <td className="py-2 px-3 font-mono text-slate-500">
                                {formatTimestampId(log.createdAt)}
                              </td>
                              <td className="py-2 px-3 font-medium">
                                {log.actorEmail} ({log.actorRole})
                              </td>
                              <td className="py-2 px-3 font-bold text-emerald-900">
                                {log.action}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{log.details}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
                <h3 className="text-base font-bold text-emerald-950">
                  Panduan Resmi Konfigurasi Firebase & Publikasi Hosting Gratis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                    <p className="font-bold text-emerald-950">
                      Langkah 1–5: Konfigurasi Proyek & Keamanan Firebase
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Buat proyek di Firebase Console (console.firebase.google.com).</li>
                      <li>Aktifkan Firebase Authentication dengan metode Google Sign-In.</li>
                      <li>Buat database Cloud Firestore pada lokasi terdekat (asia-southeast1).</li>
                      <li>Aktifkan Firebase Storage untuk penyimpanan berkas ukuran besar.</li>
                      <li>Pasang aturan keamanan dari file <code>firestore.rules</code>.</li>
                    </ol>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                    <p className="font-bold text-emerald-950">
                      Langkah 6–10: Akun Admin Pertama, Pengujian & Deployment
                    </p>
                    <ol className="list-decimal list-inside space-y-1" start={6}>
                      <li>Login menggunakan email Super Admin yang terdaftar.</li>
                      <li>Klik tombol "Sinkronkan Data Awal" pada header Dashboard Admin.</li>
                      <li>Uji alur pendaftaran publik, cek status, verifikasi, dan unduh ZIP.</li>
                      <li>Jalankan <code>npm run build</code> kemudian <code>firebase deploy</code>.</li>
                      <li>Bagikan tautan publik <code>.web.app</code> kepada masyarakat.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT BIODATA LENGKAP PENDAFTAR (ADMIN CAN EDIT ALL FIELDS) */}
      {/* ========================================================================= */}
      {editingApplicant && (
        <div className="fixed inset-0 z-50 bg-emerald-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedApplicant}
            className="bg-white border-2 border-amber-400 rounded-2xl max-w-4xl w-full p-6 md:p-8 space-y-5 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-emerald-200 pb-4">
              <div>
                <p className="text-xs font-mono font-bold text-amber-700">
                  MODE EDIT BIODATA PENDAFTAR · {editingApplicant.regNumber}
                </p>
                <h3 className="text-lg font-bold text-emerald-950">
                  Edit Lengkap Data Calon Murid: {editingApplicant.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingApplicant(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  value={editingApplicant.fullName}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran Daftar *</label>
                <input
                  type="text"
                  value={editingApplicant.academicYear}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, academicYear: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">NIK *</label>
                <input
                  type="text"
                  value={editingApplicant.nik}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, nik: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">NISN *</label>
                <input
                  type="text"
                  value={editingApplicant.nisn}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, nisn: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin *</label>
                <select
                  value={editingApplicant.gender}
                  onChange={(e) =>
                    setEditingApplicant({
                      ...editingApplicant,
                      gender: e.target.value as 'Laki-laki' | 'Perempuan',
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tempat Lahir *</label>
                <input
                  type="text"
                  value={editingApplicant.birthPlace}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, birthPlace: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal Lahir *</label>
                <input
                  type="date"
                  value={editingApplicant.birthDate}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, birthDate: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Agama</label>
                <input
                  type="text"
                  value={editingApplicant.religion}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, religion: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  value={editingApplicant.address}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Desa / Kelurahan</label>
                <input
                  type="text"
                  value={editingApplicant.village}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, village: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kecamatan</label>
                <input
                  type="text"
                  value={editingApplicant.district}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, district: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={editingApplicant.regency}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, regency: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Provinsi & Kode Pos</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingApplicant.province}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, province: e.target.value })
                    }
                    placeholder="Provinsi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={editingApplicant.postalCode}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, postalCode: e.target.value })
                    }
                    placeholder="Kode Pos"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">No. HP Calon Murid</label>
                <input
                  type="text"
                  value={editingApplicant.phone}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Calon Murid</label>
                <input
                  type="text"
                  value={editingApplicant.email}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Ayah & Pekerjaan</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingApplicant.fatherName}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, fatherName: e.target.value })
                    }
                    placeholder="Nama Ayah"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={editingApplicant.fatherJob}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, fatherJob: e.target.value })
                    }
                    placeholder="Pekerjaan Ayah"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Ibu & Pekerjaan</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingApplicant.motherName}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, motherName: e.target.value })
                    }
                    placeholder="Nama Ibu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={editingApplicant.motherJob}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, motherJob: e.target.value })
                    }
                    placeholder="Pekerjaan Ibu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  No. HP Ayah & No. HP Ibu
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingApplicant.fatherPhone}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, fatherPhone: e.target.value })
                    }
                    placeholder="HP Ayah"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={editingApplicant.motherPhone}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, motherPhone: e.target.value })
                    }
                    placeholder="HP Ibu"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Wali & Pekerjaan</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingApplicant.guardianName}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, guardianName: e.target.value })
                    }
                    placeholder="Nama Wali"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={editingApplicant.guardianJob}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, guardianJob: e.target.value })
                    }
                    placeholder="Pekerjaan Wali"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alamat Orang Tua / Wali
                </label>
                <input
                  type="text"
                  value={editingApplicant.parentAddress}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, parentAddress: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Asal SMP / MTs</label>
                <input
                  type="text"
                  value={editingApplicant.previousSchool}
                  onChange={(e) =>
                    setEditingApplicant({ ...editingApplicant, previousSchool: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  NPSN & Alamat Sekolah Asal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingApplicant.previousSchoolNpsn}
                    onChange={(e) =>
                      setEditingApplicant({
                        ...editingApplicant,
                        previousSchoolNpsn: e.target.value,
                      })
                    }
                    placeholder="NPSN"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={editingApplicant.previousSchoolAddress}
                    onChange={(e) =>
                      setEditingApplicant({
                        ...editingApplicant,
                        previousSchoolAddress: e.target.value,
                      })
                    }
                    placeholder="Alamat SMP/MTs"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tahun Lulus & No. Ijazah/SKL
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingApplicant.graduationYear}
                    onChange={(e) =>
                      setEditingApplicant({ ...editingApplicant, graduationYear: e.target.value })
                    }
                    placeholder="Tahun"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={editingApplicant.certificateNumber}
                    onChange={(e) =>
                      setEditingApplicant({
                        ...editingApplicant,
                        certificateNumber: e.target.value,
                      })
                    }
                    placeholder="No. Ijazah/SKL"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Seleksi</label>
                <select
                  value={editingApplicant.status}
                  onChange={(e) =>
                    setEditingApplicant({
                      ...editingApplicant,
                      status: e.target.value as ApplicantStatus,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                >
                  <option value="Menunggu verifikasi">Menunggu verifikasi</option>
                  <option value="Perlu perbaikan data">Perlu perbaikan data</option>
                  <option value="Terverifikasi">Terverifikasi</option>
                  <option value="Diterima">Diterima</option>
                  <option value="Tidak diterima">Tidak diterima</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Data Tambahan / Peminatan
                </label>
                <input
                  type="text"
                  value={editingApplicant.customDataSummary}
                  onChange={(e) =>
                    setEditingApplicant({
                      ...editingApplicant,
                      customDataSummary: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Verifikasi Panitia
                </label>
                <textarea
                  rows={2}
                  value={editingApplicant.verificationNotes}
                  onChange={(e) =>
                    setEditingApplicant({
                      ...editingApplicant,
                      verificationNotes: e.target.value,
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-emerald-200">
              <button
                type="button"
                onClick={() => setEditingApplicant(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-emerald-700 to-teal-700 text-white rounded-xl flex items-center gap-2"
              >
                <Save className="w-4 h-4 text-amber-300" />
                Simpan Perubahan Biodata
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT TAHUN AJARAN & PERIODE SPMB */}
      {/* ========================================================================= */}
      {editingYear && (
        <div className="fixed inset-0 z-50 bg-emerald-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedYear}
            className="bg-white border-2 border-amber-400 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <h3 className="text-base font-bold text-emerald-950">
                Edit Tahun Ajaran & Periode ({editingYear.yearLabel})
              </h3>
              <button type="button" onClick={() => setEditingYear(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Label Tahun Ajaran</label>
                <input
                  type="text"
                  value={editingYear.yearLabel}
                  onChange={(e) =>
                    setEditingYear({ ...editingYear, yearLabel: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Kuota Penerimaan</label>
                <input
                  type="number"
                  value={editingYear.quota}
                  onChange={(e) =>
                    setEditingYear({ ...editingYear, quota: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Tanggal Buka</label>
                <input
                  type="date"
                  value={editingYear.openDate}
                  onChange={(e) =>
                    setEditingYear({ ...editingYear, openDate: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Tanggal Tutup</label>
                <input
                  type="date"
                  value={editingYear.closeDate}
                  onChange={(e) =>
                    setEditingYear({ ...editingYear, closeDate: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Tanggal Pengumuman</label>
                <input
                  type="date"
                  value={editingYear.announcementDate}
                  onChange={(e) =>
                    setEditingYear({ ...editingYear, announcementDate: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Status Periode</label>
                <select
                  value={editingYear.registrationStatus}
                  onChange={(e) =>
                    setEditingYear({
                      ...editingYear,
                      registrationStatus: e.target.value as 'open' | 'closed' | 'scheduled',
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                >
                  <option value="open">Dibuka (Open)</option>
                  <option value="closed">Ditutup (Closed)</option>
                  <option value="scheduled">Terjadwal (Scheduled)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">Catatan Periode</label>
                <textarea
                  rows={2}
                  value={editingYear.notes}
                  onChange={(e) => setEditingYear({ ...editingYear, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-emerald-200">
              <button
                type="button"
                onClick={() => setEditingYear(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-800 text-white rounded-xl font-bold"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT ITEM SEKOLAH (PROGRAM, FASILITAS, GALERI, FORM, DOKUMEN) */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-emerald-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedItem}
            className="bg-white border-2 border-amber-400 rounded-2xl max-w-xl w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <h3 className="text-base font-bold text-emerald-950">
                Edit Lengkap Item ({editingItem.category})
              </h3>
              <button type="button" onClick={() => setEditingItem(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Kategori</label>
                <select
                  value={editingItem.category}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      category: e.target.value as SchoolItemCategory,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                >
                  <option value="program">Program Unggulan</option>
                  <option value="facility">Fasilitas Sekolah</option>
                  <option value="extracurricular">Ekstrakurikuler</option>
                  <option value="achievement">Prestasi Sekolah</option>
                  <option value="gallery">Galeri Foto Sekolah</option>
                  <option value="custom_field">Kolom Tambahan Formulir</option>
                  <option value="doc_requirement">Persyaratan Dokumen Unggahan</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Urutan Tampil</label>
                <input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, order: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">Judul / Nama *</label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">Deskripsi Lengkap</label>
                <textarea
                  rows={3}
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, description: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">
                  Foto / Gambar (URL atau Unggah Baru)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingItem.imageUrl}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, imageUrl: e.target.value })
                    }
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl"
                  />
                  <label className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl cursor-pointer flex items-center gap-1 whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    Unggah Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await compressImageFileToDataUrl(file, 900);
                        setEditingItem((prev) =>
                          prev ? { ...prev, imageUrl: dataUrl } : null
                        );
                      }}
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Format File / Tipe Input</label>
                <input
                  type="text"
                  value={editingItem.fieldType}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, fieldType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Batas Ukuran File (KB)</label>
                <input
                  type="number"
                  value={editingItem.maxSizeKb}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, maxSizeKb: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={editingItem.isRequired}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, isRequired: e.target.checked })
                    }
                  />
                  <span>Wajib Diisi / Wajib Diunggah</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={editingItem.isActive}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, isActive: e.target.checked })
                    }
                  />
                  <span>Tampilkan Aktif di Publik</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-emerald-200">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-800 text-white rounded-xl font-bold"
              >
                Simpan Perubahan Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT PENGUMUMAN RESMI */}
      {/* ========================================================================= */}
      {editingAnnouncement && (
        <div className="fixed inset-0 z-50 bg-emerald-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedAnnouncement}
            className="bg-white border-2 border-amber-400 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <h3 className="text-base font-bold text-emerald-950">Edit Pengumuman Resmi</h3>
              <button type="button" onClick={() => setEditingAnnouncement(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Judul Pengumuman *</label>
                <input
                  type="text"
                  value={editingAnnouncement.title}
                  onChange={(e) =>
                    setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Tanggal Publikasi</label>
                  <input
                    type="date"
                    value={editingAnnouncement.publishDate}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        publishDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Periode Tahun Ajaran</label>
                  <input
                    type="text"
                    value={editingAnnouncement.academicYear}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        academicYear: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Isi Pengumuman *</label>
                <textarea
                  rows={4}
                  value={editingAnnouncement.content}
                  onChange={(e) =>
                    setEditingAnnouncement({
                      ...editingAnnouncement,
                      content: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-slate-300 rounded-xl"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={editingAnnouncement.isPublished}
                  onChange={(e) =>
                    setEditingAnnouncement({
                      ...editingAnnouncement,
                      isPublished: e.target.checked,
                    })
                  }
                />
                <span>Publikasikan di Beranda</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-emerald-200">
              <button
                type="button"
                onClick={() => setEditingAnnouncement(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-800 text-white rounded-xl font-bold"
              >
                Simpan Pengumuman
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: EDIT AKUN PENGELOLA */}
      {/* ========================================================================= */}
      {editingAdminUser && (
        <div className="fixed inset-0 z-50 bg-emerald-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedAdminUser}
            className="bg-white border-2 border-amber-400 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <h3 className="text-base font-bold text-emerald-950">
                Edit Akun & Peran Pengelola
              </h3>
              <button type="button" onClick={() => setEditingAdminUser(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={editingAdminUser.fullName}
                  onChange={(e) =>
                    setEditingAdminUser({ ...editingAdminUser, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Email Google</label>
                <input
                  type="email"
                  value={editingAdminUser.email}
                  onChange={(e) =>
                    setEditingAdminUser({ ...editingAdminUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Peran Hak Akses</label>
                <select
                  value={editingAdminUser.role}
                  onChange={(e) =>
                    setEditingAdminUser({
                      ...editingAdminUser,
                      role: e.target.value as AdminRole,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin SPMB">Admin SPMB</option>
                  <option value="Panitia SPMB">Panitia SPMB</option>
                  <option value="Kepala Sekolah">Kepala Sekolah</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={editingAdminUser.isActive}
                  onChange={(e) =>
                    setEditingAdminUser({ ...editingAdminUser, isActive: e.target.checked })
                  }
                />
                <span>Status Akun Aktif</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-emerald-200">
              <button
                type="button"
                onClick={() => setEditingAdminUser(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-800 text-white rounded-xl font-bold"
              >
                Simpan Akun
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal for Switching Active Academic Year */}
      {confirmYearSwitch && (
        <div className="fixed inset-0 z-50 bg-emerald-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-400 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-emerald-950">
              Konfirmasi Pengaktifan Tahun Ajaran Baru
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mengubah Tahun Ajaran Aktif dari{' '}
              <strong className="font-mono">{config.activeYearLabel}</strong> menjadi{' '}
              <strong className="font-mono text-emerald-800">{confirmYearSwitch.yearLabel}</strong>?
            </p>
            <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
              <li>Judul tahun ajaran pada halaman publik akan diperbarui.</li>
              <li>Pendaftaran baru akan terhubung ke {confirmYearSwitch.yearLabel}.</li>
              <li>Seluruh data dan nomor pendaftaran tahun ajaran lama tetap tersimpan utuh.</li>
              <li>Status buka/tutup pendaftaran tetap mengikuti pengaturan manual Anda.</li>
            </ul>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmYearSwitch(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleConfirmActivateAcademicYear(confirmYearSwitch)}
                className="px-4 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl"
              >
                Ya, Aktifkan Tahun Ajaran {confirmYearSwitch.yearLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Data */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-emerald-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-400 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-red-900">Konfirmasi Penghapusan Data</h3>
            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus <strong>{confirmDeleteTarget.label}</strong>? Tindakan
              ini akan dicatat pada log audit keamanan.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmDeleteTarget;
                  setConfirmDeleteTarget(null);
                  try {
                    if (target.type === 'applicant') {
                      await deleteDoc(doc(db, 'applicants', target.id));
                      setSelectedApplicantId(null);
                    } else if (target.type === 'item') {
                      await deleteDoc(doc(db, 'school_items', target.id));
                    } else if (target.type === 'announcement') {
                      await deleteDoc(doc(db, 'announcements', target.id));
                    } else if (target.type === 'year') {
                      await deleteDoc(doc(db, 'academic_years', target.id));
                    } else if (target.type === 'admin') {
                      await deleteDoc(doc(db, 'admins', target.id));
                    } else if (target.type === 'document') {
                      await deleteDoc(doc(db, 'applicant_documents', target.id));
                    }
                    await recordAudit(`Hapus ${target.type}`, target.id, `Menghapus ${target.label}`);
                    showToast('success', `${target.label} berhasil dihapus.`);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.DELETE, target.id);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl"
              >
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
