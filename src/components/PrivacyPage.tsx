import React from 'react';
import { PageHeader } from './ui/PageHeader';
import { ShieldCheck } from 'lucide-react';

export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <PageHeader 
        title="Politique de confidentialité" 
        subtitle="Comment nous protégeons vos données"
        icon={<ShieldCheck />}
      />
      
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm mt-8 space-y-6 text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">1. Collecte des données</h2>
          <p>
            Nous collectons les données que vous nous fournissez directement lors de la création de votre compte, 
            notamment votre adresse e-mail, votre nom et d'autres informations nécessaires pour les fonctions comptables.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">2. Utilisation des données</h2>
          <p>
            Vos données sont utilisées exclusivement dans le but de fournir, gérer, et améliorer nos services comptables. 
            Nous ne vendons ni ne partageons vos données financières à des tiers à des fins commerciales sans votre consentement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">3. Sécurité</h2>
          <p>
            Nous prenons des mesures techniques et organisationnelles rigoureuses pour protéger vos données contre les accès 
            non autorisés, les pertes ou les altérations. Toutes les données sont chiffrées lors de leur transit.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">4. Droits des utilisateurs</h2>
          <p>
            Conformément aux réglementations sur la protection des données personnelles, vous disposez d'un droit d'accès, 
            de rectification et de suppression de vos données. Pour exercer ce droit, vous pouvez nous contacter.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">5. Cookies</h2>
          <p>
            Notre application utilise des cookies essentiels pour maintenir votre session de connexion et protéger la 
            plateforme. Nous utilisons également des cookies pour analyser les performances de l'application de façon anonyme.
          </p>
        </section>
      </div>
    </div>
  );
}
