import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface NewReleaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  releaseInfo: {
    version: string;
    releaseNotes: string;
    publishedAt: string;
    htmlUrl: string;
    isNewVersionAvailable: boolean;
  } | null;
  onDismissForVersion: (version: string) => void;
}

const NewReleaseDialog: React.FC<NewReleaseDialogProps> = ({
  isOpen,
  onClose,
  releaseInfo,
  onDismissForVersion,
}) => {
  if (!releaseInfo || !releaseInfo.isNewVersionAvailable) {
    return null;
  }

  const handleDismiss = () => {
    if (releaseInfo) {
      onDismissForVersion(releaseInfo.version);
    }
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>New Version Available: {releaseInfo.version}</AlertDialogTitle>
          <AlertDialogDescription>
            <p>A new version of SparkyFitness is available!</p>
            <p>Published: {new Date(releaseInfo.publishedAt).toLocaleDateString()}</p>
            <div className="mt-4 p-2 border rounded max-h-60 overflow-y-auto">
              <h3 className="font-semibold mb-2">Release Notes:</h3>
              <p className="whitespace-pre-wrap">{releaseInfo.releaseNotes}</p>
            </div>
            <p className="mt-4">
              View on GitHub:{' '}
              <a href={releaseInfo.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                {releaseInfo.htmlUrl}
              </a>
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss}>Don't show again for this version</AlertDialogCancel>
          <AlertDialogAction onClick={onClose}>Close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default NewReleaseDialog;