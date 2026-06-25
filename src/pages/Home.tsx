import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useInView } from 'motion/react';
import {
  Building2,
  ShieldCheck,
  Database,
  MapPin,
  ClipboardCheck,
  Clock,
  Target,
  FileCheck,
  Users,
  TrendingUp,
  Search,
  UserCheck,
  FileText,
  BadgeCheck
} from 'lucide-react';
import { Button, Card, Badge } from '@/src/components/ui';
import { CairoWebGLMap } from '@/src/components/CairoWebGLMap';
import { LiveTicker } from '@/src/components/LiveTicker';
import { StatCard } from '@/src/components/AnimatedCounter';
import { Link } from 'react-router-dom';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
}

const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, delay = 0 }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px 0px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const HomePage = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <div className="pt-16 overflow-hidden">
      {/* LIVE TICKER */}
      <LiveTicker />

      {/* 1. HERO SECTION */}
      <section className="min-h-[85vh] flex items-center px-5 md:px-8 py-16 md:py-24 border-b border-ink-100">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
          <ScrollReveal>
            <div className="max-w-xl">
              {/* Beit Index brand mark */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="eyebrow !text-emerald-600">
                  {t('hero.eyebrow')}
                </span>
              </div>

              <h1 className="text-h1 text-ink-600 mb-6">
                {t('hero.headline')}
              </h1>
              <p className="text-[17px] text-ink-300 mb-8 max-w-lg leading-[1.55]">
                {t('common.subtagline')}
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                <Link to="/signup">
                  <Button variant="emerald" className="px-6 py-2.5 text-sm">{t('common.requestAppraisal')}</Button>
                </Link>
                <Link to="/appraisers">
                  <Button variant="secondary" className="px-6 py-2.5 text-sm">{t('common.browseAppraisers')}</Button>
                </Link>
              </div>

              {/* Index-style stats with lines */}
              <div className="relative">
                <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-ink-100 via-emerald-200 to-ink-100" />
                <div className="flex pt-6 gap-12">
                  <div className="flex flex-col">
                    <span className="eyebrow !text-[9px] mb-1 text-emerald-600">Licensing</span>
                    <span className="serif text-lg">FRA Accredited</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="eyebrow !text-[9px] mb-1 text-emerald-600">Indexed</span>
                    <span className="serif text-lg">850k+ Valuations</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="eyebrow !text-[9px] mb-1 text-emerald-600">Coverage</span>
                    <span className="serif text-lg">24 Cairo Zones</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <CairoWebGLMap />
          </ScrollReveal>
        </div>
      </section>

      {/* 2. AUTHORITY STRIP - Logo Cloud */}
      <section className="py-12 border-b border-ink-100 bg-cream-50">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <p className="text-center text-[11px] uppercase tracking-[0.2em] text-ink-300 mb-8">
            {t('authority.referencedBy', 'Trusted by Egypt\'s Leading Institutions')}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {[
              { name: 'FRA', fullName: 'Financial Regulatory Authority', badge: 'Official' },
              { name: 'CBE', fullName: 'Central Bank of Egypt', badge: 'Approved' },
              { name: 'EAREA', fullName: 'Egyptian Appraisers Association', badge: 'Partner' },
              { name: 'Bank Misr', fullName: 'Bank Misr', badge: 'Verified' },
            ].map((org) => (
              <div key={org.name} className="flex flex-col items-center gap-2 group">
                <div className="h-12 w-24 bg-ink-100/50 rounded flex items-center justify-center text-ink-400 font-serif text-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  {org.name}
                </div>
                <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {org.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. NUMBERS THAT MATTER */}
      <section className="py-20 px-5 md:px-8 bg-white border-b border-ink-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <StatCard value={850} suffix="K+" label="Valuations" sublabel="Indexed" delay={0} />
            <StatCard value={24} suffix="" label="Cairo Zones" sublabel="Full Coverage" delay={0.1} />
            <StatCard value={99} suffix="%" label="Accuracy" sublabel="Engine Verified" delay={0.2} />
            <StatCard value={48} suffix="h" label="Average" sublabel="Delivery Time" delay={0.3} />
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-24 px-5 md:px-8 bg-cream-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="eyebrow text-emerald-600 mb-4 block">Simple Process</span>
            <h2 className="text-h2 text-ink-600">How Beit Index Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: MapPin, step: '01', title: 'Select Location', desc: 'Choose your property zone from our 24 covered Cairo areas' },
              { icon: Search, step: '02', title: 'Match Expert', desc: 'Get matched with FRA-licensed appraisers specialized in your zone' },
              { icon: FileText, step: '03', title: 'Receive Report', desc: 'Get a bank-ready valuation report within 48 hours' },
              { icon: BadgeCheck, step: '04', title: 'Engine Verified', desc: 'Every report is cross-checked against our 850k valuation database' },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                {/* Connector line */}
                {index < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] right-0 h-px bg-gradient-to-r from-emerald-300 to-transparent" />
                )}

                <div className="bg-white rounded-lg p-6 border border-ink-100 hover:border-emerald-200 hover:shadow-lg transition-all group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <item.icon className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-[32px] font-serif text-ink-100 group-hover:text-emerald-200 transition-colors">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="font-medium text-ink-600 mb-2">{item.title}</h3>
                  <p className="text-sm text-ink-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. AUDIENCE SECTIONS */}
      <section className="divide-y divide-ink-100">
        {/* FOR BANKS */}
        <div className="py-24 px-5 md:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
            <div className="max-w-xl">
              <span className="text-eyebrow text-ink-300 mb-6 block">
                {t('sections.banks.eyebrow')}
              </span>
              <h2 className="text-h2 text-ink-600 mb-8">
                {t('sections.banks.title')}
              </h2>
              <div className="space-y-6 mb-10">
                <div className="flex gap-4">
                  <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                  <p className="text-body-m text-ink-400">{t('sections.banks.f1')}</p>
                </div>
                <div className="flex gap-4">
                  <ClipboardCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                  <p className="text-body-m text-ink-400">{t('sections.banks.f2')}</p>
                </div>
                <div className="flex gap-4">
                  <Database className="h-5 w-5 text-emerald-500 shrink-0" />
                  <p className="text-body-m text-ink-400">{t('sections.banks.f3')}</p>
                </div>
              </div>
              <Button variant="secondary" withArrow>{t('sections.banks.cta')}</Button>
            </div>

            <CairoWebGLMap />
          </div>
        </div>

        {/* FOR APPRAISERS */}
        <div className="py-24 px-5 md:px-8 bg-cream-100">
          <div className="max-w-7xl mx-auto flex justify-center">
            <div className="max-w-3xl text-center">
              <span className="text-eyebrow text-ink-300 mb-6 block">
                {t('sections.appraisers.eyebrow')}
              </span>
              <h2 className="text-h2 text-ink-600 mb-8">
                {t('sections.appraisers.title')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                 <div className="p-6 border-[0.5px] border-ink-100 rounded-md bg-white text-start hover:shadow-lg hover:border-emerald-200 transition-all">
                   <TrendingUp className="w-8 h-8 text-emerald-500 mb-4" />
                   <p className="text-body-m text-ink-400">{t('sections.appraisers.f1')}</p>
                 </div>
                 <div className="p-6 border-[0.5px] border-ink-100 rounded-md bg-white text-start hover:shadow-lg hover:border-emerald-200 transition-all">
                   <Users className="w-8 h-8 text-emerald-500 mb-4" />
                   <p className="text-body-m text-ink-400">{t('sections.appraisers.f2')}</p>
                 </div>
                 <div className="p-6 border-[0.5px] border-ink-100 rounded-md bg-white text-start hover:shadow-lg hover:border-emerald-200 transition-all">
                   <Target className="w-8 h-8 text-emerald-500 mb-4" />
                   <p className="text-body-m text-ink-400">{t('sections.appraisers.f3')}</p>
                 </div>
              </div>
              <Button variant="emerald" withArrow>{t('sections.appraisers.cta')}</Button>
            </div>
          </div>
        </div>

        {/* FOR OWNERS */}
        <div className="py-24 px-5 md:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
             <div className="grid grid-cols-2 gap-4">
                <div className="aspect-[4/5] bg-ink-200 rounded-sm overflow-hidden grayscale hover:grayscale-0 transition-all duration-500">
                  <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=400" alt="Apartment" className="w-full h-full object-cover" />
                </div>
                <div className="aspect-[4/5] bg-ink-200 rounded-sm overflow-hidden pt-12 grayscale hover:grayscale-0 transition-all duration-500">
                  <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400" alt="Villa" className="w-full h-full object-cover" />
                </div>
             </div>

             <div className="max-w-xl">
               <span className="text-eyebrow text-ink-300 mb-6 block">
                 {t('sections.owners.eyebrow')}
               </span>
               <h2 className="text-h2 text-ink-600 mb-8">
                 {t('sections.owners.title')}
               </h2>
               <ul className="space-y-4 mb-10">
                 {[t('sections.owners.f1'), t('sections.owners.f2'), t('sections.owners.f3')].map((f) => (
                   <li key={f} className="flex gap-3">
                     <CheckIcon className="h-5 w-5 text-emerald-500" />
                     <span className="text-body-m text-ink-400">{f}</span>
                   </li>
                 ))}
               </ul>
               <Link to="/appraisers">
                 <Button withArrow>{t('sections.owners.cta')}</Button>
               </Link>
             </div>
          </div>
        </div>
      </section>

      {/* 7. TESTIMONIAL */}
      <section className="py-24 px-5 md:px-8 bg-cream-50 border-y border-ink-100">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
                <Building2 className="w-8 h-8 text-emerald-600" />
              </div>
              <blockquote className="text-2xl md:text-3xl font-serif text-ink-600 leading-relaxed mb-8">
                "Beit Index reduced our valuation turnaround from 2 weeks to 48 hours while improving accuracy. It's transformed our mortgage processing."
              </blockquote>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 bg-ink-200 rounded-full" />
                <div className="text-left">
                  <div className="font-medium text-ink-600">Ahmed Hassan</div>
                  <div className="text-sm text-ink-400">Head of Mortgage, Leading Egyptian Bank</div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 9. METHODOLOGY SNIPPET */}
      <section className="py-24 px-5 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
          <div>
            <span className="eyebrow text-emerald-600 mb-4 block">Our Methodology</span>
            <h2 className="text-h2 mb-8">{t('methodology.title')}</h2>
            <div className="space-y-6 text-body-m text-ink-400">
              <p>Beit Index ensures that every valuation produced on our platform follows a strict, bank-approved reconciliation process.</p>
              <p>We combine massive data indexing with localized human intelligence. This means our appraisers have access to the same transaction data as Central Bank auditors, standardized and ready for analysis.</p>
              <Link to="/methodology" className="block pt-4">
                <Button variant="secondary" withArrow>{t('methodology.cta')}</Button>
              </Link>
            </div>
          </div>

          <div className="p-8 border-[0.5px] border-ink-100 rounded-md bg-white">
            <div className="h-48 flex items-end gap-8 mb-8">
              {[
                { h: '40%', l: 'Cost', color: 'bg-emerald-200' },
                { h: '90%', l: 'Sales', color: 'bg-emerald-500' },
                { h: '65%', l: 'Income', color: 'bg-emerald-300' },
              ].map((bar) => (
                <div key={bar.l} className="flex-1 flex flex-col items-center gap-3">
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: bar.h }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                    className={`w-full ${bar.color} rounded-t-sm`}
                  />
                  <span className="text-eyebrow text-ink-200">{bar.l}</span>
                </div>
              ))}
            </div>
            <p className="text-[13px] italic text-ink-300 leading-relaxed">
              {t('methodology.visualLabel')}
            </p>
          </div>
        </div>
      </section>

      {/* 10. FINAL CTA BAND */}
      <section className="bg-emerald-500 py-24 px-5 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-[40px] md:text-[56px] leading-[1.05] font-serif font-medium text-cream-50 mb-6">
            {t('finalCta.title')}
          </h2>
          <p className="text-lg text-emerald-100 mb-12 max-w-2xl mx-auto">
            Join thousands of property owners, banks, and appraisers using Egypt's most trusted valuation platform.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
             <Link to="/signup">
               <Button className="bg-cream-100 text-emerald-900 border-none hover:bg-cream-200 px-8 py-3">
                  {t('common.requestAppraisal')}
               </Button>
             </Link>
             <Link to="/signup">
               <Button variant="secondary" className="border-cream-100/30 text-cream-50 hover:bg-cream-100/10 px-8 py-3">
                  {t('finalCta.join')}
               </Button>
             </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.3334 4L6.00007 11.3333L2.66675 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
