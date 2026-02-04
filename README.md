# Vishak Marcil — Portfolio

A cinematic, interactive portfolio website for Vishak Marcil, a Germany-based photographer and editor. The site features a "Classic Chrome" aesthetic inspired by Fujifilm simulations, 3D camera interactions, and a masonry layout for showcasing works.

## Features

-   **Cinematic Design**: "Classic Chrome" color palette with film grain textures and editorial typography.
-   **Interactive 3D Camera**: A custom Three.js camera model with realistic materials (leather, glass, metal) that responds to mouse movement.
-   **Masonry Grid**: An editorial-style layout for the portfolio section using CSS columns.
-   **Smooth Scrolling**: Implemented with Lenis for a luxurious, inertial scroll feel.
-   **Lightbox Gallery**: Full-screen immersive image viewing with captions.
-   **Responsive**: Fully responsive design for mobile, tablet, and desktop.

## Tech Stack

-   **HTML5 / CSS3**: Semantic markup and modern CSS variables.
-   **JavaScript (ES6+)**: Logic for interactions and animations.
-   **Three.js**: For the 3D camera scene and rendering.
-   **GSAP**: For smooth scroll animations and reveals.
-   **Lenis**: For smooth scrolling inertia.
-   **Vite**: (Implicitly compatible if moved to a build step, currently static).

## Setup & Development

1.  Clone the repository:
    ```bash
    git clone https://github.com/kenshiros-projects/vishak-marcil-portfolio.git
    ```
2.  Navigate to the directory:
    ```bash
    cd vishak-marcil-portfolio
    ```
3.  Serve locally (using Python or any static server):
    ```bash
    python3 -m http.server 8000
    ```
4.  Open `http://localhost:8000` in your browser.

## Deploy

The site is optimized for deployment on Vercel, Netlify, or GitHub Pages.

## License

[MIT](LICENSE)
