import { useEffect, useState } from 'react';
import { Shield, LogOut, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UploadZone } from './UploadZone';
import { DocumentList } from './DocumentList';

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

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">SafeBox</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground mb-3">
            Secure Upload Zone
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Upload your documents safely. Our AI Guard scans every file for 
            potential security leaks before storing.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <UploadZone onUploadComplete={fetchDocuments} />
        </div>

        {/* Documents Section */}
        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">Your Documents</h2>
            <span className="text-sm text-muted-foreground">
              ({documents.length})
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary animate-pulse-soft">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <DocumentList documents={documents} onRefresh={fetchDocuments} />
          )}
        </div>
      </main>
    </div>
  );
}
