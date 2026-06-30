import type { PublicPage } from './publicApi'

export const PUBLIC_PAGE_FALLBACKS: Record<string, PublicPage> = {
  about: {
    slug: 'about',
    title: 'About Us',
    subtitle: 'Excellence in education, rooted in character',
    body: {
      paragraphs: [
        'We are a forward-thinking school committed to academic rigor, moral development, and the skills students need for university and beyond.',
        'Our teachers combine proven classroom practice with digital tools — results, attendance, fees, and parent communication are always within reach through our secure school portal.',
        'From nursery through senior secondary, every learner is known, supported, and challenged to do their best work.',
      ],
      values: [
        { title: 'Excellence', desc: 'High expectations in teaching, assessment, and student conduct — every day.' },
        { title: 'Integrity', desc: 'Honesty, respect, and responsibility guide how we learn and lead together.' },
        { title: 'Innovation', desc: 'Modern labs, CBT exams, LMS access, and data-informed teaching.' },
        { title: 'Community', desc: 'Strong partnerships with parents, alumni, and the neighbourhoods we serve.' },
      ],
      vision:
        'To graduate confident, ethical, and capable young people who compete nationally and contribute globally.',
      mission:
        'To deliver quality education that blends strong academics, character formation, and technology — so every student can reach their full potential.',
    },
  },
  academics: {
    slug: 'academics',
    title: 'Academics',
    subtitle: 'Rigorous programs from early years to senior secondary',
    body: {
      paragraphs: [
        'Our curriculum aligns with national standards and is enriched with STEM, languages, arts, and life skills. Students learn in structured classrooms supported by digital resources, library services, and continuous assessment.',
        'Termly reports, CBT practice, and teacher feedback keep families informed. Senior students choose Science, Commercial, or Arts tracks with guidance from our counselling team.',
      ],
      features: [
        { title: 'Nursery & Early Years', desc: 'Play-based literacy, numeracy, and social skills in a safe, nurturing environment.' },
        { title: 'Primary (Basic 1–6)', desc: 'Core subjects, reading culture, ICT basics, and character education.' },
        { title: 'Junior Secondary (JSS 1–3)', desc: 'Broad foundation across sciences, humanities, and vocational exposure.' },
        { title: 'Senior Secondary (SSS 1–3)', desc: 'WAEC/NECO preparation with Science, Commercial, or Arts pathways.' },
      ],
      bullets: [
        'Continuous assessment and end-of-term examinations',
        'Computer-based testing (CBT) for exam readiness',
        'Digital report cards and parent portal access',
        'Library, science labs, and ICT facilities',
        'After-school remediation and enrichment clubs',
        'Career guidance and university counselling (SSS)',
      ],
    },
  },
  admissions: {
    slug: 'admissions',
    title: 'Admissions',
    subtitle: 'Join our learning community',
    body: {
      paragraphs: [
        'We welcome new pupils each session across nursery, primary, and secondary levels. Our admissions process is straightforward: apply online, submit required documents, and attend an assessment or interview where applicable.',
        'Places are offered based on availability, assessment outcomes, and alignment with our values. Early application is encouraged — popular year groups fill quickly.',
      ],
      highlight: {
        title: '2025/2026 session — applications open',
        desc: 'Limited spaces in select year groups. Complete your application early to secure an assessment date.',
      },
      requirements: [
        'Completed online application form',
        'Birth certificate or sworn age declaration',
        'Two recent passport photographs',
        'Previous school report(s) or transfer certificate',
        'Immunisation record (nursery & primary)',
        'Entrance assessment for applicable year groups',
      ],
    },
  },
  vision: {
    slug: 'vision',
    title: 'Our Vision',
    subtitle: 'Where we are headed',
    body: {
      paragraphs: [
        'We envision a school where every learner discovers their strengths, masters core competencies, and graduates ready for higher education and meaningful careers.',
        'Technology, strong teaching, and a caring community work together so no student is left behind.',
      ],
    },
  },
  mission: {
    slug: 'mission',
    title: 'Our Mission',
    subtitle: 'What drives us every day',
    body: {
      paragraphs: [
        'To provide accessible, high-quality education that develops intellect, character, and citizenship.',
        'We partner with families to nurture disciplined, creative, and confident young people.',
      ],
    },
  },
  history: {
    slug: 'history',
    title: 'Our History',
    subtitle: 'Built on decades of service to learners',
    body: {
      paragraphs: [
        'Founded to serve our local community with affordable quality education, our school has grown from a small campus into a full nursery-to-secondary institution.',
        'Alumni across Nigeria and abroad continue to represent the values instilled here — integrity, diligence, and service.',
      ],
    },
  },
  contact: {
    slug: 'contact',
    title: 'Contact Us',
    subtitle: 'We would love to hear from you',
    body: {
      paragraphs: [
        'Reach our admissions office for enrolment enquiries, or contact the school admin for general questions about fees, transport, and term dates.',
        'Office hours: Monday–Friday, 8:00 AM – 4:00 PM.',
      ],
    },
  },
  faq: {
    slug: 'faq',
    title: 'FAQ',
    subtitle: 'Common questions from parents and applicants',
    body: {
      paragraphs: [
        'Browse answers about admissions, fees, uniforms, and the parent portal. Contact us if your question is not listed — we respond within one business day.',
      ],
      bullets: [
        'How do I apply? — Use the online application form under Admissions.',
        'How are fees paid? — Via bank transfer, Paystack, Flutterwave, or Stripe where enabled.',
        'Can I track my child\'s results? — Yes, through the parent portal after enrolment.',
      ],
    },
  },
  careers: {
    slug: 'careers',
    title: 'Careers',
    subtitle: 'Join our teaching and support team',
    body: {
      paragraphs: [
        'We hire passionate educators and professionals who share our commitment to student success. Open roles are posted each term — submit your CV and credentials through our careers contact form.',
      ],
    },
  },
  departments: {
    slug: 'departments',
    title: 'Departments',
    subtitle: 'Academic and support units',
    body: {
      paragraphs: [
        'Our school is organised into academic departments — Sciences, Humanities, Languages, Vocational Studies — supported by Admin, Finance, ICT, and Student Welfare teams.',
      ],
    },
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    subtitle: 'How we protect your data',
    body: {
      paragraphs: [
        'We collect only information necessary to operate admissions, academics, and fee management. Data is stored securely and never shared with third parties except payment processors you choose to use.',
        'Parents and students may request access or correction of their records by contacting the school administrator.',
      ],
    },
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Use',
    subtitle: 'Portal and website usage',
    body: {
      paragraphs: [
        'Use of this website and school portal is subject to acceptable-use rules: no unauthorised access, no sharing of login credentials, and compliance with school policies on conduct and assessment integrity.',
      ],
    },
  },
}
