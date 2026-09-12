import type { Metadata } from 'next';
import { SocialIcon, type SocialIconName } from '@/components/site/SocialIcon';
import { SitePage } from '@/components/site/SitePage';
import { CONTACT, MAIL_URL, WHATSAPP_URL } from '@/site/contact';
import { pageMetadata } from '@/site/seo';
import styles from './contact.module.css';

export const metadata: Metadata = pageMetadata({
  title: 'Contact Us',
  description:
    'Reach MockSathi by email at mocksathi@gmail.com or on WhatsApp for help with mock tests, your account, plans or a refund request. Follow MockSathi on Instagram and YouTube for exam updates.',
  path: '/contact',
});

interface Channel {
  icon: SocialIconName;
  label: string;
  value: string;
  href: string;
  hint: string;
  external?: boolean;
}

const CHANNELS: Channel[] = [
  {
    icon: 'mail',
    label: 'Email',
    value: CONTACT.email,
    href: MAIL_URL,
    hint: 'Best for refund requests, account issues, and anything needing a record.',
  },
  {
    icon: 'whatsapp',
    label: 'WhatsApp',
    value: CONTACT.phone,
    href: WHATSAPP_URL,
    hint: 'Quick questions about tests, plans, or getting started.',
    external: true,
  },
];

const SOCIALS: Channel[] = [
  {
    icon: 'instagram',
    label: 'Instagram',
    value: 'MockSathi',
    href: CONTACT.instagram,
    hint: 'Exam updates and preparation tips.',
    external: true,
  },
  {
    icon: 'youtube',
    label: 'YouTube',
    value: 'MockSathi',
    href: CONTACT.youtube,
    hint: 'Walkthroughs and solution videos.',
    external: true,
  },
];

function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <a
      className={styles.card}
      href={channel.href}
      {...(channel.external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span className={styles.cardIcon} aria-hidden="true">
        <SocialIcon name={channel.icon} size={22} />
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardLabel}>{channel.label}</span>
        <span className={styles.cardValue}>{channel.value}</span>
        <span className={styles.cardHint}>{channel.hint}</span>
      </span>
    </a>
  );
}

export default function ContactPage() {
  return (
    <SitePage
      title="Contact Us"
      intro={
        <p>
          Whether it&rsquo;s a question about a mock test, a problem with your account, or a refund
          request — here is how to reach us.
        </p>
      }
    >
      <div className={styles.grid}>
        {CHANNELS.map((channel) => (
          <ChannelCard key={channel.label} channel={channel} />
        ))}
      </div>

      <h2 className={styles.sectionHeading}>Follow us</h2>
      <div className={styles.grid}>
        {SOCIALS.map((channel) => (
          <ChannelCard key={channel.label} channel={channel} />
        ))}
      </div>

      {/*
        Said plainly rather than left to be discovered: a refund request has a
        deadline, and someone who sends it through WhatsApp on the last day and
        is then asked to email may miss it.
      */}
      <p className={styles.note}>
        For refund and cancellation requests, please email us with your order or transaction ID so
        we have a record of the request — WhatsApp is best kept for quick questions.
      </p>
    </SitePage>
  );
}
