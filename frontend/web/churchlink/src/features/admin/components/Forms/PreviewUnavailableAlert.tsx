import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import React from 'react';

type Props = {
  children?: React.ReactNode;
  title?: string;
  message?: string;
};

export function PreviewUnavailableAlert({ children, title, message }: Props) {
  return (
    <Alert variant="warning">
      <AlertTitle>{title ?? 'Preview unavailable'}</AlertTitle>
      <AlertDescription>
        <p className="mb-1">{message ?? 'Resolve the min/max conflicts below to restore the live preview:'}</p>
        <ul className="list-disc pl-5 space-y-1">
          {children}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export default PreviewUnavailableAlert;
