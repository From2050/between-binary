// ─── 45 Civilization Nodes — the shared record ───
// One source of truth, consumed by two independent presentations:
//   • src/components/StarMap.tsx — the homepage constellation, which maps each
//     record onto an elliptical orbit and lets stars swing in and out of reach.
//   • src/pages/world/index.astro — the 3D walk, which maps the same records
//     onto a distant sky dome.
// Add or edit a figure here and both displays pick it up.

export type CivilizationStar = {
    id: string;
    name: string;
    role: string;
    desc: string;
    year: string;
    color: string;
    imageUrl?: string;
};

export const civilizationStars: CivilizationStar[] = [
    // ━━━ ERA I: Foundations (1800s) ━━━
    { id: 'babbage', name: 'Charles Babbage', role: 'Analytical Engine', desc: 'Designed the first general-purpose mechanical computer, a century ahead of its time.', year: '1837', color: '#94A3B8', imageUrl: '' },
    { id: 'lovelace', name: 'Ada Lovelace', role: 'The First Programmer', desc: 'Visionary who recognized that computers could do more than just calculate numbers.', year: '1843', color: '#F472B6', imageUrl: '' },
    { id: 'bell', name: 'Alexander G. Bell', role: 'Telephone', desc: 'Bridged the gap between voice and wire, birthing the age of telecommunication.', year: '1876', color: '#FCA5A5', imageUrl: '' },
    { id: 'tesla', name: 'Nikola Tesla', role: 'AC Power & Radio', desc: 'Electrified the world with alternating current and laid groundwork for wireless communication.', year: '1891', color: '#67E8F9', imageUrl: '' },
    { id: 'marconi', name: 'Guglielmo Marconi', role: 'Wireless Telegraphy', desc: 'Proved electromagnetic waves could carry messages across the Atlantic Ocean.', year: '1901', color: '#A5B4FC', imageUrl: '' },

    // ━━━ ERA II: Theory & Warfare Computing (1930s–1940s) ━━━
    { id: 'turing', name: 'Alan Turing', role: 'Father of Comp. Sci.', desc: 'Formalized concepts of algorithm and computation with the Turing Machine.', year: '1936', color: '#60A5FA', imageUrl: '' },
    { id: 'shannon', name: 'Claude Shannon', role: 'Information Theory', desc: 'Defined the mathematical foundations of digital communication and data encoding.', year: '1948', color: '#38BDF8', imageUrl: '' },
    { id: 'zuse', name: 'Konrad Zuse', role: 'Z3 Computer', desc: 'Built the world\'s first programmable, fully automatic digital computer.', year: '1941', color: '#D4D4D8', imageUrl: '' },
    { id: 'lamarr', name: 'Hedy Lamarr', role: 'Frequency Hopping', desc: 'Co-invented spread-spectrum technology that underpins modern Wi-Fi and Bluetooth.', year: '1942', color: '#F9A8D4', imageUrl: '' },
    { id: 'vonneumann', name: 'John von Neumann', role: 'Computer Architecture', desc: 'Defined the stored-program architecture that nearly every modern computer follows.', year: '1945', color: '#818CF8', imageUrl: '' },
    { id: 'bush', name: 'Vannevar Bush', role: 'As We May Think', desc: 'Envisioned the Memex — a hyperlinked knowledge machine that inspired the web.', year: '1945', color: '#FDE68A', imageUrl: '' },

    // ━━━ ERA III: Languages & Operating Systems (1950s–1970s) ━━━
    { id: 'hopper', name: 'Grace Hopper', role: 'Compiler Pioneer', desc: 'Created the first compiler and championed machine-independent programming languages.', year: '1952', color: '#34D399', imageUrl: '' },
    { id: 'backus', name: 'John Backus', role: 'FORTRAN', desc: 'Led the design of FORTRAN, the first widely used high-level programming language.', year: '1957', color: '#6EE7B7', imageUrl: '' },
    { id: 'mccarthy', name: 'John McCarthy', role: 'AI & Lisp', desc: 'Coined "Artificial Intelligence" and created Lisp, the language of symbolic reasoning.', year: '1958', color: '#A78BFA', imageUrl: '' },
    { id: 'sutherland', name: 'Ivan Sutherland', role: 'Father of Graphics', desc: 'Created Sketchpad, the forerunner of modern CAD and GUI.', year: '1963', color: '#C4B5FD', imageUrl: '' },
    { id: 'engelbart', name: 'Douglas Engelbart', role: 'The Mother of All Demos', desc: 'Pioneered the mouse, GUI, and collaborative computing in a legendary 1968 demo.', year: '1968', color: '#86EFAC', imageUrl: '' },
    { id: 'dijkstra', name: 'Edsger Dijkstra', role: 'Structured Programming', desc: 'Championed formal methods and shortest-path algorithms that power every GPS.', year: '1968', color: '#93C5FD', imageUrl: '' },
    { id: 'knuth', name: 'Donald Knuth', role: 'Art of Programming', desc: 'Authored the definitive reference on algorithms and invented TeX typesetting.', year: '1968', color: '#FCA5A5', imageUrl: '' },
    { id: 'thompson', name: 'Ken Thompson', role: 'Unix', desc: 'Co-created Unix and the B language — the bedrock of modern operating systems.', year: '1969', color: '#D1D5DB', imageUrl: '' },
    { id: 'hamilton', name: 'Margaret Hamilton', role: 'Apollo Software', desc: 'Led the software engineering for Apollo 11 — coined the term "software engineering".', year: '1969', color: '#FDE68A', imageUrl: '' },
    { id: 'kay', name: 'Alan Kay', role: 'OOP & Dynabook', desc: 'Pioneered object-oriented programming and envisioned the personal computer as a medium.', year: '1972', color: '#FBBF24', imageUrl: '' },
    { id: 'ritchie', name: 'Dennis Ritchie', role: 'C Language', desc: 'Created the C programming language and co-developed Unix — foundations of modern software.', year: '1972', color: '#E5E7EB', imageUrl: '' },

    // ━━━ ERA IV: Networks & Personal Computing (1970s–1990s) ━━━
    { id: 'cerf', name: 'Vint Cerf', role: 'TCP/IP', desc: 'Co-designed TCP/IP, the protocol suite that makes the internet possible.', year: '1974', color: '#38BDF8', imageUrl: '' },
    { id: 'wozniak', name: 'Steve Wozniak', role: 'Apple I', desc: 'Single-handedly designed the Apple I & II, sparking the personal computer revolution.', year: '1976', color: '#4ADE80', imageUrl: '' },
    { id: 'stallman', name: 'Richard Stallman', role: 'Free Software', desc: 'Founded the GNU project and the FSF, championing software freedom for all.', year: '1983', color: '#F87171', imageUrl: '' },
    { id: 'stroustrup', name: 'Bjarne Stroustrup', role: 'C++', desc: 'Extended C with object-oriented features, creating the language that powers games and systems.', year: '1985', color: '#7DD3FC', imageUrl: '' },
    { id: 'berners-lee', name: 'Tim Berners-Lee', role: 'Inventor of WWW', desc: 'Created the World Wide Web, giving humanity a shared knowledge space.', year: '1989', color: '#FBBF24', imageUrl: '' },
    { id: 'lecun', name: 'Yann LeCun', role: 'Convolutional Nets', desc: 'Pioneered convolutional neural networks that now power image recognition worldwide.', year: '1989', color: '#A78BFA', imageUrl: '' },

    // ━━━ ERA V: The Web & Open Source (1990s–2000s) ━━━
    { id: 'torvalds', name: 'Linus Torvalds', role: 'Linux & Git', desc: 'Created Linux and Git — the operating system and version control behind modern dev.', year: '1991', color: '#FACC15', imageUrl: '' },
    { id: 'vanrossum', name: 'Guido van Rossum', role: 'Python', desc: 'Designed Python for readability and simplicity, now the world\'s most popular language.', year: '1991', color: '#34D399', imageUrl: '' },
    { id: 'andreessen', name: 'Marc Andreessen', role: 'Mosaic Browser', desc: 'Built Mosaic, the first graphical web browser that brought the internet to the masses.', year: '1993', color: '#60A5FA', imageUrl: '' },
    { id: 'huang', name: 'Jensen Huang', role: 'GPU Computing', desc: 'Founded NVIDIA and transformed graphics processors into the engines of AI.', year: '1993', color: '#4ADE80', imageUrl: '' },
    { id: 'gosling', name: 'James Gosling', role: 'Java', desc: 'Created Java — "write once, run anywhere" — powering billions of devices.', year: '1995', color: '#F97316', imageUrl: '' },
    { id: 'eich', name: 'Brendan Eich', role: 'JavaScript', desc: 'Created JavaScript in 10 days — now the language of the web, running in every browser.', year: '1995', color: '#FDE047', imageUrl: '' },
    { id: 'page', name: 'Larry Page', role: 'Google & PageRank', desc: 'Co-founded Google and invented PageRank, organizing the world\'s information.', year: '1998', color: '#F472B6', imageUrl: '' },
    { id: 'wales', name: 'Jimmy Wales', role: 'Wikipedia', desc: 'Created Wikipedia — the largest free encyclopedia, written collaboratively by humanity.', year: '2001', color: '#D1D5DB', imageUrl: '' },

    // ━━━ ERA VI: AI & The Future (2000s–Present) ━━━
    { id: 'hinton', name: 'Geoffrey Hinton', role: 'Deep Learning', desc: 'Godfather of deep learning — his backpropagation breakthroughs ignited the AI revolution.', year: '2006', color: '#C084FC', imageUrl: '' },
    { id: 'bengio', name: 'Yoshua Bengio', role: 'Neural Networks', desc: 'Advanced deep learning theory and generative models, sharing the Turing Award.', year: '2003', color: '#A78BFA', imageUrl: '' },
    { id: 'nakamoto', name: 'Satoshi Nakamoto', role: 'Bitcoin & Blockchain', desc: 'Published the Bitcoin whitepaper — decentralized trust without central authority.', year: '2008', color: '#F59E0B', imageUrl: '' },
    { id: 'feifei', name: 'Fei-Fei Li', role: 'ImageNet', desc: 'Created ImageNet, the dataset that benchmarked and accelerated computer vision breakthroughs.', year: '2009', color: '#EC4899', imageUrl: '' },
    { id: 'hassabis', name: 'Demis Hassabis', role: 'DeepMind & AlphaGo', desc: 'Founded DeepMind, whose AlphaGo defeated the world champion — a watershed moment for AI.', year: '2010', color: '#2DD4BF', imageUrl: '' },
    { id: 'karpathy', name: 'Andrej Karpathy', role: 'Neural Net Educator', desc: 'Democratized deep learning through legendary lectures and open-source implementations.', year: '2015', color: '#FB923C', imageUrl: '' },
    { id: 'amodei', name: 'Dario Amodei', role: 'AI Safety', desc: 'Founded Anthropic to pursue safe, interpretable AI systems that align with human values.', year: '2021', color: '#D4A574', imageUrl: '' },
    { id: 'altman', name: 'Sam Altman', role: 'ChatGPT & OpenAI', desc: 'Led OpenAI through the release of ChatGPT, bringing large language models to the world.', year: '2022', color: '#86EFAC', imageUrl: '' },
    { id: 'su', name: 'Lisa Su', role: 'AMD Renaissance', desc: 'Transformed AMD from near-bankruptcy into a computing powerhouse rivaling Intel and NVIDIA.', year: '2014', color: '#F87171', imageUrl: '' },
];
