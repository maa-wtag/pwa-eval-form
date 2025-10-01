# pwa-eval-form

## How to run

Step - 1: In one terminal run: `docker compose up -d --build` 

after this run: `docker logs -f eval-graphql`

this will show `GraphQL listening on :4000`

Step - 2: In another terminal run: `SW=true npm run build`

after this run: `npm run preview`

this will open the project in `http://localhost:4173/`

Step - 3: In another terminal run: `SW_DEV=true VITE_ENABLE_DEV_SW=true npm run dev`

this will open the app in dev mode in `http://localhost:3000/`
