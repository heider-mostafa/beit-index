import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { Button } from './ui';
import { Globe, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { NotificationCenter } from './NotificationCenter';

export const Navbar = () => {
  const { t, i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force page reload to clear all state
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
      // Force reload anyway
      window.location.href = '/';
    }
  };

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    const nextLng = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(nextLng);
    document.documentElement.dir = nextLng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = nextLng;
  };

  const navLinks = [
    { to: '/appraisers', label: t('nav.directory') },
    { to: '/methodology', label: t('nav.methodology') },
    { to: '/about', label: t('nav.about') },
    { to: '/contact', label: t('nav.contact') },
  ];

  return (
    <nav className={cn(
      'fixed top-0 inset-x-0 h-16 z-50 bg-cream-100 transition-all duration-300 flex items-center px-5 md:px-8',
      isScrolled ? 'border-b-[0.5px] border-ink-100 shadow-sm' : 'border-b-0'
    )}>
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link to="/" className="group">
            <span className="font-serif font-medium text-xl text-ink-600 tracking-tight">
              {t('common.name')}
            </span>
          </Link>

          {/* Links - Desktop */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => cn(
                  "text-[13px] font-sans transition-colors",
                  isActive ? "text-ink-600 font-medium" : "text-ink-400 hover:text-ink-600"
                )}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-[13px] font-medium">
            <button
              onClick={() => i18n.language !== 'ar' && toggleLanguage()}
              className={cn("transition-colors", i18n.language === 'ar' ? 'text-ink-600' : 'text-ink-300')}
            >
              AR
            </button>
            <button
              onClick={() => i18n.language !== 'en' && toggleLanguage()}
              className={cn("transition-colors", i18n.language === 'en' ? 'text-ink-600' : 'text-ink-300')}
            >
              EN
            </button>
          </div>

          {user ? (
            <>
              <NotificationCenter />
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-ink-600 hover:text-ink-800 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                {t('common.dashboard')}
              </Link>
              <button
                onClick={handleSignOut}
                className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-ink-400 hover:text-ink-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block text-[13px] font-medium text-ink-600 hover:text-ink-800 transition-colors">
                {t('common.login')}
              </Link>

              <Link to="/signup">
                <Button className="hidden sm:inline-flex" withArrow>
                  {t('common.signUp')}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="h-12 border-t border-hairline px-5 md:px-8 flex items-center justify-between text-[11px] text-ink-300 bg-cream-200">
      <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
        <span>{t('common.copyright')}</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-ink-600 transition-colors">Legal</a>
          <a href="#" className="hover:text-ink-600 transition-colors">Privacy</a>
          <a href="#" className="hover:text-ink-600 transition-colors">Accessibility</a>
        </div>
      </div>
    </footer>
  );
};
