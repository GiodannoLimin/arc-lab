# Arc Lab implementation

1. Establish SI coordinates (y up, hoop at x=z=0), regulation geometry presets, analytical trajectory, independent RK4 integrator, minimum-speed solution, continuous finite-sphere clearance, and validation tests.
2. Render a regulation court and ball with React Three Fiber; animate positions from the closed-form solution; add cameras, trajectory measurements, and release controls.
3. Run seeded correlated Gaussian release experiments in a Web Worker. Search a declared bounded angle/speed/direction grid with common random numbers, then independently validate the selected strategy and minimum-speed baseline. Report Wilson intervals and sensitivity experiments.
4. Present physics and probability together, add recording layout, export reproducible experiment data, and document assumptions and search limits.

Architecture: static Vite + React + TypeScript, Three.js/R3F. Pure scientific modules never import rendering libraries. No backend required. Numerical integration validates the analytical trajectory; rendering uses exact evaluations, avoiding frame-rate-dependent integration error.
