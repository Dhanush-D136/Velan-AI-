import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Camera,
  ShieldCheck,
  FileEdit,
  User,
} from 'lucide-react';

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
    if (!requestReason.trim()) return;

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

  return (
    <Card className="p-6 sm:p-8 max-w-3xl mx-auto shadow-glass relative">
      <div className="flex items-start justify-between border-b border-border pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-heading font-extrabold text-content">
              Student Profile Information
            </h2>
            {isLocked ? (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> Profile Locked
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1">
                <Unlock className="w-3.5 h-3.5 text-accent-amber" /> Incomplete / Editable
              </span>
            )}
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Official institutional record for <strong className="text-content">{user?.name}</strong> (Register: {profile?.registerNo})
          </p>
        </div>

        {isLocked && (
          <Button
            size="sm"
            variant="soft"
            onClick={() => setIsRequestModalOpen(true)}
            leftIcon={<FileEdit className="w-3.5 h-3.5" />}
          >
            Request Edit Permission
          </Button>
        )}
      </div>

      {isLocked && (
        <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-accent-emerald shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Permanent Academic Record Locked:</span> Your submitted personal and guardian details have been committed. To modify any field, click "Request Edit Permission" to receive a single-edit unlock from your administrator.
          </div>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Personal Gmail / Email"
            type="email"
            required
            disabled={isLocked}
            value={personalEmail}
            onChange={(e) => setPersonalEmail(e.target.value)}
            placeholder="yourname@gmail.com"
          />
          <Input
            label="Mobile Phone Number"
            type="tel"
            required
            disabled={isLocked}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98401 00000"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Date of Birth"
            type="date"
            required
            disabled={isLocked}
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
              onChange={(e) => setGender(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
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
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
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
        </div>

        <Input
          label="Residential Address"
          required
          disabled={isLocked}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address, City, District, PIN code"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Parent / Guardian Name"
            required
            disabled={isLocked}
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            placeholder="Father / Mother / Guardian full name"
          />
          <Input
            label="Parent / Guardian Contact Phone"
            required
            type="tel"
            disabled={isLocked}
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            placeholder="+91 94432 00000"
          />
        </div>

        <Input
          label="Photo URL (Optional)"
          disabled={isLocked}
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://..."
        />

        {!isLocked && (
          <div className="pt-4 border-t border-border flex items-center justify-end">
            <Button type="submit" size="md" isLoading={isLoading} className="font-bold">
              Save & Lock Profile
            </Button>
          </div>
        )}
      </form>

      {/* Request Edit Permission Modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Request Profile Edit Authorization"
        description="Provide a valid reason for updating your permanent student profile details."
      >
        <form onSubmit={handleRequestEdit} className="space-y-4">
          <Input
            label="Reason for Modification"
            required
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            placeholder="e.g. Changed address / updated phone number"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsRequestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isRequesting}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
};
