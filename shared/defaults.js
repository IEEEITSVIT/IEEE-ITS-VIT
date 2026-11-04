/**
 * Default site content.
 *
 * Used in two places:
 *   1. server/seed.js — seeds a fresh D1/SQLite database so the live site starts
 *      out identical to the original hardcoded website.
 *   2. The frontend — rendered instantly before /api/public/bootstrap resolves,
 *      and as a fallback if the API is unreachable, so the site never goes blank.
 *
 * After seeding, every value here is editable from /admin.
 */

const IC = 'https://ic-etite-28final.vercel.app'

export const PUBLIC_SETTING_KEYS = ['site', 'home', 'pages', 'seo', 'appearance', 'merch', 'blogs', 'vlogs', 'webteam', 'games']

export const DEFAULT_SETTINGS = {
    site: {
        name: 'IEEE ITS - VIT Chapter',
        shortName: 'IEEE ITS VIT',
        description: 'The Information Theory Society chapter at VIT, fostering innovation in information theory, coding, and beyond.',
        logoRound: '/logo-round.png',
        logoText: '/logo-text.png',
        email: 'ieeeits@vit.ac.in',
        phone: '+91 96184 98888',
        address: 'VIT, Vellore, Tamil Nadu',
        url: 'https://ieee-its-vit.vercel.app',
        madeWith: 'Designed & built by the',
        footerForm: {
            enabled: true,
            overline: 'Get in touch',
            title: 'Have a question?',
            text: 'Events, membership, collaborations or sponsorships — send us a message and the team will reply by email.',
            button: 'Send message',
            success: 'Message received — the team has been notified and will reply by email.',
        },
    },
    home: {
        heroBadge: 'IEEE Information Theory Society — VIT Chapter',
        heroEst: 'Est. 2023 · Vellore',
        tickerWords: ['Information Theory', 'Coding Theory', 'Machine Learning', 'Quantum Computing', 'Network Theory', 'Data Compression', 'Cryptography'],
        heroTitle: 'Decode the Future of',
        heroHighlight: 'Information Theory',
        heroSubtitle: 'We are a community of passionate engineers and researchers exploring network theory, coding theory, machine learning, and quantum computing at VIT.',
        primaryCta: { label: 'Join our chapter', url: '/join' },
        secondaryCta: { label: 'Explore Events', url: '/timeline' },
        galleryOverline: 'Gallery',
        galleryTitle: 'Captured Moments',
        gallerySubtitle: 'Snapshots of our dynamic workshops, hackathons, and active projects.',
        eventsOverline: 'Events',
        eventsTitle: 'What we have been building',
        eventsCta: 'All events',
        galleryCta: 'All moments',
        boardCta: 'Meet the web team',
        upcomingOverline: 'Up Next',
        upcomingTitle: 'Upcoming Events',
        upcomingSubtitle: 'Mark your calendar — here is what is coming up at IEEE ITS-VIT.',
        aboutOverline: 'What is IEEE ITS?',
        aboutTitle: 'Information Theory Society',
        aboutParagraphs: [
            'The IEEE Information Theory Society (ITS) is a global community that promotes the advancement of information theory and its applications. Our VIT chapter brings together students who are passionate about pushing the boundaries of coding, data compression, network protocols, and more.',
            'We host workshops, seminars, hackathons, and competitions to build a vibrant culture of learning and innovation on campus.',
        ],
        aboutImage: '/logo-round.png',
        stats: [
            { value: '60+', label: 'Members' },
            { value: '10+', label: 'Events' },
            { value: '5+', label: 'Domains' },
        ],
        boardOverline: 'Leadership',
        boardTitle: 'Meet Our Board',
        boardSubtitle: 'The passionate leaders driving IEEE ITS-VIT forward.',
        domainsOverline: 'What We Do',
        domainsTitle: 'Our Domains',
        domainsSubtitle: 'Exploring the frontiers of information theory and its modern applications.',
        stickyTitle: 'Beyond Boundaries',
        stickyText: "At IEEE ITS-VIT, we push the limits of what's possible with information. From the smallest bit to the largest data network.",
                chillTitle: 'Wanna chill?',
        chillText: "Take a break from the grind. We've got technical mini-games to keep your brain buzzing — Binary Decoder, Logic Gates, Morse Code & more!",
        chillCta: { label: 'Play mini-games', url: '/games' },
        joinCta: { label: 'Join the chapter', url: '/join' },
        sections: { banners: true, gallery: true, upcoming: true, events: true, about: true, board: true, domains: true, sticky: false, chill: true },
    },
    pages: {
        blogs: { overline: 'The Knowledge Hub', title: 'Blogs & Insights', subtitle: 'Deep dives into the world of information theory and modern digital society.' },
        vlogs: { overline: 'Video Content', title: 'Our Vlogs', subtitle: 'Watch, learn, and subscribe to stay updated with our latest content.' },
        timeline: { overline: 'The Roadmap', title: 'Our Journey & Future', subtitle: 'From our founding to the upcoming milestones — every memory and every plan.' },
        moments: { overline: 'Gallery', title: 'Our Moments', subtitle: 'Snapshots from our journey — the events, the people, the memories.' },
        faq: { overline: 'Got Questions?', title: 'Frequently Asked Questions', subtitle: 'Everything you need to know about IEEE ITS - VIT Chapter.' },
        faculty: { overline: 'Guidance', title: 'Faculty Coordinators', subtitle: 'The mentors and guides who make IEEE ITS-VIT possible.' },
        merch: { overline: 'Official Store', title: 'IEEE ITS Merchandise ', subtitle: 'Rep the chapter. Rock the gear.' },
        games: { overline: 'Chill Zone', title: 'Tech Mini-Games ', subtitle: 'Take a break and sharpen your tech brain with these mini-games!' },
        webteam: { overline: 'Credits', title: 'The Web Wizards ', subtitle: 'The designers and developers behind the digital home of IEEE ITS-VIT.' },
        suggestions: { overline: 'We Value Your Voice', title: 'Suggestions & Feedback ', subtitle: 'Have an idea for a workshop? Or a way to improve our website? Let us know!' },
        contact: { overline: 'Get in Touch', title: 'Contact & Queries ', subtitle: 'Questions about events, membership or collaborations? Drop us a message and the team will get back to you.' },
        join: { overline: 'Be Part of Us', title: 'Join IEEE ITS - VIT', subtitle: "Become a part of VIT's premier information theory community." },
    },
    seo: {
        titleTemplate: '%s | IEEE ITS VIT Vellore',
        defaultTitle: 'IEEE ITS VIT | Information Theory Society Student Chapter, VIT Vellore',
        description: 'IEEE ITS VIT is the IEEE Information Theory Society student chapter at VIT Vellore, a rising technical club running workshops, hackathons, Quanta and ic-ETITE.',
        keywords: 'IEEE ITS, IEEE VIT, IEEE ITS VIT, IEEE ITS VIT Vellore, IEEE VIT Vellore, IEEE Information Theory Society, IEEE Information Theory Society VIT, IEEE student chapter VIT, student chapter VIT, student chapters VIT, chapters VIT, VIT chapters, clubs in VIT, VIT clubs, technical clubs VIT, tech clubs VIT Vellore, VIT clubs and chapters, rising chapter VIT, new club VIT, IEEE chapters VIT, information theory VIT, coding theory, ic-ETITE, Quanta VIT, hackathons VIT, VIT Vellore',
        alternateNames: ['IEEE ITS VIT', 'IEEE ITS VIT Vellore', 'IEEE Information Theory Society VIT Chapter', 'IEEE ITS Student Chapter VIT'],
        ogImage: '/logo-round.png',
        twitterHandle: '',
        googleVerification: 'ZgsW_Xzfu8FnLvarNFFTVabnHhATlKvGlD3z5V5NNJc',
        pages: {
            '/': { title: 'Home', description: 'IEEE ITS VIT, the IEEE Information Theory Society student chapter at VIT Vellore. A rising tech club for workshops, hackathons, Quanta and the ic-ETITE conference.' },
            '/blogs': { title: 'Blogs & Insights', description: 'Articles from IEEE ITS VIT, the IEEE Information Theory Society student chapter at VIT Vellore, on information theory, technology and digital society.' },
            '/vlogs': { title: 'Vlogs', description: 'Videos from IEEE ITS VIT, the IEEE Information Theory Society student chapter at VIT Vellore.' },
            '/timeline': { title: 'Events & Timeline', description: 'Every IEEE ITS VIT event at VIT Vellore: workshops, hackathons, Quanta and ic-ETITE, past and upcoming.' },
            '/moments': { title: 'Moments', description: 'Photo albums from IEEE ITS VIT student chapter events at VIT Vellore.' },
            '/faq': { title: 'FAQ', description: 'Questions about joining IEEE ITS VIT, the IEEE Information Theory Society student chapter and technical club at VIT Vellore.' },
            '/faculty': { title: 'Faculty Coordinators', description: 'Faculty coordinators guiding the IEEE ITS VIT student chapter at VIT Vellore.' },
            '/merch': { title: 'Merchandise', description: 'Book official IEEE ITS VIT merchandise.' },
            '/games': { title: 'Tech Mini-Games', description: 'Binary decoder, logic gates, Morse code and entropy mini-games by IEEE ITS VIT.' },
            '/web-team': { title: 'Web Team', description: 'The developers and designers behind the IEEE ITS VIT website.' },
            '/suggestions': { title: 'Suggestions', description: 'Share suggestions and feedback with IEEE ITS VIT.' },
            '/contact': { title: 'Contact', description: 'Contact IEEE ITS VIT, the IEEE student chapter at VIT Vellore, about events, membership and collaborations.' },
            '/join': { title: 'Join Us', description: 'Join IEEE ITS VIT, a rising IEEE student chapter and technical club at VIT Vellore. Open to all VIT students.' },
            '/login': { title: 'Sign In', description: 'Sign in to your IEEE ITS VIT member account.', noindex: true },
        },
    },
    appearance: {
        colors: { bg: '#0b0c0e', surface: '#131518', surface2: '#1a1d21', line: '#262a30', text: '#f2f0eb', muted: '#8e939a', accent: '#3d9bff', accentInk: '#0b0c0e' },
        fonts: { display: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono' },
        radius: 14,
        preloader: true,
        preloaderMode: 'first-visit', // always | first-visit
        preloaderWord: 'IEEE ITS',
        preloaderLines: ['initialising channel', 'H(X) = −Σ p(x) log p(x)', 'decoding the future'],
        scrollProgress: true,
        grayscalePortraits: true,
    },
    merch: {
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        maxQty: 5,
        currency: '₹',
        note: 'No payment required — this is just a booking reservation.',
        requireMobile: true,
    },
    blogs: {
        magazineEnabled: true,
        magazineTag: 'New Release',
        magazineTitle: 'IEEE ITS Annual Magazine',
        magazineText: 'Explore our peer-reviewed articles and research summaries from the past year.',
        magazineCtaLabel: 'Coming Soon',
        magazineCtaUrl: '',
        newsletterTitle: 'Join the Theoretical Inner Circle',
        newsletterText: 'Get monthly insights, event early-access, and research highlights delivered to your inbox.',
    },
    vlogs: {
        channelUrl: 'https://youtu.be/JA3t27eBL3M?si=l8TaPSnTcHksrznC',
        subscribeTitle: 'Subscribe to Our Vlogs',
        subscribeText: 'Get notified when we drop new video content.',
    },
    webteam: {
        noteTitle: "Developers' Note",
        noteText: 'This website was built with a vision to create a digital home that truly reflects the innovative spirit of IEEE ITS-VIT. From the interactive "binary dinosaur" games to the sleek, high-performance glassmorphism UI, every line of code was written to provide a premium experience for our community. We utilized modern technologies like React, Framer Motion for animations, Cloudflare D1 and ImageKit to keep the platform as robust as it is beautiful — and fully editable from the admin dashboard.',
        noteSignature: '- The Web Development Team',
    },
    games: {
        tip: "Shannon's information theory laid the groundwork for all modern digital communication — from WiFi to streaming!",
    },
}

/* Admin-only settings (never sent by the public bootstrap API) */
export const DEFAULT_PRIVATE_SETTINGS = {
    notifications: {
        orderRecipients: 'ieeeits.vit@gmail.com',
        queryRecipients: 'ieeeits.vit@gmail.com',
        notifyOrders: true,
        notifyQueries: true,
        notifySuggestions: true,
        notifySubscribers: false,
        sendUserConfirmation: true,
    },
    smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        passEnc: '',
        fromName: 'IEEE ITS VIT',
        fromEmail: '',
    },
}

