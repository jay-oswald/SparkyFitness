import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import axios from 'axios';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  const [appVersion, setAppVersion] = useState('Loading...');

  useEffect(() => {
    if (isOpen) {
      const fetchVersion = async () => {
        try {
          const response = await axios.get('/api/version/current');
          setAppVersion(response.data.version);
        } catch (error) {
          console.error('Error fetching app version:', error);
          setAppVersion('Error');
        }
      };
      fetchVersion();
    }
  }, [isOpen]);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>About SparkyFitness</AlertDialogTitle>
          <AlertDialogDescription>
            <p>Application Version: <strong>{appVersion}</strong></p>
            <p>
              For more information, visit the{' '}
              <a href="https://github.com/CodeWithCJ/SparkyFitness" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                GitHub repository
              </a>.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AboutDialog;