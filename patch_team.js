const fs = require('fs');

const css = `
/* ===== TEAM BANNER & PAGE ===== */
.team-banner {
    background: radial-gradient(circle at right center, rgba(212, 175, 55, 0.15), transparent 60%), #000;
    padding: 100px 5%;
    border-bottom: 2px solid rgba(212, 175, 55, 0.2);
    display: flex;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.team-banner-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 1300px;
    gap: 40px;
    position: relative;
    z-index: 2;
}

.team-brand img {
    max-width: 400px;
    width: 100%;
    filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.4));
}

.team-portraits {
    display: flex;
    gap: 8px;
    align-items: center;
}

.portrait-frame {
    width: 160px;
    height: 230px;
    border: 3px solid var(--accent-gold);
    padding: 4px;
    border-radius: 2px;
    background: rgba(0,0,0,0.9);
    box-shadow: 0 15px 35px rgba(212, 175, 55, 0.2);
    overflow: hidden;
    position: relative;
}

.portrait-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(100%) contrast(115%) brightness(0.9);
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.portrait-frame:hover img {
    filter: grayscale(0%) contrast(100%) brightness(1);
    transform: scale(1.1);
}

.team-members {
    padding: 80px 0;
    background: #000;
}

.team-member {
    margin-bottom: 120px;
}

.team-member.reverse {
    flex-direction: row-reverse;
}

.full-bio p {
    font-size: 1.15rem;
    line-height: 1.8;
}

@media (max-width: 1100px) {
    .team-banner-content {
        flex-direction: column;
        text-align: center;
        gap: 60px;
    }
    
    .team-portraits {
        flex-wrap: wrap;
        justify-content: center;
    }
    
    .portrait-frame {
        width: 140px;
        height: 200px;
    }
}

@media (max-width: 768px) {
    .team-member.reverse {
        flex-direction: column;
    }
    .team-brand img {
        max-width: 300px;
    }
    .portrait-frame {
        width: 45%;
        height: 220px;
        margin-bottom: 5px;
    }
}
`;

const htmlReplacement = `<main>
        <!-- Team Banner Section -->
        <section class="team-banner">
            <div class="team-banner-content">
                <div class="team-brand">
                    <img src="logo.png" alt="Quantara Alpha Enterprise Logo">
                </div>
                <div class="team-portraits">
                    <div class="portrait-frame"><img src="favour1.jpeg" alt="Favour" onerror="this.src='founder.jpg'"></div>
                    <div class="portrait-frame"><img src="grace.jpeg" alt="Grace" onerror="this.src='founder.jpg'"></div>
                    <div class="portrait-frame"><img src="jerry.jpeg" alt="Jerry" onerror="this.src='founder.jpg'"></div>
                    <div class="portrait-frame"><img src="favour2.jpeg" alt="Favour" onerror="this.src='founder.jpg'"></div>
                </div>
            </div>
        </section>

        <!-- Our Team (Introductions) -->
        <section class="team-members">
            <h2 class="section-title" style="margin-bottom: 80px;">Meet The Team</h2>

            <!-- Original Founder Favour -->
            <div class="founder-container team-member">
                <div class="founder-image">
                    <img src="favour1.jpeg" alt="Favour Danladi - Founder" class="rotate-on-scroll" onerror="this.src='founder.jpg'">
                </div>
                <div class="founder-info">
                    <p class="founder-tagline">Visionary behind Quantara Alpha Enterprise</p>
                    <h1 class="founder-name">Favour Danladi</h1>
                    <div class="founder-vision-mission">
                        <div class="statement-card">
                            <h3>Mission Statement</h3>
                            <p>To provide structured, practical, and disciplined financial education in cryptocurrency and digital assets, empowering individuals to make informed investment decisions through knowledge, risk management, and long-term strategy.</p>
                        </div>
                        <div class="statement-card">
                            <h3>Vision Statement</h3>
                            <p>To become a leading digital financial education ecosystem that transforms beginners into disciplined asset builders and expands beyond cryptocurrency into multi-asset wealth education across Africa and globally.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Team Member: Grace -->
            <div class="founder-container team-member reverse">
                <div class="founder-image">
                    <img src="grace.jpeg" alt="Grace" class="rotate-on-scroll" onerror="this.src='founder.jpg'">
                </div>
                <div class="founder-info">
                    <p class="founder-tagline">Partner / Director</p>
                    <h1 class="founder-name">Grace</h1>
                    <div class="statement-card full-bio">
                        <p>Grace plays a pivotal role in the operations and growth strategy at Quantara Alpha Enterprise. She ensures that the entire learning ecosystem remains efficient, supportive, and completely focused on student success.</p>
                    </div>
                </div>
            </div>

            <!-- Team Member: Jerry -->
            <div class="founder-container team-member">
                <div class="founder-image">
                    <img src="jerry.jpeg" alt="Jerry" class="rotate-on-scroll" onerror="this.src='founder.jpg'">
                </div>
                <div class="founder-info">
                    <p class="founder-tagline">Community Strategist</p>
                    <h1 class="founder-name">Jerry</h1>
                    <div class="statement-card full-bio">
                        <p>Jerry is instrumental in shaping our community strategy and ecosystem development. He coordinates our growing network of members and ensures each individual has access to the resources needed to excel.</p>
                    </div>
                </div>
            </div>

            <!-- Team Member: Favour (Second) -->
            <div class="founder-container team-member reverse">
                <div class="founder-image">
                    <img src="favour2.jpeg" alt="Favour" class="rotate-on-scroll" onerror="this.src='founder.jpg'">
                </div>
                <div class="founder-info">
                    <p class="founder-tagline">Core Analyst</p>
                    <h1 class="founder-name">Favour</h1>
                    <div class="statement-card full-bio">
                        <p>Favour brings extensive financial expertise and immense dedication to the Quantara Alpha mission. Working alongside the team, she meticulously tracks market trends to provide deep, actionable insights to our traders.</p>
                    </div>
                </div>
            </div>
        </section>
    </main>`;

let founderHtml = fs.readFileSync('founder.html', 'utf8');
founderHtml = founderHtml.replace(/<main>[\s\S]*?<\/main>/, htmlReplacement);
founderHtml = founderHtml.replace(/<title>.*?<\/title>/, '<title>Our Team | Quantara Alpha Enterprise</title>');
fs.writeFileSync('founder.html', founderHtml, 'utf8');

let styleCss = fs.readFileSync('style.css', 'utf8');
if(!styleCss.includes('.team-banner')) {
    styleCss += '\\n' + css;
    fs.writeFileSync('style.css', styleCss, 'utf8');
}
console.log('Done mapping founder.html to team grid!');
