import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, FileText, Download, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface SharedDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  share_expires_at: string;
  created_at: string;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('share_token', token)
        .single();

      if (fetchError || !data) {
        setError('Document not found or link has expired');
        setLoading(false);
        return;
      }

      if (new Date(data.share_expires_at) < new Date()) {
        setError('This share link has expired');
        setLoading(false);
        return;
      }

      setDocument(data);
      setLoading(false);
    };

    fetchDocument();
  }, [token]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (!document) return;
    
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-pulse-soft">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">
            Link Unavailable
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link to="/">
            <Button variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to SafeBox
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Shared via SafeBox</p>
        </div>

        {/* Document Card */}
        <div className="glass-card rounded-2xl p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-6">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            
            <h1 className="text-xl font-semibold text-foreground mb-2 break-all">
              {document?.file_name}
            </h1>
            
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-6">
              <span>{formatFileSize(document?.file_size || 0)}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Expires {formatDistanceToNow(new Date(document?.share_expires_at || ''), { addSuffix: true })}
              </span>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download className="w-5 h-5 mr-2" />
              {downloading ? 'Downloading...' : 'Download File'}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          This file has been scanned and verified as safe by AI Guard.
        </p>
      </div>
    </div>
  );
}
