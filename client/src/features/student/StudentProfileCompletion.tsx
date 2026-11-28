import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Lock, Unlock, FileEdit } from 'lucide-react';

const scrollFieldIntoView = (e: React.FocusEvent<HTMLElement>) => {
  window.setTimeout(() => {
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
};

export const StudentProfileCompletion: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { user, setUser } = useAuthStore();
  const toast = useToast();

  const profile = user?.studentProfile;
  const isLocked = !!profile?.isProfileLocked && !profile?.canEditProfile;

  const [personalEmail, setPersonalEmail] = useState(profile?.personalEmail || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [dob, setDob] = useState(profile?.dob ? profile.dob.split('T')[0] : '');
  const [gender, setGender] = useState(profile?.gender || 'Male');
  const [bloodGroup, setBloodGroup] = useState(profile?.bloodGroup || 'O+');
  const [address, setAddress] = useState(profile?.address || '');
  const [guardianName, setGuardianName] = useState(profile?.guardianName || '');
  const [guardianPhone, setGuardianPhone] = useState(profile?.guardianPhone || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || '');

  const [isLoading, setIsLoading] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await api.post('/student/profile', {
        personalEmail,
        phone,
        dob,
        gender,
        bloodGroup,
        address,
        guardianName,
        guardianPhone,
        photoUrl: photoUrl || null,
      });

      toast.success('Profile details saved and securely locked.');

      if (user && res.data.profile) {
        setUser({
          ...user,
          studentProfile: {
            ...user.studentProfile!,
            ...res.data.profile,
            isProfileLocked: true,
            canEditProfile: false,
          },
        });
      }

      if (onComplete) onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save student profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim() || isRequesting) return;

    setIsRequesting(true);
    try {
      await api.post('/student/request-profile-edit', { reason: requestReason });
      toast.success('Edit permission request submitted to administrator.');
      setIsRequestModalOpen(false);
      setRequestReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit edit request');
    } finally {
      setIsRequesting(false);
    }
  };

  const fieldCls = 'text-base min-h-[48px]';
  const selectCls =
    'w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border border-border bg-white text-base outline-none font-medium disabled:bg-slate-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-brand-500';

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24 sm:pb-8">
      {/* Header */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-heading font-extrabold text-content">
                Student Profile Information
              </h2>
              {isLocked ? (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Profile Locked
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 inline-flex items-center gap-1">
                  <Unlock className="w-3.5 h-3.5 text-accent-amber" /> Complete Your Details
                </span>
              )}
            </div>
            <p className="text-xs text-content-secondary mt-1">
              {isLocked
                ? 'Your profile is verified. Contact the admin if any detail needs correction.'
                : 'Fill in all sections below to complete your student record.'}
            </p>
          </div>
          {isLocked && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<FileEdit className="w-4 h-4" />}
              onClick={() => setIsRequestModalOpen(true)}
            >
              Request Edit
            </Button>
          )}
        </div>
      </Card>

      <form id="student-profile-form" onSubmit={handleSaveProfile} className="space-y-4">
        {/* Section 1: Personal */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-content uppercase tracking-wide border-b border-border pb-2">
            1. Personal Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              autoComplete="bday"
              required
              disabled={isLocked}
              className={fieldCls}
              onFocus={scrollFieldIntoView}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1.5">
                Gender
              </label>
              <select
                disabled={isLocked}
                value={gender}
                onFocus={scrollFieldIntoView}
                onChange={(e) => setGender(e.target.value)}
                className={selectCls}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1.5">
                Blood Group
              </label>
              <select
                disabled={isLocked}
                value={bloodGroup}
                onFocus={scrollFieldIntoView}
                onChange={(e) => setBloodGroup(e.target.value)}
                className={selectCls}
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
            <Input
              label="Photo URL (Optional)"
              type="url"
              inputMode="url"
              disabled={isLocked}
              className={fieldCls}
              onFocus={scrollFieldIntoView}
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </Card>

        {/* Section 2: Contact */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-content uppercase tracking-wide border-b border-border pb-2">
            2. Contact Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Personal Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              disabled={isLocked}
              className={fieldCls}
              onFocus={scrollFieldIntoView}
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="yourname@gmail.com"
            />
            <Input
              label="Mobile Phone Number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              disabled={isLocked}
              className={fieldCls}
              onFocus={scrollFieldIntoView}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98401 00000"
            />
          </div>
          <Input
            label="Residential Address"
            autoComplete="street-address"
            required
            disabled={isLocked}
            className={fieldCls}
            onFocus={scrollFieldIntoView}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address, City, District, PIN code"
          />
        </Card>

        {/* Section 3: Guardian */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-content uppercase tracking-wide border-b border-border pb-2">
            3. Parent / Guardian Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Parent / Guardian Name"
              required
              disabled={isLocked}
              className={fieldCls}
              onFocus={scrollFieldIntoView}
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="Father / Mother / Guardian full name"
            />
            <Input
              label="Parent / Guardian Contact Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              disabled={isLocked}
              className={fieldCls}
              onFocus={scrollFieldIntoView}
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="+91 94432 00000"
            />
          </div>
        </Card>

        {/* Sticky Bottom Action Bar above Safe Area */}
        {!isLocked && (
          <div
            className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-border p-3 sm:p-4 rounded-2xl shadow-lg flex items-center justify-end"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <Button
              type="submit"
              size="md"
              isLoading={isLoading}
              loadingLabel="Saving..."
              className="w-full sm:w-auto min-h-[48px] font-bold"
            >
              Save &amp; Lock Profile
            </Button>
          </div>
        )}
      </form>

      {/* Request Edit Permission Modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => !isRequesting && setIsRequestModalOpen(false)}
        title="Request Profile Edit Authorization"
        description="Provide a valid reason for updating your permanent student profile details."
      >
        <form onSubmit={handleRequestEdit} className="space-y-4">
          <Input
            label="Reason for Modification"
            required
            className={fieldCls}
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            placeholder="e.g. Changed address / updated phone number"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isRequesting}
              onClick={() => setIsRequestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isRequesting} loadingLabel="Sending your request...">
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
