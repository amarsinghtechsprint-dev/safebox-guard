import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, XCircle, AlertTriangle } from 'lucide-react';

interface SecurityWarning {
  type: string;
  description: string;
  location?: string;
}

interface SecurityWarningModalProps {
  open: boolean;
  onClose: () => void;
  warnings: SecurityWarning[];
}

const warningTypeLabels: Record<string, string> = {
  SSH_KEY: 'SSH Private Key',
  AWS_CREDENTIALS: 'AWS Credentials',
  API_KEY: 'API Key',
  PASSWORD: 'Plain-text Password',
  DATABASE_CREDENTIALS: 'Database Credentials',
  OAUTH_TOKEN: 'OAuth Token',
  CERTIFICATE: 'Private Certificate',
  OTHER: 'Sensitive Data',
};

export function SecurityWarningModal({ open, onClose, warnings }: SecurityWarningModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-xl">Security Alert</DialogTitle>
              <DialogDescription className="text-destructive">
                Upload blocked due to detected security risks
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Our AI Guard has detected potential sensitive information leaks in your file. 
            For your security, this upload has been blocked.
          </p>

          <div className="space-y-3">
            {warnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20"
              >
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground">
                    {warningTypeLabels[warning.type] || warning.type}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {warning.description}
                  </p>
                  {warning.location && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono bg-secondary/50 px-2 py-1 rounded">
                      Found near: {warning.location.substring(0, 50)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-secondary">
            <h4 className="font-medium text-foreground mb-2">What should I do?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Remove any credentials or secrets from your file</li>
              <li>• Use environment variables for sensitive data</li>
              <li>• Never commit secrets to version control</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="secondary" onClick={onClose}>
            <XCircle className="w-4 h-4 mr-2" />
            Understood
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
