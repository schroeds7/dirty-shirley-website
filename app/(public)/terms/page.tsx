import React from "react";

const TERMS_TEXT = `Terms of Service
Dirty Shirley App
Last Updated: February 2026
These Terms of Service (“Terms”) govern your access to and use of the Dirty Shirley mobile application (the “App”). By accessing or using the App, you agree to be bound by these Terms.
If you do not agree, do not use the App.

1. Eligibility
The App is intended for users 18 years of age or older.
By using the App, you represent and warrant that you meet this requirement.
Dirty Shirley does not knowingly permit use by individuals under 18.

2. Description of the App
Dirty Shirley is a nightlife discovery and social engagement platform that provides:
Venue and event discovery


Maps and location-based features


Voting, preference, and social interaction tools


User-generated content such as reviews and comments


The App provides informational content only and does not guarantee the accuracy, availability, legality, or safety of any venue, event, or experience.

3. No Promotion of Alcohol or Unsafe Behavior
Dirty Shirley does not promote or encourage:
Alcohol consumption


Underage drinking


Drunk driving


Illegal or unsafe behavior


Users are solely responsible for complying with all applicable laws and exercising reasonable judgment at all times.

4. Assumption of Risk
Nightlife activities inherently involve risks.
By using the App, you acknowledge and voluntarily assume all risks associated with nightlife participation, including but not limited to:
Alcohol-related incidents


Transportation decisions


Venue conditions


Interactions with other individuals



5. User Responsibility & Conduct
You agree that you are solely responsible for:
Your conduct


Your decisions


Your interactions


Any real-world outcomes resulting from App use


You agree not to:
Violate any law or regulation


Post false, misleading, or harmful content


Harass, abuse, or endanger others


Misrepresent venues, events, or affiliations



6. Venue Information & Partnerships
Venue information may be:
Provided by third-party APIs


User-submitted


Partner-affiliated in some cases


Not all venues are affiliated with Dirty Shirley.
Dirty Shirley does not guarantee:
Venue accuracy


Hours of operation


Event availability


Entry requirements


Safety or compliance



7. User-Generated Content
You retain ownership of content you submit but grant Dirty Shirley a non-exclusive, royalty-free license to display and use such content within the App.
Dirty Shirley reserves the absolute right, at its sole discretion, to:
Remove or edit content


Suspend or terminate accounts


Restrict access for any reason, with or without notice



8. Account Suspension & Termination
We may suspend or terminate your account at any time if we believe you have violated these Terms or engaged in harmful or inappropriate behavior.
You may request account deletion by contacting:
📧 contact@dirtyshirley.app

9. Payments & Future Features
The App is currently free to use.
Dirty Shirley may introduce subscriptions, ticketing, or in-app purchases in the future. Any paid features will be governed by additional terms disclosed at the time of purchase.

10. Limitation of Liability
To the maximum extent permitted by law:
Dirty Shirley and its owner shall not be liable for any indirect, incidental, special, consequential, or punitive damages


Total liability shall not exceed the amount paid by you to Dirty Shirley in the preceding 12 months (or $0 if the App is free)


This includes claims related to:
Alcohol consumption


Underage activity


Drunk driving


Injuries


Venue conditions


Third-party conduct


Inaccurate information



11. Disclaimer of Warranties
The App is provided “as is” and “as available.”
We make no warranties of any kind, express or implied, including fitness for a particular purpose or non-infringement.

12. Governing Law
These Terms are governed by the laws of the United States, without regard to conflict-of-law principles.

13. Changes to These Terms
We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms.

14. Contact Information
Benjamin Schroeder
Dirty Shirley App
📧 contact@dirtyshirley.app
`;

export default function Page() {
  const [title, subtitle, lastUpdated, ...rest] = TERMS_TEXT.split("\n");
  const bodyText = rest.join("\n");

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <header className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-base text-white/75">{subtitle}</p>
          <p className="mt-1 text-sm text-white/55">{lastUpdated}</p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/80 md:text-base md:leading-7">
            {bodyText}
          </pre>
        </div>
      </section>
    </main>
  );
}