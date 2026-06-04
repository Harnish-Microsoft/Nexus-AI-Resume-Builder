import React from 'react';
import { ApiDiagnostics } from '../components/ApiDiagnostics';

export const ProfilePage = () => {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile & Settings</h1>
      <ApiDiagnostics />
    </div>
  );
};
