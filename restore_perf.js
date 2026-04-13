const fs = require('fs');

const mainPath = 'main.js';
const adminPath = 'admin.js';
const stylePath = 'style.css';

let main = fs.readFileSync(mainPath, 'utf8');
let admin = fs.readFileSync(adminPath, 'utf8');
let style = fs.readFileSync(stylePath, 'utf8');

// fix main.js scroll
if (main.includes('window.addEventListener("scroll", () => applyRotation(window.scrollY));')) {
    main = main.replace(
        /const applyRotation = \(y\) => {[\s\S]*?window\.addEventListener\("scroll", \(\) => applyRotation\(window\.scrollY\)\);/m,
        `const rotateElements = document.querySelectorAll(".rotate-on-scroll");
  let ticking = false;

  const applyRotation = (y) => {
    const rotation = y * 0.5;
    rotateElements.forEach(el => {
      el.style.transform = \`rotateY(\$\{rotation\}deg)\`;
    });
    ticking = false;
  };

  const onScroll = (y) => {
    if (!ticking && rotateElements.length > 0) {
      window.requestAnimationFrame(() => applyRotation(y));
      ticking = true;
    }
  };

  window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });`
    );
    main = main.replace(
        'dashContent.addEventListener("scroll", () => applyRotation(dashContent.scrollTop));',
        'dashContent.addEventListener("scroll", () => onScroll(dashContent.scrollTop), { passive: true });'
    );
    fs.writeFileSync(mainPath, main);
}

// fix admin.js scroll
if (admin.includes('window.addEventListener("scroll", () => applyRotation(window.scrollY));')) {
    admin = admin.replace(
        /const applyRotation = \(y\) => {[\s\S]*?window\.addEventListener\("scroll", \(\) => applyRotation\(window\.scrollY\)\);/m,
        `const rotateElements = document.querySelectorAll(".rotate-on-scroll");
            let ticking = false;

            const applyRotation = (y) => {
                const rotation = y * 0.5;
                rotateElements.forEach(el => {
                    el.style.transform = \`rotateY(\$\{rotation\}deg)\`;
                });
                ticking = false;
            };

            const onScroll = (y) => {
                if (!ticking && rotateElements.length > 0) {
                    window.requestAnimationFrame(() => applyRotation(y));
                    ticking = true;
                }
            };

            window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });`
    );
    admin = admin.replace(
        'dashContent.addEventListener("scroll", () => applyRotation(dashContent.scrollTop));',
        'dashContent.addEventListener("scroll", () => onScroll(dashContent.scrollTop), { passive: true });'
    );
    fs.writeFileSync(adminPath, admin);
}

// remove transition from .rotate-on-scroll
if (style.includes('transition: transform 0.1s ease-out;')) {
    style = style.replace(
        `.rotate-on-scroll {
  transition: transform 0.1s ease-out;
  will-change: transform;
  transform-style: preserve-3d;
}`, 
        `.rotate-on-scroll {
  will-change: transform;
  transform-style: preserve-3d;
}`
    );
    fs.writeFileSync(stylePath, style);
}
