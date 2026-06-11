import React from 'react';
import { PageHeader } from './ui/PageHeader';
import { CheckSquare } from 'lucide-react';

export function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <PageHeader 
        title="Conditions d'utilisation" 
        subtitle="Nos règles et engagements"
        icon={<CheckSquare />}
      />
      
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm mt-8 space-y-6 text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">1. Acceptation des conditions</h2>
          <p>
            En accédant et en utilisant notre application, vous acceptez d'être lié par les présentes conditions d'utilisation. 
            Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">2. Description du service</h2>
          <p>
            Notre application fournit des outils comptables et financiers destinés aux entreprises. Les services peuvent évoluer, 
            et nous nous réservons le droit de les modifier, suspendre ou supprimer à tout moment.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">3. Responsabilité de l'utilisateur</h2>
          <p>
            Vous êtes responsable du maintien de la confidentialité de votre compte et de votre mot de passe, 
            ainsi que de toutes les activités qui se produisent sous votre compte. Les informations saisies 
            dans l'application doivent être exactes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">4. Propriété intellectuelle</h2>
          <p>
            L'ensemble des contenus, marques, logos et logiciels fournis via cette application sont la propriété 
            exclusive de notre entreprise et sont protégés par les lois sur la propriété intellectuelle.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">5. Limitation de responsabilité</h2>
          <p>
            Bien que nous fassions de notre mieux pour assurer la fiabilité du service, nous ne saurions être tenus 
            responsables des interruptions, erreurs de calcul, ou pertes de données éventuelles. L'utilisateur 
            reste seul responsable de ses obligations légales et comptables.
          </p>
        </section>
      </div>
    </div>
  );
}
