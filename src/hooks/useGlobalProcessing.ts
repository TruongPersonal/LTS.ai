import { useContext } from 'react';
import { ProcessingContext } from '../context/processing-context';

export const useGlobalProcessing = () => {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useGlobalProcessing must be used within a ProcessingProvider');
  }
  return context;
};
