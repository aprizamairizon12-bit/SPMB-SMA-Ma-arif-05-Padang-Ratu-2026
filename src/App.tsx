import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  AcademicYear,
  Announcement,
  DEFAULT_ACADEMIC_YEARS,
  DEFAULT_ANNOUNCEMENTS,
  DEFAULT_SCHOOL_CONFIG,
  DEFAULT_SCHOOL_ITEMS,
  SchoolConfig,
  SchoolItem,
} from './types';
import { PublicPortal } from './components/PublicPortal';
import { RegistrationFormModal } from './components/RegistrationFormModal';
import { StatusCheckView } from './components/StatusCheckView';
import { AdminDashboard } from './components/AdminDashboard';

type ViewMode = 'public' | 'register' | 'status' | 'admin';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('public');
  const [initialAdminTab, setInitialAdminTab] = useState<string>('overview');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [config, setConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(
    DEFAULT_ACADEMIC_YEARS as AcademicYear[]
  );
  const [items, setItems] = useState<SchoolItem[]>(DEFAULT_SCHOOL_ITEMS as SchoolItem[]);
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    DEFAULT_ANNOUNCEMENTS as Announcement[]
  );

  // Pre-filled parameters when navigating from Registration Confirmation to Status Check
  const [statusPrefill, setStatusPrefill] = useState<{
    regNumber: string;
    birthDate: string;
  }>({ regNumber: '', birthDate: '' });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Listen to public/admin school configuration & items from Firestore
  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'school_config', 'main'),
      (snap) => {
        if (snap.exists()) {
          setConfig(snap.data() as SchoolConfig);
        } else if (
          currentUser &&
          currentUser.email === 'aprizamairizon12@gmail.com' &&
          currentUser.emailVerified
        ) {
          // Automatically seed initial configuration when Super Admin connects to an empty database
          const batch = writeBatch(db);
          batch.set(doc(db, 'school_config', 'main'), {
            ...DEFAULT_SCHOOL_CONFIG,
            updatedAt: serverTimestamp(),
          });
          for (const yr of DEFAULT_ACADEMIC_YEARS) {
            batch.set(doc(db, 'academic_years', yr.id), {
              ...yr,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const item of DEFAULT_SCHOOL_ITEMS) {
            batch.set(doc(db, 'school_items', item.id), {
              ...item,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const ann of DEFAULT_ANNOUNCEMENTS) {
            batch.set(doc(db, 'announcements', ann.id), {
              ...ann,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          batch.commit().catch(() => {});
        }
      },
      () => {}
    );

    const yearsQuery = query(
      collection(db, 'academic_years'),
      where('isPublicDisplay', '==', true)
    );
    const unsubYears = onSnapshot(
      yearsQuery,
      (snap) => {
        if (!snap.empty) {
          const list: AcademicYear[] = [];
          snap.forEach((d) =>
            list.push({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) })
          );
          setAcademicYears(list);
        }
      },
      () => {}
    );

    const itemsQuery = query(
      collection(db, 'school_items'),
      where('isActive', '==', true)
    );
    const unsubItems = onSnapshot(
      itemsQuery,
      (snap) => {
        if (!snap.empty) {
          const list: SchoolItem[] = [];
          snap.forEach((d) => {
            const raw = d.data() as Omit<SchoolItem, 'id'>;
            if (
              d.id === 'doc-req-ijazah' &&
              raw.isRequired === true &&
              raw.description.startsWith('Scan Ijazah SMP/MTs atau SKL sementara dari sekolah asal')
            ) {
              const updatedItem: SchoolItem = {
                id: d.id,
                ...raw,
                isRequired: false,
                description:
                  'Opsional: Scan Ijazah SMP/MTs atau SKL sementara jika sudah tersedia (Format PDF/JPG/PNG, maks 500 KB).',
              };
              list.push(updatedItem);
              if (currentUser && currentUser.emailVerified) {
                const { id: _id, ...toSave } = updatedItem;
                writeBatch(db)
                  .set(doc(db, 'school_items', d.id), {
                    ...toSave,
                    updatedAt: serverTimestamp(),
                  })
                  .commit()
                  .catch(() => {});
              }
            } else {
              list.push({ id: d.id, ...raw });
            }
          });
          setItems(list);
        }
      },
      () => {}
    );

    const annQuery = query(
      collection(db, 'announcements'),
      where('isPublished', '==', true)
    );
    const unsubAnns = onSnapshot(
      annQuery,
      (snap) => {
        if (!snap.empty) {
          const list: Announcement[] = [];
          snap.forEach((d) =>
            list.push({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) })
          );
          setAnnouncements(list);
        }
      },
      () => {}
    );

    return () => {
      unsubConfig();
      unsubYears();
      unsubItems();
      unsubAnns();
    };
  }, [currentUser]);

  if (viewMode === 'admin') {
    return (
      <AdminDashboard
        currentUser={currentUser}
        config={config}
        academicYears={academicYears}
        items={items}
        announcements={announcements}
        initialTab={initialAdminTab}
        onBackToPublic={() => setViewMode('public')}
      />
    );
  }

  if (viewMode === 'register') {
    return (
      <div className="min-h-screen bg-maarif-canvas py-6 px-4">
        <RegistrationFormModal
          config={config}
          items={items}
          onClose={() => setViewMode('public')}
          onSuccessNavigateStatus={(regNumber, birthDate) => {
            setStatusPrefill({ regNumber, birthDate });
            setViewMode('status');
          }}
        />
      </div>
    );
  }

  if (viewMode === 'status') {
    return (
      <div className="min-h-screen bg-maarif-canvas py-6">
        <StatusCheckView
          config={config}
          items={items}
          initialRegNumber={statusPrefill.regNumber}
          initialBirthDate={statusPrefill.birthDate}
          onBackHome={() => {
            setStatusPrefill({ regNumber: '', birthDate: '' });
            setViewMode('public');
          }}
        />
      </div>
    );
  }

  return (
    <PublicPortal
      config={config}
      items={items}
      announcements={announcements}
      isAdminLoggedIn={Boolean(currentUser)}
      onOpenRegistration={() => setViewMode('register')}
      onOpenStatusCheck={() => {
        setStatusPrefill({ regNumber: '', birthDate: '' });
        setViewMode('status');
      }}
      onOpenAdmin={(tab) => {
        setInitialAdminTab(tab || 'overview');
        setViewMode('admin');
      }}
    />
  );
}
