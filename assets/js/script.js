document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.getElementById("nav-links");
    const hamburgerMenu = document.getElementById("hamburger-menu");
    const navbar = document.querySelector(".navbar");
    const themeToggle = document.getElementById("theme-toggle");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    hamburgerMenu.addEventListener("click", () => {
        navLinks.classList.toggle("show");
    });

    function setTheme(theme) {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem("theme", theme);
        } catch (e) {}
    }

    // The new theme spreads out in a circle from the toggle button
    themeToggle.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";

        if (!document.startViewTransition || reduceMotion) {
            setTheme(next);
            return;
        }

        const rect = themeToggle.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

        // While switching theme the page is revealed as one piece (see .theme-switching in style.css)
        document.documentElement.classList.add("theme-switching");
        const transition = document.startViewTransition(() => setTheme(next));
        transition.finished.finally(() => document.documentElement.classList.remove("theme-switching"));
        transition.ready.then(() => {
            document.documentElement.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: 600, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" }
            );
        });
    });

    // Row spotlight follows the cursor
    document.addEventListener("pointermove", (event) => {
        const card = event.target.closest(".publication-card");
        if (!card) return;

        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });

    // Search box and filter chips above the publications list
    function setupListFilter({ anchor, sections, groupOf, noun, placeholder }) {
        const entries = sections.flatMap((section) =>
            [...section.querySelectorAll(".publication-card")].map((el) => ({
                el,
                group: groupOf(el),
                // Full venue names live in title attributes, so they are searchable too
                text: [el.textContent, ...[...el.querySelectorAll("[title]")].map((node) => node.title)]
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .toLowerCase(),
            }))
        );
        const groups = [...new Set(entries.map((entry) => entry.group))];
        let activeGroup = null;

        const tools = document.createElement("div");
        tools.className = "list-tools";
        tools.innerHTML = `
            <label class="list-search">
                <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                <input type="search" autocomplete="off" spellcheck="false">
                <kbd>/</kbd>
            </label>
            <div class="list-chips" role="group"></div>`;
        const input = tools.querySelector("input");
        input.placeholder = placeholder;
        input.setAttribute("aria-label", placeholder);
        tools.querySelector(".list-chips").setAttribute("aria-label", `Filter ${noun}`);

        const status = document.createElement("p");
        status.className = "list-status";
        status.setAttribute("aria-live", "polite");
        anchor.before(tools, status);

        const chips = [null, ...groups].map((group) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip";
            chip.append(group ?? "All", " ", document.createElement("span"));
            chip.addEventListener("click", () => {
                activeGroup = group;
                update();
            });
            tools.querySelector(".list-chips").append(chip);
            return { chip, group };
        });

        const counts = sections.map((section) => {
            const count = document.createElement("span");
            count.className = "section-count";
            section.querySelector("h2").append(count);
            return { section, count };
        });

        const canHighlight = window.CSS && CSS.highlights && typeof Highlight === "function";

        function highlight(words) {
            if (!canHighlight) return;
            const ranges = [];
            entries.forEach(({ el }) => {
                if (el.hidden) return;
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                while (walker.nextNode()) {
                    const node = walker.currentNode;
                    const text = node.data.toLowerCase();
                    words.forEach((word) => {
                        for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + word.length)) {
                            const range = new Range();
                            range.setStart(node, i);
                            range.setEnd(node, i + word.length);
                            ranges.push(range);
                        }
                    });
                }
            });
            CSS.highlights.set("search", new Highlight(...ranges));
        }

        function update() {
            const words = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
            const matches = entries.filter((entry) => words.every((word) => entry.text.includes(word)));

            entries.forEach((entry) => {
                entry.el.hidden = !matches.includes(entry) || (activeGroup !== null && entry.group !== activeGroup);
            });
            chips.forEach(({ chip, group }) => {
                chip.setAttribute("aria-pressed", group === activeGroup);
                chip.querySelector("span").textContent = matches.filter((entry) => group === null || entry.group === group).length;
            });
            counts.forEach(({ section, count }) => {
                const shown = section.querySelectorAll(".publication-card:not([hidden])").length;
                count.textContent = shown;
                section.hidden = shown === 0;
            });

            const shown = entries.filter((entry) => !entry.el.hidden).length;
            if (shown === 0) {
                status.textContent = `No ${noun} match your search.`;
            } else if (shown < entries.length) {
                status.textContent = `Showing ${shown} of ${entries.length} ${noun}`;
            } else {
                status.textContent = "";
            }
            highlight(words);
        }

        input.addEventListener("input", update);
        input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                input.value = "";
                update();
            }
        });
        // "/" jumps to the search box
        document.addEventListener("keydown", (event) => {
            if (event.key === "/" && !event.target.closest("input, textarea")) {
                event.preventDefault();
                input.focus();
            }
        });
        update();
    }

    const publications = document.querySelector(".publications-columns");
    if (publications) {
        setupListFilter({
            anchor: publications,
            sections: [...publications.querySelectorAll(".page-section")],
            groupOf: (card) => card.closest(".page-section").querySelector("h2").textContent.trim(),
            noun: "publications",
            placeholder: "Search by title, author or venue",
        });
    }

    // Animated background behind every page, drawn by a scene (resize, move, draw)
    function startBackground(scene) {
        const canvas = document.createElement("canvas");
        canvas.className = "bg-canvas";
        canvas.setAttribute("aria-hidden", "true");
        document.body.prepend(canvas);

        const ctx = canvas.getContext("2d");
        const pointer = { x: -1e4, y: -1e4, active: false };
        let width = 0;
        let height = 0;
        let color = "";

        function readColor() {
            color = getComputedStyle(document.documentElement).getPropertyValue("--bg-line").trim();
        }

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            scene.resize(width, height);
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            scene.draw(ctx, pointer);
        }

        readColor();
        resize();
        scene.move(0, pointer);
        draw();

        new MutationObserver(() => {
            readColor();
            draw();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        window.addEventListener("resize", () => {
            resize();
            draw();
        });

        window.addEventListener("pointermove", (event) => {
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            pointer.active = true;
        });
        document.documentElement.addEventListener("pointerleave", () => {
            pointer.x = pointer.y = -1e4;
            pointer.active = false;
        });

        // Slow, faint ambient motion, so it keeps running (at half speed) even with reduced motion
        const pace = reduceMotion ? 0.5 : 1;

        // About 30 frames per second is smooth enough for slow motion. rAF pauses in background
        // tabs, and the elapsed time is capped so nothing jumps when the tab comes back.
        let last = performance.now();
        requestAnimationFrame(function frame(time) {
            if (time - last >= 30) {
                scene.move((Math.min(time - last, 100) / 1000) * pace, pointer);
                last = time;
                draw();
            }
            requestAnimationFrame(frame);
        });
    }

    // Faint network of drifting points, linked when close
    function networkScene() {
        const linkDistance = 150;
        const points = [];
        let width = 0;
        let height = 0;

        function line(ctx, a, b, alpha) {
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        return {
            // Keep the existing points on resize so mobile scrolling does not reshuffle them
            resize(w, h) {
                width = w;
                height = h;
                const count = Math.min(120, Math.round((width * height) / 18000));
                while (points.length < count) {
                    // Random direction at 10-24 px per second
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 10 + Math.random() * 14;
                    points.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                    });
                }
                points.length = count;
            },

            // Advance by elapsed seconds, bouncing off the edges of the window
            move(seconds) {
                points.forEach((p) => {
                    p.x += p.vx * seconds;
                    p.y += p.vy * seconds;
                    if (p.x < 0 || p.x > width) p.vx = Math.abs(p.vx) * (p.x < 0 ? 1 : -1);
                    if (p.y < 0 || p.y > height) p.vy = Math.abs(p.vy) * (p.y < 0 ? 1 : -1);
                });
            },

            draw(ctx, pointer) {
                ctx.lineWidth = 1;
                points.forEach((a, i) => {
                    for (let j = i + 1; j < points.length; j++) {
                        const distance = Math.hypot(a.x - points[j].x, a.y - points[j].y);
                        if (distance < linkDistance) line(ctx, a, points[j], (1 - distance / linkDistance) * 0.5);
                    }
                    const toPointer = Math.hypot(a.x - pointer.x, a.y - pointer.y);
                    if (toPointer < linkDistance * 1.3) line(ctx, a, pointer, (1 - toPointer / (linkDistance * 1.3)) * 0.7);

                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.arc(a.x, a.y, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                });
            },
        };
    }

    startBackground(networkScene());

    // Entries fade in one after another as they scroll into view
    if ("IntersectionObserver" in window && !reduceMotion) {
        const observer = new IntersectionObserver((entries) => {
            entries
                .filter((entry) => entry.isIntersecting)
                .forEach((entry, i) => {
                    entry.target.style.setProperty("--reveal-delay", `${Math.min(i, 8) * 70}ms`);
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
        }, { rootMargin: "0px 0px -8% 0px" });

        document.querySelectorAll(".news h2, .page-section h2, .news li, .education-card, .publication-card").forEach((element) => {
            element.classList.add("reveal");
            observer.observe(element);
        });
    }

    function checkOverflow() {
        if (window.innerWidth > 768) {
            const linksWidth = navLinks.scrollWidth;
            const navbarWidth = navbar.offsetWidth;
            const toggleWidth = themeToggle.offsetWidth;

            if (linksWidth + toggleWidth > navbarWidth) {
                hamburgerMenu.style.display = "block";
                navLinks.classList.remove("show");
                navLinks.classList.add("hidden");
            } else {
                hamburgerMenu.style.display = "none";
                navLinks.classList.remove("hidden");
                navLinks.classList.remove("show");
            }
        } else {
            hamburgerMenu.style.display = "block";
            navLinks.classList.remove("hidden");
        }
    }

    window.addEventListener("load", checkOverflow);
    window.addEventListener("resize", checkOverflow);
});
