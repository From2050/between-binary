# Running with Docker 🐳

If you do not have Node.js installed locally, you can use Docker to run the environment (just like I did!).

## 1. Build Dependencies
Mount the folder and install `node_modules` into your local directory:

```bash
docker run --rm -v "${PWD}:/app" -w /app node:24-alpine npm install
```

## 2. Run the Dev Server
Start the server and expose port 4321:

```bash
docker run -p 4321:4321 -v "${PWD}:/app" -w /app node:24-alpine npm run dev -- --host
```

## 3. View the Site
Open your browser to: [http://localhost:4321](http://localhost:4321)

---
*Note: `${PWD}` works in PowerShell. On Mac/Linux use `$(pwd)`.*

## Troubleshooting
If you don't see the **Particle Animation** or **New Fonts** immediately:
1.  **Restart the Container**: Sometimes new files (like components) aren't picked up by the watcher in Docker.
    *   `Ctrl+C` to stop.
    *   Run the "Run the Dev Server" command again.
