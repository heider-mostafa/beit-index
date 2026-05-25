import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/src/components/ui';
import { Chrome, Eye, EyeOff, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import type { UserRole } from '@/src/lib/supabase/types';

// Password strength indicator
function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const width = Math.min((strength / 6) * 100, 100);
  const color = strength < 2 ? 'bg-red-500' : strength < 4 ? 'bg-yellow-500' : 'bg-emerald-500';

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="h-1 bg-ink-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-[11px] text-ink-300 mt-1">
        {strength < 2 ? 'Weak' : strength < 4 ? 'Medium' : 'Strong'}
      </p>
    </div>
  );
}

export const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, profile, loading: authLoading } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  const [resetSent, setResetSent] = React.useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (!authLoading && profile) {
      redirectBasedOnRole(profile.role);
    }
  }, [authLoading, profile]);

  const redirectBasedOnRole = async (role: UserRole) => {
    if (role === 'admin') {
      navigate('/admin/verifications');
    } else if (role === 'appraiser') {
      // Check onboarding status
      const token = (await (await import('@/src/lib/supabase/browser')).getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
      if (token) {
        const res = await fetch('/api/onboarding/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const status = await res.json();
          if (!status.hasProfile && status.hasDraft) {
            navigate('/onboarding');
          } else if (status.hasProfile && status.profileStatus === 'pending') {
            navigate('/onboarding/under-review');
          } else if (status.hasProfile && status.profileStatus === 'verified') {
            navigate('/dashboard');
          } else {
            navigate('/onboarding');
          }
        }
      }
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await signIn(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // Redirect handled by useEffect
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: authError } = await signInWithGoogle();
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { resetPassword } = await import('@/src/contexts/AuthContext').then(m => {
      // We need to use the hook value instead
      return { resetPassword: async () => ({ error: null }) };
    });

    try {
      const supabase = (await import('@/src/lib/supabase/browser')).getSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setResetSent(true);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to send reset email');
    }
    setLoading(false);
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-5 flex flex-col items-center justify-center">
        <div className="w-full max-w-[380px]">
          <h1 className="text-h2 text-ink-600 mb-4 text-center">Reset password</h1>
          <p className="text-body-s text-ink-400 text-center mb-12">
            Enter your email and we'll send you a reset link.
          </p>

          {resetSent ? (
            <div className="p-4 bg-emerald-50 border-[0.5px] border-emerald-100 rounded-sm text-[13px] text-emerald-800 text-center">
              <Check className="h-5 w-5 inline-block mb-1" />
              <p className="font-medium">Check your email</p>
              <p className="text-emerald-700 mt-1">We've sent a password reset link to {resetEmail}</p>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-8">
              <Input
                label="Email address"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '...' : 'Send reset link'}
              </Button>
            </form>
          )}

          <div className="text-center mt-8">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
                setError(null);
              }}
              className="text-body-s text-ink-400 hover:text-ink-600 transition-colors"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-5 flex flex-col items-center justify-center">
      <div className="w-full max-w-[380px]">
        <h1 className="text-h2 text-ink-600 mb-12 text-center">{t('auth.login.title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-8 mb-12">
          <Input
            label={t('auth.login.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />

          <div className="relative">
            <Input
              label={t('auth.login.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 bottom-2.5 text-ink-300 hover:text-ink-500"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-body-s text-ink-300 hover:text-ink-500"
            >
              {t('auth.login.forgot')}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '...' : t('auth.login.title')}
          </Button>
        </form>

        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute inset-x-0 h-[0.5px] bg-ink-100"></div>
          <span className="relative z-10 bg-cream-100 px-4 text-[11px] uppercase tracking-widest text-ink-200">
            {t('auth.login.or')}
          </span>
        </div>

        <Button
          variant="secondary"
          className="w-full mb-12 flex items-center justify-center gap-3"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <Chrome className="h-4 w-4" />
          {t('auth.login.google')}
        </Button>

        <div className="text-center">
          <Link to="/signup" className="text-body-s text-ink-400 hover:text-ink-600 transition-colors">
            {t('auth.login.footer')} &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};

export const SignupPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithGoogle, profile, loading: authLoading } = useAuth();

  const inviteToken = searchParams.get('invite');

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [role, setRole] = React.useState<'owner' | 'appraiser' | 'bank'>('appraiser');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isInvite, setIsInvite] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [showComingSoon, setShowComingSoon] = React.useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = React.useState(false);

  // Check invite token
  React.useEffect(() => {
    if (inviteToken) {
      fetch(`/api/auth/validate-invite/${inviteToken}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setIsInvite(true);
            setInviteEmail(data.email);
            setEmail(data.email);
          } else {
            setError('This invite link is invalid or has expired.');
          }
        })
        .catch(() => {
          setError('Failed to validate invite link.');
        });
    }
  }, [inviteToken]);

  // Redirect if already logged in
  React.useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role === 'appraiser') {
        navigate('/onboarding');
      } else if (profile.role === 'admin') {
        navigate('/admin/verifications');
      } else {
        navigate('/');
      }
    }
  }, [authLoading, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For non-appraiser roles, show coming soon message
    if (!isInvite && role !== 'appraiser') {
      setShowComingSoon(true);
      return;
    }

    setLoading(true);
    setError(null);

    const userRole = isInvite ? 'admin' : role;

    const result = await signUp(email, password, name, userRole as UserRole);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    // Create profile via API (handles invite tokens and onboarding draft)
    if (result.user) {
      try {
        const profileRes = await fetch('/api/auth/create-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authId: result.user.id,
            email,
            fullName: name,
            role: userRole,
            inviteToken,
          }),
        });

        if (!profileRes.ok) {
          const data = await profileRes.json();
          throw new Error(data.error || 'Failed to create profile');
        }
      } catch (err) {
        console.error('Profile creation error:', err);
        setError('Account created but profile setup failed. Please contact support.');
        setLoading(false);
        return;
      }
    }

    // Show email confirmation message
    setShowEmailConfirmation(true);
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: authError } = await signInWithGoogle();
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  };

  if (showEmailConfirmation) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-5 flex flex-col items-center justify-center">
        <div className="w-full max-w-[420px] text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-h2 text-ink-600 mb-4">{t('auth.emailConfirmation.title')}</h1>
          <p className="text-body-m text-ink-400 mb-4">
            {t('auth.emailConfirmation.message', { email })}
          </p>
          <p className="text-body-s text-ink-300 mb-8">
            {t('auth.emailConfirmation.spam')}
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/login">
              <Button variant="primary" className="w-full">
                {t('common.login')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (showComingSoon) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-5 flex flex-col items-center justify-center">
        <div className="w-full max-w-[400px] text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-h2 text-ink-600 mb-4">Thanks for your interest!</h1>
          <p className="text-body-m text-ink-400 mb-8">
            The {role === 'owner' ? 'property owner' : 'bank'} portal is coming soon.
            We'll notify you at <strong>{email}</strong> when it launches.
          </p>
          <Button onClick={() => setShowComingSoon(false)} variant="secondary">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-5 flex flex-col items-center justify-center">
      <div className="w-full max-w-[380px]">
        <h1 className="text-h2 text-ink-600 mb-12 text-center">
          {isInvite ? 'Accept admin invite' : t('auth.signup.title')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8 mb-12">
          <Input
            label={t('auth.signup.name')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ahmed Mansour"
            required
          />

          <Input
            label={t('auth.login.email')}
            type="email"
            value={email}
            onChange={(e) => !isInvite && setEmail(e.target.value)}
            placeholder="ahmed@example.com"
            required
            disabled={isInvite}
            className={isInvite ? 'text-ink-300' : ''}
          />

          <div className="relative">
            <Input
              label={t('auth.login.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 bottom-2.5 text-ink-300 hover:text-ink-500"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <PasswordStrength password={password} />
          </div>

          {!isInvite && (
            <div className="space-y-4">
              <label className="eyebrow text-ink-300">{t('auth.signup.role')}</label>
              <div className="space-y-3">
                {(['appraiser', 'owner', 'bank'] as const).map((r) => (
                  <label key={r} className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="role"
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="peer w-4 h-4 appearance-none border border-ink-200 rounded-full checked:border-emerald-500 checked:bg-emerald-50 transition-all"
                      />
                      <div className="absolute w-2 h-2 bg-emerald-500 rounded-full scale-0 peer-checked:scale-100 transition-transform"></div>
                    </div>
                    <span className="text-body-s text-ink-400 group-hover:text-ink-600 transition-colors">
                      {t(`auth.signup.roles.${r}`)}
                      {r !== 'appraiser' && (
                        <span className="text-ink-200 ml-2">(Coming soon)</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {isInvite && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-sm text-[13px] text-emerald-800">
              You've been invited to join as an admin.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-sm text-[13px] text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '...' : t('common.signup')}
          </Button>
        </form>

        {!isInvite && (
          <>
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute inset-x-0 h-[0.5px] bg-ink-100"></div>
              <span className="relative z-10 bg-cream-100 px-4 text-[11px] uppercase tracking-widest text-ink-200">
                {t('auth.login.or')}
              </span>
            </div>

            <Button
              variant="secondary"
              className="w-full mb-12 flex items-center justify-center gap-3"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <Chrome className="h-4 w-4" />
              {t('auth.login.google')}
            </Button>
          </>
        )}

        <div className="text-center">
          <Link to="/login" className="text-body-s text-ink-400 hover:text-ink-600 transition-colors">
            {t('auth.signup.footer')} &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};
