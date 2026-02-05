const POLICY_TEXT = `Privacy Policy
Dirty Shirley App
Last Updated: February 2026
Dirty Shirley (“we,” “our,” or “us”) values your privacy. This Privacy Policy explains how we collect, use, and protect information when you use the Dirty Shirley mobile application (the “App”).
By using the App, you agree to the collection and use of information as described in this policy.

1. Information We Collect
We collect the following types of information to operate and improve the App:
a. Information You Provide
Email address


First and last name


Birthday or age


Gender


Music preferences


Venue preferences


Votes and activity (such as “I’m Going,” vibe checks, or similar interactions)


User-generated content, including comments, reviews, and profile information


b. Location Information
The App uses location data to power maps, nearby venue discovery, and nightlife features.
Depending on your device settings, we may collect:
Precise location (GPS)


Approximate location (city-level)


Location data is only used while the App is active and is not tracked continuously in the background.
c. Automatically Collected Information
App usage and interaction data


Device and performance data


Log and diagnostic data



2. How We Use Your Information
We use your information to:
Create and manage user accounts


Personalize nightlife recommendations


Display nearby venues and events


Enable voting, preferences, and social features


Send push notifications (if enabled)


Improve app performance, reliability, and features


Maintain security and prevent misuse



3. Third-Party Services
We use trusted third-party services to operate the App, including:
Firebase (authentication, database, analytics, cloud functions)


Map and location services (venue discovery and navigation)


These providers only process data as necessary to support App functionality and are subject to their own privacy policies.

4. Push Notifications
If you enable notifications, we may send you alerts related to:
App activity


Venue updates


Voting or social interactions


You can disable notifications at any time through your device settings.

5. Data Sharing
We do not sell your personal data.
We only share data:
With service providers necessary to operate the App


When required by law or legal process


To protect the rights, safety, or integrity of users or the App



6. Data Retention
We retain user data only as long as necessary to:
Provide App services


Meet legal or operational requirements



7. Account Deletion & Data Removal
At this time, users may request account deletion by contacting:
📧 contact@dirtyshirley.app
Upon request, we will delete or anonymize your account data within a reasonable timeframe, subject to legal obligations.

8. Age Restriction
Dirty Shirley is intended for users 18 years of age or older.
We do not knowingly collect data from individuals under 18.

9. Geographic Scope
The App is currently intended for use within the United States only.

10. Security
We use reasonable technical and organizational safeguards to protect your information. However, no system is 100% secure, and we cannot guarantee absolute security.

11. Changes to This Policy
We may update this Privacy Policy from time to time. Any changes will be reflected with an updated “Last Updated” date.

12. Contact Us
If you have questions or requests related to this Privacy Policy, please contact:
Benjamin Schroeder
Dirty Shirley App
📧 contact@dirtyshirley.app
`;

export default function Page() {
  const [title, subtitle, lastUpdated, ...rest] = POLICY_TEXT.split("\n");
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