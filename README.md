# Dampal App Dev 2026

Applications Development and Emerging Technologies.

## Branches

- `main`: initial repository setup.
- [`Prelim-Exam`](https://github.com/jstredacted/dampal-app-dev-2026/tree/Prelim-Exam): To-Do List Application for the preliminary examination, branched from `main`.
- `rest-api-activity`: User Signup and Login Authentication System.
- `jwt-auth-routes`: JWT Auth Activity, in `jwt-auth-demo/`.
- `midterm-exam`: Midterm Exam blog platform (two Express servers and a frontend), in `blog-platform/`.
  See `blog-platform/README.md` on that branch.
- [`final-exam`](https://github.com/jstredacted/dampal-app-dev-2026/tree/final-exam): Final Exam,
  branched from `midterm-exam`. The same blog platform connected to MariaDB (through XAMPP)
  with a ReactJS frontend, in `blog-platform/`. See `blog-platform/README.md`.

## Run the final exam project

On the `final-exam` branch, start **MySQL** in the XAMPP control panel (and **Apache**
for phpMyAdmin), then from `blog-platform/`:

```sh
npm install
npm --prefix frontend install
npm run db:setup
```

Run each of these in its own terminal inside `blog-platform/`:

```sh
npm run start:auth     # Auth Server, http://127.0.0.1:4000
npm run start:blog     # Blog Server, http://127.0.0.1:5000
npm run dev:frontend   # React app, http://127.0.0.1:5180
```

Open **http://127.0.0.1:5180**. `blog-platform/README.md` covers the database tables,
endpoints, Postman collection, and tests.