const member = (name, role, initials, image, instagram, linkedin) => ({ name, role, initials, image, instagram, linkedin })

export const DEFAULT_CONTENT = {
    board: [
        member('Arush Gupta', 'Chairperson', 'A', '/team/arush-gupta.jpg', 'https://www.instagram.com/chaiwithoverthinking?igsh=NTg0Mndod2tmbjZv', 'https://linkedin.com/in/aarushgupta-10b679287'),
        member('Sharath Chandra M', 'Secretary', 'SC', '/team/sharath-chandra-m.jpg', 'https://www.instagram.com/sharath_mandapati?igsh=aTBoamt6M3lkMTlk&utm_source=qr', 'https://linkedin.com'),
        member('Isha S U', 'Vice Chairperson', 'I', '/team/isha-s-u.jpg', 'https://www.instagram.com/maverick.19?igsh=N2o4eWttN2U3M2M4&utm_source=qr', 'https://www.linkedin.com/in/ishasu?utm_source=share_via&utm_content=profile&utm_medium=member_android'),
        member('Manya Dev', 'Co-Secretary', 'MD', '/team/manya-dev.jpg', 'https://www.instagram.com/_manya_dev?igsh=bHZjbmk3cXgwOHV1&utm_source=qr', 'https://www.linkedin.com/in/manya-dev-320014333?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app'),
        member('Khanak Verma', 'Project Head', 'KV', '/team/khanak-verma.jpg', 'https://www.instagram.com/khanak_verma_?igsh=MTN1ZWw4ZHFjNnQwdQ%3D%3D&utm_source=qr', 'https://www.linkedin.com/in/khanak-verma-70a807317?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app'),
        member('Agrima Gupta', 'Technical Head', 'AG', '/team/agrima-gupta.jpg', 'https://www.instagram.com/agrimag_01/', 'https://www.linkedin.com/me?trk=p_mwlite_feed-secondary_nav'),
        member('Mrithula T', 'R&D Head', 'M', '/team/mrithula-t.jpg', 'https://www.instagram.com/invites/contact/?utm_source=ig_contact_invite&utm_medium=copy_link&utm_content=uzl5y9k', 'https://www.linkedin.com/in/mrithula-t-107424322'),
        member('Aparajitaa Sanyal', 'Editorial Head', 'A', '/team/aparajitaa-sanyal.jpg', 'https://www.instagram.com/aparajitaasan_/', 'https://in.linkedin.com/in/aparajitaa-sanyal-989718326'),
        member('Krithika Shri', 'Creative Head', 'KS', '/team/krithika-shri.jpg', 'https://www.instagram.com/krithika_2303?utm_source=qr&igsh=NmdlaDYyenYxMGZm', 'https://www.linkedin.com/in/krithika-shri-9843353b3?utm_source=share_via&utm_content=profile&utm_medium=member_android'),
        member('Devkanti Sarkar', 'Design Head', 'DS', '/team/devkanti-sarkar.jpg', 'https://www.instagram.com/devkanti_sarkar/', 'https://www.linkedin.com/in/devkanti-sarkar-272881324/'),
        member('Solanki Nehal Shailesh', 'Events Head', 'SN', '/team/solanki-nehal.jpg', 'https://instagram.com', 'https://linkedin.com'),
        member('Harika R', 'Finance Head', 'H', '/team/harika-r.jpg', 'https://www.instagram.com/harikaa.r?igsh=enl3Yjk0NTg1ZzNu', 'https://www.linkedin.com/in/harika-r-080904367?utm_source=share_via&utm_content=profile&utm_medium=member_android'),
        member('Sanjana Anna John', 'Outreach Head', 'SA', '/team/sanjana-anna-john.jpg', 'https://www.instagram.com/sanjana.john?igsh=MW8zN2FoYzhiNDBjdA==', 'https://www.linkedin.com/in/sanjana-anna-john-a6a9b5363?utm_source=share_via&utm_content=profile&utm_medium=member_android'),
        member('Drishita Paul', 'Publicity Head', 'DP', '/team/drishita-paul.jpg', 'https://www.instagram.com/drish_but_messier?igsh=d3N0OXRqZWp5a3Fj', 'https://www.linkedin.com/in/drishita-paul-0238b1295?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app'),
        member('Mithun M S', 'Management Head', 'M', '/team/mithun-m-s.jpg', 'https://www.instagram.com/mith.un._?igsh=MWVocXRlcTViMnNudw%3D%3D&utm_source=qr', 'https://www.linkedin.com/in/mithun-ms-a6ba19376?utm_source=share_via&utm_content=profile&utm_medium=member_ios'),
    ],
    domains: [
        { icon: '📡', title: 'Technical', desc: '• Developing scalable software architectures, advanced competitive coding, and full-stack systems with core CSE principles.' },
        { icon: '👩🏻‍💻', title: 'Project', desc: '• Strengthening project delivery through strategic budgeting, resource optimization, and sustainable sponsorship management.' },
        { icon: '🔐', title: 'Editorial', desc: '• Curating technical excellence through high-impact publications, AI research reviews, and strategic content strategy.' },
        { icon: '🧠', title: 'Design & Creative', desc: '• Blending aesthetics with technology to craft immersive UI/UX, brand identities, and dynamic visual media.' },
        { icon: '📊', title: 'Research and Development', desc: '• Pioneering innovation in Artificial Intelligence, Machine Learning, and Neural Networks to solve complex computational problems.' },
        { icon: '🌐', title: 'Publicity', desc: '• Amplifying our reach through strategic digital outreach, public relations, and high-impact community building.' },
        { icon: '⚡', title: 'Events & Management', desc: '• Executing world-class technical symposiums, hackathons, and workshops that drive innovation.' },
        { icon: '🤝', title: 'Out-Reach', desc: '• Establishing powerful industrial alliances and academic partnerships to foster global collaboration.' },
        { icon: '💰', title: 'Finance', desc: '• Optimizing resource allocation through strategic financial planning, budgeting, and sponsorship management.' },
    ],
    faculty: [
        {
            name: 'John Singh K', designation: 'Faculty Coordinator', department: 'Dept. of CSE, VIT Vellore', initials: 'JSK',
            image: '/team/john-singh-k.jpg', website: 'https://vitdirectory.vit.ac.in/page/faculty/12442', isQuote: true,
            note: 'IEEE ITS VIT is a platform where students transform information into innovation. I am proud to guide this dedicated team as they push the boundaries of technical excellence and community building.',
        },
        {
            name: 'Dr. Raghavan R', designation: 'Faculty Coordinator', department: 'Associate Professor Grade 2 · SCORE (IT), VIT Vellore', initials: 'RR',
            image: '/team/raghavan-r.jpg',
            website: 'https://vitdirectory.vit.ac.in/page/faculty/10620', isQuote: false,
            note: 'Research interests: Digital Image Processing, Content-Based Image Retrieval, Machine Learning, Deep Learning, Knowledge Engineering and Rough Sets.',
        },
    ],
    web_team: [
        member('Likhith M', 'Full Stack Developer', 'L', '/team/likhith-m.jpg', 'https://www.instagram.com/likhith_m123?igsh=ZnRpbjVvd2VwejJ4', 'https://www.linkedin.com/in/likhith-medarametla-0039b6320?utm_source=share_via&utm_content=profile&utm_medium=member_android'),
        member('Jayanth M', 'Frontend & UI Specialist', 'J', '/team/jayanth-m.jpg', 'https://www.instagram.com/jayanthreddy_143/', 'https://www.linkedin.com/in/mallidi-jaya-veera-maheswara-reddy-468426297?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app'),
        member('SivaGanesh K.B', 'Backend Architecture', 'SG', '/team/sivaganesh-kb.jpg', 'https://www.instagram.com/k.b.sivaganesh?igsh=MW14OHFwYmdiMXhudg==', 'https://www.linkedin.com/in/siva-ganesh-karanam-balaji-b96950335?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app'),
        member('Santhan Sai', 'Full Stack Developer', 'SS', '/team/santhan-sai.jpg', 'https://www.instagram.com/', 'https://www.linkedin.com/in/santhan-sai-thota-4bb3b6321/'),
        member('Shaunak Dhar', 'Full Stack Developer', 'SD', '/team/shaunak-dhar.jpg', 'https://www.instagram.com/shaunak_777?igsh=ZzdsaHd3cm1xenc3', 'https://www.linkedin.com/in/shaunak-dhar-474100286?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app'),
        member('Ansuman Singh', 'Frontend Developer', 'AS', '/team/ansuman-singh.jpg', 'https://www.instagram.com/_.ansu.17?igsh=MWlxc2M1NWt1NHVnZQ==', 'https://www.linkedin.com/'),
        member('Leela Krishna K', 'Web Technical Lead', 'LK', '/team/leela-krishna-k.jpg', 'https://www.instagram.com/leelakrishna_123?igsh=Y2Rham5vYW1tbjky', 'https://linkedin.com'),
        member('Amrit', 'Backend', 'A', '/team/amrit.jpg', 'https://www.instagram.com/amrit_kavipurapu', 'https://www.linkedin.com/in/amrit-kavipurapu-471577383/'),
        member('Sharath Chandra M', 'Full Stack Developer', 'SC', '/team/sharath-chandra-m.jpg', 'https://www.instagram.com/sharath_mandapati?igsh=aTBoamt6M3lkMTlk&utm_source=qr', 'https://www.linkedin.com/'),
        member('Agrima Gupta', 'Full Stack Developer', 'AG', '/team/agrima-gupta.jpg', 'https://www.instagram.com/agrimag_01/', 'https://www.linkedin.com/me?trk=p_mwlite_feed-secondary_nav'),
    ],
    faqs: [
        { q: 'What is IEEE ITS?', a: 'IEEE Information Theory Society (ITS) is a global community focused on the advancement of information theory and its applications. Our VIT chapter brings this mission to campus through events, workshops, and projects.' },
        { q: 'Who can join IEEE ITS VIT?', a: 'Any student who is passionate about doing something new and innovative can join. No prior experience is required!' },
        { q: 'How do I become a member?', a: 'Create an account on the "Sign In" page, then complete your profile on the "Join Us" page with your mobile and registration number.' },
        { q: 'What kind of events do you organize?', a: 'We organize workshops, hackathons, seminars, paper reading groups, coding competitions, guest lectures, and our flagship annual Tech Symposium.' },
        { q: 'Can first-year students join?', a: 'Absolutely! We welcome students from all years. First-year students bring fresh perspectives and energy to our community.' },
        { q: 'How can I contribute to blogs or vlogs?', a: 'We have an open content team! If you love writing or creating video content about tech and information theory, reach out to our Content Lead.' },
        { q: 'Do you collaborate with other chapters?', a: 'Yes! We regularly collaborate with other IEEE societies, ACM, GDG, and other tech communities on campus and beyond — including co-organising the ic-ETITE international conference with SCORE.' },
    ],
    blogs: [
        {
            slug: 'cyberbullying', tag: 'Social Impact', readTime: '5 min read', date: 'Feb 25, 2026',
            title: 'The impact of cyberbullying on young people’s mental health',
            desc: 'Cyberbullying has become a serious threat affecting young people today, persisting beyond physical spaces and creating a continuous cycle of harassment.',
            image: '/blog-cyber.png',
            content: '<p>Cyberbullying has become the most serious problem affecting young people today, with the rise of smartphones and social media platforms like Facebook, Instagram, and Snapchat. Communication has become faster and more public than ever before. While these platforms offer connections and entertainment, they also create spaces where harassment can occur easily and repeatedly. Unlike normal bullying, cyberbullying will not stop when the person leaves the place. It will be continued whole day or week, making the victim feel it is impossible to escape.</p><p>One of the most immediate effects of cyberbullying is anxiety. Young people may constantly worry about what others are saying about them online. They might feel afraid to check their phones or open social media apps. Over time, this fear can develop into chronic stress or panic attacks.</p><p>Cyberbullying is a serious threat to young people’s mental health. Creating safer and kinder online spaces is essential to protect their well-being and future.</p>',
        },
        {
            slug: 'regulation', tag: 'Digital Policy', readTime: '4 min read', date: 'Feb 24, 2026',
            title: 'Why social media needs to be regulated',
            desc: 'As social media becomes a powerful force in daily life, the need for clear rules to protect users and combat misinformation becomes essential.',
            image: '/blog-social.png',
            content: '<p>Social media needs to be regulated because it has become a powerful part of our daily lives. Millions of people use platforms like Instagram, Facebook, and X to share ideas, news, and opinions. While this can be positive it also creates serious problems. False information spreads very quickly and many people believe it without checking facts. This can cause fear.</p><p>Social media can also harm mental health. Constant comparison, cyberbullying, and online pressure can make people feel anxious or depressed. Young users are especially affected. In addition some platforms collect personal data without users fully understanding how it is used.</p><p>Regulation does not mean stopping free speech. It means setting clear rules to protect users, reduce harmful content, and ensure privacy. Just like traffic rules keep roads safe, basic regulations can make social media a safer and healthier space for everyone.</p>',
        },
    ],
    magazines: [
        { title: 'The Information Theory Review', edition: 'Annual Edition 2025', desc: 'An in-depth look at AI-driven information recovery.', icon: '📕', url: '' },
        { title: 'ITS Tech Pulse', edition: 'Q4 2025 Release', desc: 'Explaining Entropy in the context of modern big data.', icon: '📘', url: '' },
    ],
    vlogs: [
        { title: 'IEEE ITS VIT — Chapter Introduction', desc: 'An overview of who we are and what we do.', url: 'https://youtu.be/JA3t27eBL3M?si=l8TaPSnTcHksrznC', thumbnail: '' },
    ],
    merch: [
        { name: 'IEEE ITS Classic Jacket', price: 499, tag: 'Bestseller', desc: 'The signature IEEE ITS Jacket with the chapter logo embroidered on the chest.', image: '/2.png', colors: ['#800000', '#121212'], comingSoon: false },
        { name: 'ITS Premium Hoodie', price: 999, tag: 'Coming Soon', desc: 'Stay warm and tech-savvy. Oversized fleece hoodie with high-density print on the back.', image: '', colors: ['#121212', '#2a2a2a'], comingSoon: true },
    ],
    // Curated home marquee: best shot from each event, no near-duplicates.
    gallery: [
        ['/moments/ic-etite-24-inagural/004A3176.JPG', "ic-ETITE'24 inauguration"],
        ['/junior-core.jpg', 'Junior Core 2026'],
        ['/quanta23-1.jpg', "Quanta '23 stall"],
        ['/moments/ic-etite-24-expo/004A3372.JPG', "ic-ETITE'24 expo"],
        ['/inno1.jpg', 'Innoverse – Yantra 23'],
        ['/casa1.jpg', 'CASA'],
        ['/moments/ic-etite-24-inagural/004A3340.JPG', "ic-ETITE'24 audience"],
        ['/quanta23-2.jpg', "Quanta '23"],
        ['/moments/ic-etite-24-expo/004A3379.JPG', 'TechNext expo stall'],
        ['/junior-core-1.jpg', 'Junior Core 2026'],
        ['/inno.jpg', 'Innoverse NFT session'],
        ['/moments/ic-etite-24-inagural/004A3192.JPG', "ic-ETITE'24 felicitation"],
        ['/moments/ic-etite-24-expo/004A3569.JPG', "ic-ETITE'24 night expo"],
        ['/004A3649.JPG', "ic-ETITE'24"],
    ].map(([image, caption]) => ({ image, caption, link: '' })),
    banners: [
        {
            badge: 'International Conference · IEEE Xplore',
            title: "ic-ETITE'28",
            subtitle: 'Third International Conference on Emerging Trends in Information Technology and Engineering — organised by SCORE, VIT with the IEEE ITS Student Chapter. 10–11 February 2028, VIT Vellore.',
            image: `${IC}/images/frame_15.webp`,
            logo: `${IC}/logos/ic-etite28-cropped-transparent.png`,
            ctaLabel: 'Visit Conference Site →', ctaUrl: `${IC}/`,
            secondaryLabel: 'Call for Papers', secondaryUrl: `${IC}/call-for-papers`,
            facts: ['Paper deadline · 05 Oct 2027', 'Acceptance · 04 Nov 2027', 'Camera-ready · 12 Dec 2027', 'Conference · 10–11 Feb 2028'],
        },
        {
            badge: 'Expo · Hackathon',
            title: "TechNext '28 & BOLT 3.0",
            subtitle: 'The technology expo and the BOLT hackathon return alongside ic-ETITE\'28. Showcase your build, meet industry, and code through the night.',
            image: `${IC}/images/004A3344.webp`,
            logo: `${IC}/logos/technext-logo.png`,
            ctaLabel: 'Register for Expo →', ctaUrl: `${IC}/technext`,
            secondaryLabel: 'Explore BOLT 3.0', secondaryUrl: `${IC}/hackathon`,
            facts: [],
        },
    ],
    popups: [
        {
            title: "ic-ETITE'28 — Call for Papers is open",
            text: 'Third International Conference on Emerging Trends in IT & Engineering · 10–11 Feb 2028 · VIT Vellore. Accepted papers go to IEEE Xplore.',
            image: `${IC}/images/frame_15.webp`,
            ctaLabel: 'Submit / Learn More →', ctaUrl: `${IC}/call-for-papers`,
            pages: '/', frequency: 'once-per-session', delaySeconds: 0, posterOnly: false,
        },
    ],
    announcements: [
        { text: "ic-ETITE'28 paper submissions close 05 Oct 2027 —", linkLabel: 'Call for Papers →', url: `${IC}/call-for-papers` },
    ],
    nav_links: [
        { label: 'Home', url: '/' }, { label: 'Blogs', url: '/blogs' }, { label: 'Vlogs', url: '/vlogs' },
        { label: 'Events', url: '/timeline' }, { label: 'Moments', url: '/moments' }, { label: 'FAQ', url: '/faq' },
        { label: 'Faculty', url: '/faculty' }, { label: 'Merch', url: '/merch', placement: 'more' }, { label: 'Games', url: '/games', placement: 'more' },
    ],
    footer_links: [
        { group: 'Quick Links', label: 'Home', url: '/' }, { group: 'Quick Links', label: 'Blogs', url: '/blogs' },
        { group: 'Quick Links', label: 'Vlogs', url: '/vlogs' }, { group: 'Quick Links', label: 'Events', url: '/timeline' },
        { group: 'Quick Links', label: 'Merch', url: '/merch' }, { group: 'Quick Links', label: 'Games', url: '/games' },
        { group: 'Community', label: 'Join Us', url: '/join' }, { group: 'Community', label: 'FAQ', url: '/faq' },
        { group: 'Community', label: 'Moments', url: '/moments' }, { group: 'Community', label: 'Faculty', url: '/faculty' },
        { group: 'Community', label: 'Web Team', url: '/web-team' }, { group: 'Community', label: 'Suggestions', url: '/suggestions' },
        { group: 'Community', label: 'Contact', url: '/contact' },
        { group: 'Community', label: "ic-ETITE'28", url: `${IC}/` },
    ],
    social_links: [
        { platform: 'instagram', url: 'https://www.instagram.com/ieeeitsvit?igsh=MXdpbjhseXh4ZGN0' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/company/ieee-its-chapter-vit/' },
        { platform: 'email', url: 'mailto:ieeeits@vit.ac.in' },
    ],
}

const ev = (slug, title, start_date, extra = {}) => ({
    slug, title, start_date, end_date: null, date_label: '', tag: '', summary: '', body_html: '', time_text: '', venue: '',
    poster_url: '', registration_url: '', cta_label: 'Register Now', featured: 0, show_in_timeline: 1,
    extra: { highlights: [], agenda: [], links: [] }, ...extra,
})

export const DEFAULT_EVENTS = [
    ev('chapter-founded', 'Chapter Founded', '2023-02-01', { date_label: 'Feb 2023', summary: 'IEEE ITS Chapter officially established at VIT, Vellore.' }),
    ev('innoverse-yantra-23', 'Innoverse - Yantra 23', '2023-02-15', { date_label: 'Feb 2023', summary: 'Introduction to Information Theory — our first technical workshop with 60+ attendees.' }),
    ev('quanta-2023', 'Quanta 2023', '2023-11-01', { date_label: 'Nov 2023', summary: 'Hands-on workshop on quantum error correction in collaboration with IBM Qiskit.' }),
    ev('techtrek-yantra-24', 'TechTrate - Yantra 24', '2024-02-01', { date_label: 'Feb 2024', summary: 'Deep learning workshop for wireless channel estimation and signal detection.' }),
    ev('ic-etite-24', "ic-ETITE'24", '2024-02-22', { end_date: '2024-02-23', venue: 'VIT Vellore', summary: 'A multinational tech conference hosted by the Department of SCORE in collaboration with tech giants like Cisco, Intel, and others. 1,688 papers from 19 countries, 1,088 participants and 22 keynotes.' }),
    ev('board-inauguration-2026', 'New Board Inauguration', '2026-02-01', { date_label: 'Feb 2026', summary: 'Welcomed the 2026 board with a grand inauguration ceremony.' }),
    ev('innovate-for-impact-2026', 'INNOVATE FOR IMPACT (IEEE ITS)', '2026-03-06', { summary: '24 hours of non-stop building and innovation at VIT. Showcase your skills and win big.' }),
    ev('casa-2026', 'CASA 2026', '2026-03-15', { summary: 'A responsible measure to bring the community together for a day of fun, food, and games! Our annual cultural fest.' }),
    ev('quanta-26', 'Quanta 2026', '2026-07-17', {
        tag: 'Expo Event', time_text: '1:00 PM - 6:00 PM IST', venue: 'VIT SJT Ground', poster_url: '/hackathon.png',
        registration_url: 'https://vtop.vit.ac.in/vtop/open/page', cta_label: 'Register via VTOP',
        summary: 'Welcome Juniors! Join us at VIT SJT Ground from 1:00 PM to 6:00 PM to explore the exciting world of information theory, participate in games, and get to know our chapter.',
        extra: {
            heading: 'Interact, Learn & Explore! ',
            highlightsTitle: 'What is waiting for you?',
            highlights: [
                '<strong>Mini-Games:</strong> Try out technical challenges like Binary Decoder, Logic Gate puzzles, and Morse Code decoders.',
                '<strong>Domain Overview:</strong> Connect with seniors from Tech, R&D, Design, Creative, Publicity, Events, Outreach, and Finance domains.',
                '<strong>Board Interaction:</strong> Ask questions, explore projects, and understand the recruitment process of the chapter.',
            ],
            agendaTitle: 'Stall Agenda',
            agenda: [
                { time: '01:00 PM', label: 'Stall Inauguration & Core Meetup' },
                { time: '02:30 PM', label: 'Interactive Coding Games & Decoders Go Live' },
                { time: '05:30 PM', label: 'Interaction Wrap-up & Closing Session' },
            ],
            ctaTitle: 'Express Interest:',
            ctaText: 'Officially register your interest to join IEEE ITS-VIT via VTOP!',
            closing: '"See you at the stall! Let\'s decode the future together. "',
            links: [],
        },
    }),
    ev('ic-etite-28', "ic-ETITE'28", '2028-02-10', {
        end_date: '2028-02-11', tag: 'International Conference', time_text: 'Two-day conference', venue: 'VIT Vellore, Tamil Nadu',
        poster_url: `${IC}/images/frame_15.webp`, registration_url: `${IC}/`, cta_label: 'Visit Conference Site', featured: 1,
        summary: 'Third International Conference on Emerging Trends in Information Technology and Engineering, organised by SCORE, VIT with the IEEE ITS Student Chapter. Accepted papers are submitted to IEEE Xplore.',
        extra: {
            heading: 'An international forum for IT & engineering research ',
            highlightsTitle: 'Highlights',
            highlights: [
                '<strong>Call for Papers:</strong> Original research in IT, computer, communication and electronics engineering — IEEE two-column template, 4–6 pages, submitted via Microsoft CMT.',
                '<strong>BOLT 3.0 Hackathon</strong> and the <strong>TechNext \'28</strong> expo run alongside the conference.',
                '<strong>Keynotes</strong> from academia and industry, continuing the legacy of ic-ETITE\'20 and ic-ETITE\'24.',
            ],
            agendaTitle: 'Important Dates',
            agenda: [
                { time: '05 Oct 2027', label: 'Full paper submission (CMT closes 23:59 IST)' },
                { time: '04 Nov 2027', label: 'Notification of acceptance' },
                { time: '12 Dec 2027', label: 'Camera-ready submission & registration' },
                { time: '10–11 Feb 2028', label: 'Conference days' },
            ],
            ctaTitle: 'Take part:',
            ctaText: 'Submit your paper, register for the expo, or join the hackathon.',
            closing: '',
            links: [
                { label: 'Call for Papers', url: `${IC}/call-for-papers` },
                { label: 'Register for TechNext Expo', url: `${IC}/technext` },
                { label: 'BOLT 3.0 Hackathon', url: `${IC}/hackathon` },
                { label: 'Download Brochure', url: `${IC}/ic-ETITE'28.pdf` },
            ],
        },
    }),
]

/* Moment albums reference events by slug; the seeder resolves slugs to ids. */
const ETITE_DAY1 = '/moments/ic-etite-24-inagural'
const ETITE_EXPO = '/moments/ic-etite-24-expo'

export const DEFAULT_MOMENTS = [
    { event_slug: null, album_date: '2026-02-01', title: 'Junior Core 2026 Interaction', photos: ['/junior-core.jpg', '/junior-core-1.jpg'] },
    {
        event_slug: 'ic-etite-24', title: "Day 1 ic-ETITE'24 Inaugural",
        photos: [
            ...['004A3176', '004A3153', '004A3166', '004A3192', '004A3210', '004A3215', '004A3308', '004A3340', '004A3184'].map(n => `${ETITE_DAY1}/${n}.JPG`),
            `${ETITE_EXPO}/004A3161.JPG`, `${ETITE_DAY1}/004A3347.JPG`,
        ],
    },
    {
        event_slug: 'ic-etite-24', title: "ic-ETITE'24 Expo",
        photos: ['004A3372', '004A3365', '004A3367', '004A3364', '004A3379', '004A3382', '004A3390', '004A3407', '004A3569'].map(n => `${ETITE_EXPO}/${n}.JPG`),
    },
    {
        event_slug: 'ic-etite-24', title: "ic-ETITE'24 Evening Session",
        photos: ['004A3611', '004A3578', '004A3586'].map(n => `${ETITE_EXPO}/${n}.JPG`),
    },
    {
        event_slug: 'ic-etite-24', title: "ic-ETITE'24 Highlights",
        photos: ['/004A3649.JPG', `${IC}/images/004A3344.webp`, `${IC}/images/004A3218.webp`, `${IC}/images/gallery/icetite24_inauguration.webp`],
    },
    { event_slug: 'quanta-2023', title: "Quanta '23", photos: ['/quanta23-1.jpg', '/quanta23-2.jpg', '/quanta23-3.jpg'] },
    { event_slug: 'innoverse-yantra-23', title: 'Innoverse – YANTRA 23', photos: ['/inno1.jpg', '/inno.jpg', '/inno2.jpg', '/inno3.jpg'] },
    { event_slug: 'casa-2026', title: 'CASA – Say No to Substance Abuse', photos: ['/casa1.jpg'] },
]
