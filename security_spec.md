# Security Specification — SPMB Online SMA Ma'arif 05 Padang Ratu

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched in `firestore.rules` must reject all reads and writes.
2. **PII Isolation (Split Collection)**:
   - `/applicants/{applicantId}` contains sensitive PII (NIK, full address, parent phone numbers, email). Read (`get`, `list`) is strictly restricted to verified `isAdminOrStaff()` users.
   - `/applicant_status_lookup/{lookupId}` contains ONLY non-PII status fields (`regNumber`, `fullName`, `nisn`, `birthDate`, `previousSchool`, `status`, `verificationNotes`, `docCompleteCount`, `docTotalRequired`) and allows `get` only when queried by exact `lookupId` (`{regNumber}_{birthDate}`). Public `list` is strictly forbidden.
3. **Private Document Protection**:
   - `/applicant_documents/{docId}` stores uploaded document references/files (`pas-foto`, `kartu-keluarga`, `akta-kelahiran`, `ijazah`). Read (`get`, `list`) is strictly restricted to verified `isAdminOrStaff()`.
4. **Role-Based Access Control (RBAC)**:
   - Only Super Admin (`isSuperAdmin()`) can create, update, or delete `/admins/{adminUid}`, `/school_config/{configId}`, and `/academic_years/{yearId}`.
   - Admin SPMB and Super Admin can manage `/school_items/{itemId}` and `/announcements/{announcementId}`.
   - Admin SPMB, Panitia SPMB, and Super Admin can verify documents and update applicant status.
   - Kepala Sekolah has read-only access to reports, applicants, and audit logs.
5. **Strict Schema & Boundary Validation**:
   - Every create and update operation enforces `hasAll` and `hasOnly` key checks, exact data types, string `.size()` boundaries, and `request.time` temporal integrity.
6. **Atomicity Guarantee**:
   - Creating an `/applicants/{applicantId}` record requires a corresponding `/applicant_status_lookup/{lookupId}` write or strict schema validation with `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on Applicant Creation**: Sending `{"isAdmin": true}` alongside applicant fields.
2. **Email Spoofing Attack**: Using `aprizamairizon12@gmail.com` with `email_verified: false`.
3. **Public Scraping of Applicant PII (`list` on `/applicants`)**: Unauthenticated or non-admin user attempting to list `/applicants`.
4. **Public Scraping of Status Lookup (`list` on `/applicant_status_lookup`)**: Unauthenticated user attempting `list` on `/applicant_status_lookup`.
5. **Unauthorized Read of Private Student Documents**: Non-admin user attempting `get` on `/applicant_documents/{docId}`.
6. **Privilege Escalation in `/admins/{uid}`**: Authenticated non-admin attempting to write their own `/admins/{uid}` record with `"role": "Super Admin"`.
7. **Timestamp Forgery (`createdAt` backdating)**: Creating an applicant with a past client timestamp instead of `request.time`.
8. **Immutable Field Mutation (`regNumber` or `createdAt` change on update)**: Updating `regNumber` or `createdAt` on an existing applicant.
9. **Resource Poisoning (Oversized ID / String)**: Using a 300-character document ID or 10,000-character `fullName`.
10. **Value Poisoning on Update**: Updating `status` to an unlisted enum value `"Lulus Otomatis"`.
11. **Audit Log Tampering (`update` or `delete` on `/audit_logs`)**: Admin attempting to delete or modify an existing audit log entry.
12. **Unauthorized Academic Year Mutation**: Non-admin or Panitia user attempting to change `activeYearLabel` in `/school_config/main`.
