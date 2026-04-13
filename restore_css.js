const fs = require('fs');

const stylePath = 'style.css';
const challengePath = 'challenge_restoration.css';

let styleContent = fs.readFileSync(stylePath, 'utf8');
const challengeContent = fs.readFileSync(challengePath, 'utf8');

// Append challenge content if not already there
if (!styleContent.includes('.challenge-separator')) {
  styleContent += '\n' + challengeContent;
}

// Admin mobile fixes replacement
const targetStr = `  .admin-founder-section {
    flex-direction: column;
    text-align: center;
  }

  .admin-founder-img {
    width: 80px;
    height: 80px;
  }`;

const replacementStr = `  /* Enhanced Admin Card Centering for Mobile */
  .dashboard-grid {
    display: flex !important;
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    width: 100%;
    padding: 0;
  }

  .dashboard-card {
    width: 100% !important;
    max-width: 100%;
    margin: 0 !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 25px 20px !important;
  }
  
  .stat-value {
    text-align: center !important;
    width: 100%;
    margin: 0 auto;
  }

  .welcome-text {
    text-align: center;
    width: 100%;
  }

  .welcome-text h1 {
    font-size: clamp(1.6rem, 8vw, 2.2rem) !important;
    margin-bottom: 15px;
  }

  .admin-founder-section {
    flex-direction: column;
    text-align: center;
    gap: 15px;
    padding: 25px;
    width: 100%;
  }

  .admin-founder-img {
    width: 90px;
    height: 90px;
    margin: 0 auto;
  }`;

if (styleContent.includes(targetStr)) {
  styleContent = styleContent.replace(targetStr, replacementStr);
}

fs.writeFileSync(stylePath, styleContent, 'utf8');
console.log('Style updated successfully.');
