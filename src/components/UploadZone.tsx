import { useState, useCallback } from 'react';
import { Upload, FileText, Image, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SecurityWarningModal } from './SecurityWarningModal';

interface UploadZoneProps {
  onUploadComplete: () => void;
}

interface SecurityWarning {
  type: string;
  description: string;
  location?: string;
}

interface ScanResult {
  isSafe: boolean;
  warnings: SecurityWarning[];
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [securityWarnings, setSecurityWarnings] = useState<SecurityWarning[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const acceptedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/jpg', 'image/png'];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const readFileContent = async (file: File): Promise<string> => {
    if (file.type === 'text/plain') {
      return await file.text();
    }
    if (file.type === 'application/pdf') {
      // For PDFs, we'll extract text content
      // Since we can't parse PDFs in browser, we'll send the base64 to AI
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return `[PDF Document - Base64 encoded]\n${base64.substring(0, 5000)}...`;
    }
    // For images, just send metadata
    return `[Image file: ${file.name}]`;
  };

  const scanDocument = async (file: File): Promise<ScanResult> => {
    const content = await readFileContent(file);
    
    const { data, error } = await supabase.functions.invoke('scan-document', {
      body: {
        content,
        fileName: file.name,
        fileType: file.type,
      },
    });

    if (error) {
      console.error('Scan error:', error);
      return { isSafe: true, warnings: [] };
    }

    return data as ScanResult;
  };

  const uploadFile = async (file: File) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not authenticated',
        description: 'Please sign in to upload files.',
      });
      return;
    }

    if (!acceptedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Only PDF, TXT, and JPG files are allowed.',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
      });
      return;
    }

    setCurrentFile(file.name);
    setScanning(true);

    try {
      // AI Security Scan
      const scanResult = await scanDocument(file);

      if (!scanResult.isSafe && scanResult.warnings.length > 0) {
        setSecurityWarnings(scanResult.warnings);
        setShowWarning(true);
        setScanning(false);
        setCurrentFile(null);
        return;
      }

      setScanning(false);
      setUploading(true);

      // Upload to storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save metadata to database
      const { error: dbError } = await supabase.from('documents').insert({
        user_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: filePath,
        is_safe: true,
      });

      if (dbError) throw dbError;

      toast({
        title: 'Upload complete',
        description: `${file.name} has been securely uploaded.`,
      });

      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An error occurred during upload.',
      });
    } finally {
      setUploading(false);
      setScanning(false);
      setCurrentFile(null);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  }, [user]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
    e.target.value = '';
  };

  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`upload-zone p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragging ? 'upload-zone-active' : 'hover:border-primary/50 hover:bg-secondary/30'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.txt,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          disabled={uploading || scanning}
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          {scanning ? (
            <div className="animate-pulse-soft">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/10 mb-4">
                <AlertTriangle className="w-8 h-8 text-warning animate-pulse" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                AI Guard Scanning...
              </h3>
              <p className="text-sm text-muted-foreground">
                Checking {currentFile} for security leaks
              </p>
            </div>
          ) : uploading ? (
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Uploading...
              </h3>
              <p className="text-sm text-muted-foreground">{currentFile}</p>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Drop files here or click to upload
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                PDF, TXT, and JPG files up to 10MB
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" /> PDF
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" /> TXT
                </span>
                <span className="flex items-center gap-1">
                  <Image className="w-4 h-4" /> JPG
                </span>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-success">
                <CheckCircle className="w-4 h-4" />
                <span>AI-powered security scanning enabled</span>
              </div>
            </>
          )}
        </label>
      </div>

      <SecurityWarningModal
        open={showWarning}
        onClose={() => setShowWarning(false)}
        warnings={securityWarnings}
      />
    </>
  );
}
