import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/src/components/ui';
import { useAuth } from '@/src/contexts/AuthContext';
import { Clock, Check, FileSearch, Mail } from 'lucide-react';

export function UnderReviewPage() {
  const { profile, user } = useAuth();

  return (
    <div className="min-h-screen bg-cream-100 pt-24 pb-16">
      <div className="max-w-xl mx-auto px-5">
        <div className="bg-cream-50 rounded-lg p-8 border-hairline text-center">
          {/* Status icon */}
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <FileSearch className="h-10 w-10 text-emerald-600" />
          </div>

          <h1 className="text-h2 text-ink-600 mb-4">Your application is under review.</h1>

          <p className="text-body-m text-ink-400 mb-8">
            Our team is verifying your FRA license and credentials. You'll receive an email at{' '}
            <strong className="text-ink-600">{user?.email}</strong> when your profile is approved.
            This typically takes 1-2 business days.
          </p>

          {/* Status timeline */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <TimelineStep
              icon={<Check className="h-4 w-4" />}
              label="Submitted"
              active={false}
              completed={true}
            />
            <div className="w-12 h-0.5 bg-emerald-500" />
            <TimelineStep
              icon={<Clock className="h-4 w-4" />}
              label="Under review"
              active={true}
              completed={false}
            />
            <div className="w-12 h-0.5 bg-ink-200" />
            <TimelineStep
              icon={<Check className="h-4 w-4" />}
              label="Verified"
              active={false}
              completed={false}
            />
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <Link to="/onboarding">
              <Button variant="secondary" className="w-full">
                Update your information
              </Button>
            </Link>
          </div>

          {/* Contact */}
          <div className="mt-10 pt-6 border-t border-ink-100">
            <p className="text-body-s text-ink-400 flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" />
              Questions? Email{' '}
              <a
                href="mailto:verification@beitindex.com"
                className="text-emerald-600 hover:underline"
              >
                verification@beitindex.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineStep({
  icon,
  label,
  active,
  completed,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          completed
            ? 'bg-emerald-500 text-white'
            : active
            ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500'
            : 'bg-ink-100 text-ink-300'
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-[11px] font-medium ${
          completed || active ? 'text-ink-600' : 'text-ink-300'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default UnderReviewPage;
