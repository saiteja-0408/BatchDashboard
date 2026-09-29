/**
 * UploadButton.jsx — file picker for replacing the Excel data at runtime.
 */

import React, { useRef, useState } from 'react';
import {
  Button, CircularProgress, Snackbar, Alert, Tooltip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadExcelFile } from '../../services/apiService';

export function UploadButton() {
  const inputRef     = useRef(null);
  const queryClient  = useQueryClient();
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const mutation = useMutation({
    mutationFn: uploadExcelFile,
    onSuccess: (result) => {
      // Invalidate all batch queries so the new data is refetched
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setSnack({ open: true, message: `Loaded ${result.count} batch(es) from file.`, severity: 'success' });
    },
    onError: (err) => {
      setSnack({ open: true, message: err.message || 'Upload failed.', severity: 'error' });
    },
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Tooltip title="Upload an Excel file to replace batch data">
        <Button
          variant="outlined"
          size="small"
          startIcon={mutation.isPending ? <CircularProgress size={14} /> : <UploadFileIcon />}
          disabled={mutation.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Upload Excel
        </Button>
      </Tooltip>
      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  );
}
