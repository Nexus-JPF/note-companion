import { useEffect, useRef, useState } from 'react';
import { FileContextItem } from '../use-context-items';
import { logger } from '../../../../services/logger';
import { App, TFile } from 'obsidian';
import { VALID_MEDIA_EXTENSIONS } from '../../../../constants';

interface UseCurrentFileProps {
  app: App;
  setCurrentFile: (file: FileContextItem | null) => void;
  chatHasStarted?: boolean; // If true, don't update currentFile when files are opened
}

export function useCurrentFile({
  app,
  setCurrentFile,
  chatHasStarted = false
}: UseCurrentFileProps) {
  const [error, setError] = useState<string | null>(null);
  const currentFile = useRef<FileContextItem | null>(null);
  const chatHasStartedRef = useRef(chatHasStarted);

  // Update ref when prop changes
  useEffect(() => {
    chatHasStartedRef.current = chatHasStarted;
  }, [chatHasStarted]);

  const isMediaFile = (file: TFile): boolean => {
    const extension = file.extension.toLowerCase();
    return VALID_MEDIA_EXTENSIONS.includes(extension);
  };

  const updateActiveFile = async () => {
    // Don't update currentFile if chat has already started
    if (chatHasStartedRef.current) {
      logger.debug('Chat has started, skipping currentFile update');
      return;
    }

    logger.debug('Updating active file');

    try {
      const file = app.workspace.getActiveFile();

      if (!file) {
        logger.debug('No active file');
        setCurrentFile(null);
        currentFile.current = null;
        return;
      }

      // Skip media files
      if (isMediaFile(file)) {
        logger.debug('Skipping media file:', file.path);
        setCurrentFile(null);
        currentFile.current = null;
        return;
      }

      const content = await app.vault.cachedRead(file);

      const fileContextItem: FileContextItem = {
        id: file.path,
        type: 'file',
        path: file.path,
        title: file.basename,
        content,
        reference: 'Current File',
        createdAt: file.stat.ctime
      };

      logger.debug('Setting current file:', fileContextItem);
      setCurrentFile(fileContextItem);
      currentFile.current = fileContextItem;
      setError(null);

    } catch (error) {
      logger.error('Error reading file:', error);
      setError('Failed to load file content');
      setCurrentFile(null);
      currentFile.current = null;
    }
  };

  useEffect(() => {
    // Initial load - only if chat hasn't started
    if (!chatHasStarted) {
      updateActiveFile();
    }

    // Register event handlers
    const eventRefs = [
      app.workspace.on('file-open', updateActiveFile),
      app.workspace.on('active-leaf-change', updateActiveFile)
    ];

    // Cleanup
    return () => {
      eventRefs.forEach(ref => app.workspace.offref(ref));
    };
  }, [app, chatHasStarted]);

  return {
    currentFile,
    error,
    refresh: updateActiveFile
  };
}