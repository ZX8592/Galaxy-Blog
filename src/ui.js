import blogPosts, { starData } from './blogData.js';
import { playHoverSound, playClickSound } from './audio.js';

/**
 * UI controller — manages blog overlay, HUD, focus dots, star homepage, and secondary view UI.
 */
export class UI {
    constructor(totalTargets) {
        this.overlay = document.getElementById('blog-overlay');
        this.closeBtn = document.getElementById('blog-close');
        this.titleEl = this.overlay.querySelector('.blog-title');
        this.metaEl = this.overlay.querySelector('.blog-meta');
        this.bodyEl = this.overlay.querySelector('.blog-body');

        this.hudEl = document.getElementById('planet-hud');
        this.nameEl = this.hudEl.querySelector('.planet-name');
        this.subtitleEl = this.hudEl.querySelector('.planet-subtitle');

        this.starHome = document.getElementById('star-home');
        this.backBtn = document.getElementById('back-btn');

        // Populate Star Home static text
        const shLabel = this.starHome.querySelector('.star-home-label');
        const shTitle = this.starHome.querySelector('.star-home-title');
        const shTagline = this.starHome.querySelector('.star-home-tagline');
        const shHint = this.starHome.querySelector('#star-hint');

        if (shLabel) shLabel.textContent = starData.label || '';
        if (shTitle) shTitle.textContent = starData.title || '';
        if (shTagline) shTagline.textContent = starData.meta || '';
        if (shHint) shHint.textContent = starData.hint || '← 点击恒星查看更多 →';

        // Calculate dynamic stats
        const planetCount = blogPosts.length;
        let totalContent = planetCount;
        blogPosts.forEach(p => { if (p.moons) totalContent += p.moons.length; });

        const statPlanets = this.starHome.querySelector('#stat-planets');
        const statContents = this.starHome.querySelector('#stat-contents');
        if (statPlanets) statPlanets.textContent = `⬡ ${planetCount} 颗行星`;
        if (statContents) statContents.textContent = starData.statsText || `✧ ${totalContent} 篇内容`;

        this.isOpen = false;
        this.totalTargets = totalTargets;
        this.inSecondary = false;
        this._handleResize = () => this._applyHeroScale();

        // Secondary view dots
        this.secondaryDotsContainer = null;

        this._createDots();
        this._applyHeroScale();

        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        window.addEventListener('resize', this._handleResize);
        // Attach sound effects to interactive elements
        this._attachSounds();
    }

