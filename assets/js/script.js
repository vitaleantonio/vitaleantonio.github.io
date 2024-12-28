document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.getElementById("nav-links");
    const hamburgerMenu = document.getElementById("hamburger-menu");
    const navbar = document.querySelector(".navbar");
    const logo = document.querySelector(".nav-logo");

    hamburgerMenu.addEventListener("click", () => {
        navLinks.classList.toggle("show");
    });

    function checkOverflow() {
        if (window.innerWidth > 768) {
            const linksWidth = navLinks.scrollWidth;
            const navbarWidth = navbar.offsetWidth;
            const logoWidth = logo.offsetWidth;

            if (logoWidth + linksWidth > navbarWidth) {
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
