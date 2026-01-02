import { useState } from 'react';
import { FileText, Image, Share2, Trash2, Link, Clock, Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  share_token: string | null;
  share_expires_at: string | null;
  created_at: string;
}

interface DocumentListProps {
  documents: Document[];
  onRefresh: () => void;
}

export function DocumentList({ documents, onRefresh }: DocumentListProps) {
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const generateShareLink = async (docId: string) => {
    setGeneratingLink(docId);
    try {
      const shareToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const { error } = await supabase
        .from('documents')
        .update({
          share_token: shareToken,
          share_expires_at: expiresAt.toISOString(),
        })
        .eq('id', docId);

      if (error) throw error;

      const shareUrl = `${window.location.origin}/share/${shareToken}`;
      await navigator.clipboard.writeText(shareUrl);

      toast({
        title: 'Share link created',
        description: 'Link copied to clipboard. Expires in 24 hours.',
      });

      onRefresh();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to generate link',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setGeneratingLink(null);
    }
  };

  const copyShareLink = async (shareToken: string, docId: string) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Link copied',
      description: 'Share link copied to clipboard.',
    });
  };

  const deleteDocument = async (doc: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast({
        title: 'Document deleted',
        description: `${doc.file_name} has been removed.`,
      });

      onRefresh();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No documents yet</h3>
        <p className="text-sm text-muted-foreground">
          Upload your first secure document to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const hasValidShare = doc.share_token && doc.share_expires_at && new Date(doc.share_expires_at) > new Date();
        
        return (
          <div
            key={doc.id}
            className="glass-card rounded-xl p-4 flex items-center gap-4 animate-fade-in"
          >
            {/* File Icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground">
              {getFileIcon(doc.file_type)}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground truncate">{doc.file_name}</h4>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>{formatFileSize(doc.file_size)}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
                {hasValidShare && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Link className="w-3 h-3" />
                      Shared
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {hasValidShare ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyShareLink(doc.share_token!, doc.id)}
                  className="text-primary"
                >
                  {copiedId === doc.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => generateShareLink(doc.id)}
                  disabled={generatingLink === doc.id}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteDocument(doc)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