    _applyHeroScale() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const scale = Math.max(0.68, Math.min(1.52, Math.min(width / 1440, height / 920)));
        this.starHome.style.setProperty('--hero-scale', scale.toFixed(3));
        this.starHome.classList.toggle('compact', width < 1280 || height < 820);
        this.starHome.classList.toggle('tight', width < 1080 || height < 700);
    }

    _attachSounds() {
        // UI sounds for the overlay
        this.closeBtn.addEventListener('mouseenter', playHoverSound);
        this.closeBtn.addEventListener('click', playClickSound);
        
        // Back button
        if (this.backBtn) {
            this.backBtn.addEventListener('mouseenter', playHoverSound);
            this.backBtn.addEventListener('click', playClickSound);
        }

        // Star Home click area shouldn't probably play hover noise since it covers the screen unless it's a specific button
        // But we can add hover to the HUD overall area or specific tags when they are created
    }

    _createDots() {
        const container = document.createElement('div');
        container.id = 'focus-dots';
        for (let i = 0; i < this.totalTargets; i++) {
            const dot = document.createElement('div');
            dot.className = 'focus-dot';
            if (i === 0) dot.classList.add('star-dot');
            dot.dataset.index = i;
            
            dot.addEventListener('mouseenter', playHoverSound);
            dot.addEventListener('click', playClickSound);
            container.appendChild(dot);
        }
        document.body.appendChild(container);
        this.dotsContainer = container;
    }

    showStarHome(visible) {
        if (visible) {
            this.starHome.classList.add('visible');
            this.hudEl.style.opacity = '0';
        } else {
            this.starHome.classList.remove('visible');
            this.hudEl.style.opacity = '1';
        }
    }

    updateHUD(target) {
        if (this.inSecondary) return;

        const { name, subtitle } = target.config || target;
        this.nameEl.textContent = name || '';
        this.subtitleEl.textContent = subtitle || '';

        let activeIndex = target.isStar ? 0 : target.index + 1;
        const dots = this.dotsContainer.querySelectorAll('.focus-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === activeIndex);
        });
    }

    // ---- Secondary view UI ----

    /**
     * Enter secondary view UI mode.
     * Shows back button, creates secondary dots, hides galaxy dots.
     */
    enterSecondary(post, planetIdx) {
        this.inSecondary = true;
        this.dotsContainer.style.display = 'none';
        this.backBtn.classList.add('visible');
        this.hudEl.style.opacity = '1';

        // Create secondary dots
        const totalItems = 1 + (post.moons ? post.moons.length : 0);
        if (this.secondaryDotsContainer) {
            this.secondaryDotsContainer.remove();
        }
        const container = document.createElement('div');
        container.id = 'secondary-dots';
        container.className = 'focus-dots-row';
        for (let i = 0; i < totalItems; i++) {
            const dot = document.createElement('div');
            dot.className = 'focus-dot';
            if (i === 0) dot.classList.add('planet-parent-dot');
            dot.dataset.index = i;
            
            dot.addEventListener('mouseenter', playHoverSound);
            dot.addEventListener('click', playClickSound);
            container.appendChild(dot);
        }
        document.body.appendChild(container);
        this.secondaryDotsContainer = container;
    }

    /** Update HUD for secondary view items */
    updateSecondaryHUD(item) {
        this.nameEl.textContent = item.name || '';
        this.subtitleEl.textContent = item.isMoon ? '🌙 卫星' : '🪐 行星';

        // Update secondary dots
        if (this.secondaryDotsContainer) {
            const dots = this.secondaryDotsContainer.querySelectorAll('.focus-dot');
            const items = document.querySelectorAll('#secondary-dots .focus-dot');
            items.forEach((dot, i) => {
                const isActive = (item.isMoon ? (item.moonIndex + 1) : 0) === i;
                dot.classList.toggle('active', isActive);
            });
        }
    }

    /** Exit secondary view UI mode */
    exitSecondary() {
        this.inSecondary = false;
        this.dotsContainer.style.display = '';
        this.backBtn.classList.remove('visible');

        if (this.secondaryDotsContainer) {
            this.secondaryDotsContainer.remove();
            this.secondaryDotsContainer = null;
        }
    }

    // ---- Content overlays ----

    openStar() {
        this.titleEl.textContent = starData.title;
        this.metaEl.textContent = starData.meta;
        this.bodyEl.innerHTML = starData.body;
        this.overlay.classList.remove('hidden');
        this.isOpen = true;
    }

    open(planetIndex) {
        const post = blogPosts[planetIndex];
        if (!post) return;
        this._renderContent({
            name: post.name,
            subtitle: post.date ? `${post.date} · ${post.subtitle}` : post.subtitle,
            content: post.content,
            type: post.type,
            url: post.url
        });
    }

    /** Open content for a secondary view item (planet or moon) */
    openSecondaryContent(item) {
        this._renderContent({
            name: item.name,
            subtitle: item.isMoon ? '🌙 卫星内容' : (item.date ? `${item.date} · ${item.subtitle}` : '🪐 行星内容'),
            content: item.content,
            type: item.type, // Make sure secondaryView items pass this along, see Note
            url: item.url
        });
    }

    _renderContent(item) {
        this.titleEl.textContent = item.name;
        this.metaEl.textContent = item.subtitle || '';

        const panel = this.overlay.querySelector('.blog-panel');
        
        if (item.type === 'iframe' && item.url) {
            this.bodyEl.innerHTML = `<iframe src="${item.url}" style="width: 100%; height: 65vh; border: none; border-radius: 8px;"></iframe>`;
            panel.classList.add('large-panel');
        } else if (item.type === 'link' && item.url) {
            this.bodyEl.innerHTML = `<h2><a href="${item.url}" target="_blank" style="color: #6ec6ff;">点击此处在新标签页打开链接</a></h2><p>${item.content || ''}</p>`;
            panel.classList.remove('large-panel');
        } else {
            this.bodyEl.innerHTML = item.content;
            panel.classList.remove('large-panel');
        }

        this.overlay.classList.remove('hidden');
        this.isOpen = true;
    }

    close() {
        this.overlay.classList.add('hidden');
        this.isOpen = false;
    }
}
