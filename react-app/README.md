The frontend: React 18 and TypeScript, built and served in development by [Vite](https://vite.dev/), tested with [Vitest](https://vitest.dev/) and Testing Library. It moved off Create React App, which is no longer maintained, in #138.

Run `npm install` once, then:

- `npm start`: the development server, at http://localhost:3000. It sends `/api` requests on to the Flask server on port 5000 (`vite.config.ts`), so run `flask run` alongside it.
- `npx tsc`: type-check.
- `npx vitest run`: the tests, once (`npm test` watches).
- `npm run build`: type-check and build into `build/`, which is where Flask serves the app from in production.

No environment variables are needed. In production, Flask serves the built frontend and the API from the same origin, and Render builds it on every deploy.
