import * as React from 'react';
import { useTranslation } from 'react-i18next';

export const MethodologyPage = () => {
  const { t } = useTranslation();

  return (
    <div className="pt-32 pb-24 px-5 md:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-h1 text-ink-600 mb-12">{t('nav.methodology')}</h1>
        <div className="space-y-8 text-body-l text-ink-400">
          <p className="font-serif text-2xl text-ink-500 italic">
            "Transparency in appraisal is not merely about showing the final number; it's about exposing the reconciliation logic that led to it."
          </p>
          <p>
            Beit Index operates on a standardized valuation framework that bridges the gap between traditional brokerage estimates and rigorous bank-grade appraisals. Our platform ensures that every FRA-licensed appraiser on our network uses a unified set of data points, collected and indexed across Greater Cairo and major coastal developments.
          </p>
          <p>
            Our methodology strictly adheres to the unified standards set by the Egyptian Financial Regulatory Authority (FRA) in 2015, integrated with international valuation best practices.
          </p>
          <div className="pt-12 border-t border-ink-100">
            <h3 className="text-h3 text-ink-600 mb-6 font-serif">Key Pillars</h3>
            <ul className="space-y-4">
               {[
                 'Standardized Market-Approach reconciliation',
                 'Automated proximity-indexed comparable selection',
                 'Verified title deed and building permit validation',
                 'Multi-stage auditor oversight for institutional reports'
               ].map(item => (
                 <li key={item} className="flex gap-4 items-start">
                    <div className="w-1.5 h-1.5 bg-emerald-500 mt-2 rounded-full shrink-0" />
                    <span className="text-body-m">{item}</span>
                 </li>
               ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
