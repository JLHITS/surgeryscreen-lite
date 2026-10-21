# SurgeryScreen Lite

**A free, open-source waiting-room slideshow for GP practices.**

SurgeryScreen Lite turns a TV and a Raspberry Pi (or any device with a web
browser) into an always-on waiting-room display. Build a slideshow from your
own images, text and videos, publish it, and the screen updates itself.

It's the free, self-hosted edition of [SurgeryScreen](https://surgeryscreen.co.uk).
You host it, you set it up, and you look after it. There's no support. If you'd
rather have it done for you, see [Lite or SurgeryScreen?](#lite-or-surgeryscreen).

---

## Features

- 🖼️ **Slideshow editor.** Upload images by dragging them in, then reorder
  them by dragging. Each slide can have its own caption, duration and fit.
  The whole show has timing, transitions, shuffle, loop and a background
  colour.
- 📝 **Text slides.** Compose a notice in the editor (heading, body, colours,
  the NHS logo or your own) with no design tool needed.
- 🎬 **Video slides.** Paste a direct `.mp4` link and the video streams from
  there, with nothing uploaded. A video plays once through or loops for a set
  time, muted or with sound.
- 🗓️ **Scheduled and repeating slides.** Show a slide between two dates, and
  optionally repeat it every week, month or year.
- 🌤️ **Live widgets.** Show the clock, date, weather, pollen and air quality
  in a bar or a floating box.
- 📝 **Draft → Publish.** Edit privately, preview, then publish. The screen
  only ever shows the last published version.
- 📺 **Fitted to the TV.** On publish, every slide is rendered to a clean
  16:9, 4:3 or portrait canvas.
- 🔄 **Updates over the air.** The screen checks for new versions and swaps
  content in place, with no flicker and no manual refresh.
- 📶 **Keeps going offline.** The last published slideshow keeps playing
  through Wi-Fi drops.
- 🔐 **Simple sign-in.** One admin password.

### Lite or SurgeryScreen?

|  | Lite (this repo) | [SurgeryScreen](https://surgeryscreen.co.uk) |
| --- | --- | --- |
| Price | Free | Monthly or annual subscription |
| Hosting and updates | You do it | Done for you |
| Displays | One | As many as you need |
| Sign-in | One shared admin password | Each person signs in by email; colleagues can be added |
| Images, text and video slides, scheduling, widgets | ✔ | ✔ |
| Patient calling from SystmOne (chime, spoken announcement) | — | ✔ |
| Ready-made image and video templates | — | ✔ |
| Live feature slides (practice data, weather forecast, bank holidays) | — | ✔ |
| Version history and roll-back | — | ✔ |
| Screen health monitoring (online status, power, temperature) | — | ✔ |
| Hardware, installation and face-to-face training | — | ✔ |
| Support | — (community only) | ✔ |

---

## What you need

### A server

Lite is a web app. It needs to run somewhere that both the TV and the person
editing the slideshow can reach. Pick whichever suits you:

- **A small cloud server or VPS** running Docker, which costs a few pounds
  a month. This is the simplest option, because SQLite and local storage
  just work. See [Docker](#docker-recommended).
- **Free hosting tiers.** Vercel with Neon Postgres and Cloudflare R2 all
  have free tiers that comfortably run one display. See
  [Vercel](#vercel-and-other-serverless-hosts).
- **A machine on your own network.** This works as long as the TV can reach
  it. Check with your IT provider first.

### The screen hardware

This is a tried-and-tested Raspberry Pi kit. You can get it from The Pi Hut,
Pimoroni or another Raspberry Pi approved reseller for **roughly £100**,
plus the TV.

| Item | Notes |
| --- | --- |
| **Raspberry Pi 4 Model B (4 GB)** or **Raspberry Pi 5 (4 GB)** | Either plays 1080p slideshows and video smoothly. 2 GB works for image-only slideshows. |
| **Official Raspberry Pi USB-C power supply** | Pi 4: 15 W (5.1 V 3 A). Pi 5: 27 W (5.1 V 5 A). Don't use a phone charger: under-powered Pis restart during video. |
| **Case with a heatsink or fan** | For a Pi 5, use the official case (it has a fan) or the Active Cooler. It's on all day behind a TV, so heat matters. |
| **32 GB microSD card, class A1 or A2** | For example, the official Raspberry Pi card or a SanDisk Extreme. |
| **Micro-HDMI to HDMI cable** | The Pi 4 and Pi 5 have *micro*-HDMI ports. |
| **A network connection** | An Ethernet cable is best. Wi-Fi also works. Ask your IT provider whether a device like this may join the practice network. Many practices use a guest network or a 4G router instead. |
| **A TV or monitor with HDMI** | Any size. Set it to switch on to the HDMI input. |
| **USB keyboard and mouse** | For setup only, so borrow one. |
| *Optional:* a VESA mount or adhesive strips | To fix the Pi to the back of the TV. |

---

## Quick start (on your computer)

You need **Node.js 20 or newer**.

```bash
git clone https://github.com/JLHITS/surgeryscreen-lite.git
cd surgeryscreen-lite
npm install

cp .env.example .env.local      # then set ADMIN_PASSWORD
npm run dev
```

Open <http://localhost:3000> and sign in with your `ADMIN_PASSWORD`. Then:

1. **Create your display.** Give it a name and an address, for example
   `/ExampleSurgery`.
2. **Add slides.** Drag images onto the editor, or add a text or video
   slide. Drag slides to reorder them, and click one to edit it.
3. **Set it up.** The settings panel holds the TV format, timing,
   transitions, widgets and your logo.
4. **Preview, then Publish.** The screen address shows what you published.

---

## Deploy

### Docker (recommended)

This is the simplest production setup. It runs one container, with SQLite and
local image storage, and keeps its data in a named volume:

```bash
# Provide settings (or put them in a .env file beside docker-compose.yml)
export ADMIN_PASSWORD="a long password"
export SESSION_SECRET="$(openssl rand -hex 32)"

docker compose up -d --build
```

Then open <http://localhost:3000>. Put it behind a reverse proxy (Caddy,
Nginx, Traefik…) to add HTTPS and your domain. Caddy does both in two lines:

```
screen.example.org {
  reverse_proxy localhost:3000
}
```

The container reports its health at `/api/health`.

### Node host / PaaS

```bash
npm ci
npm run build
ADMIN_PASSWORD=... SESSION_SECRET=... npm start
```

Lite is a standard Next.js server, so it runs anywhere that runs Node: a VPS,
Render, Railway, Fly.io and so on. If the host has a persistent disk, the
default SQLite and local storage need only `ADMIN_PASSWORD` and
`SESSION_SECRET`.

### Vercel (and other serverless hosts)

Serverless platforms have **no persistent filesystem**, so you can't use
SQLite or local image storage there. Connect a managed database and object
storage instead:

1. **Database.** Add a Postgres database to the project (for example, the
   Neon integration). It injects a connection string automatically. Lite
   detects `DATABASE_URL` / `POSTGRES_URL` and switches to Postgres with no
   extra configuration.
2. **Image storage.** Create an S3-compatible bucket (Cloudflare R2, AWS S3,
   Backblaze B2…). Set `STORAGE_DRIVER=s3` and the `S3_*` variables below.
3. **Sign-in.** Set `ADMIN_PASSWORD` and a long random `SESSION_SECRET`.

If any of this is missing, the admin shows a setup screen that explains what
to configure.

---

## Configuration

All configuration is through environment variables. See
[`.env.example`](./.env.example).

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_PASSWORD` | — | **Required.** The admin password. The admin stays locked until it's set. |
| `SESSION_SECRET` | derived from the password | **Recommended.** Secret that signs the sign-in cookie: a long random value. Changing it signs everyone out. |
| `DATABASE_DRIVER` | `sqlite` | `sqlite` or `postgres`. |
| `DATABASE_URL` | — | Postgres connection string (when `DATABASE_DRIVER=postgres`). |
| `DATABASE_CA_CERT` | — | PEM certificate of the CA behind the Postgres server. When it's set, the server's certificate is verified against it. |
| `DATABASE_POOL_MAX` | `5` (`2` serverless) | How many Postgres connections each server instance may hold. |
| `STORAGE_DRIVER` | `local` | `local` or `s3`. |
| `DATA_DIR` | `./data` | Directory for the SQLite file and local images. |
| `S3_BUCKET` | — | Bucket name (when `STORAGE_DRIVER=s3`). |
| `S3_REGION` | `us-east-1` | Bucket region (`auto` for R2). |
| `S3_ENDPOINT` | — | Custom endpoint for R2, MinIO, B2 and so on. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | Bucket credentials. |
| `S3_FORCE_PATH_STYLE` | `true` | Path-style addressing, which most non-AWS S3 services need. |
| `S3_PUBLIC_URL` | — | Optional public or CDN base URL, to serve images directly. |
| `MAX_UPLOAD_MB` | `25` | Maximum size of each uploaded image. |
| `SITE_URL` | browser origin | Public address of the deployment, for the copyable screen address and the Pi setup command. |

| Goal | Settings |
| --- | --- |
| One self-hosted box (default) | `DATABASE_DRIVER=sqlite`, `STORAGE_DRIVER=local` |
| Managed Postgres, local disk | `DATABASE_DRIVER=postgres` + `DATABASE_URL` |
| Fully cloud / serverless | `DATABASE_DRIVER=postgres` + `STORAGE_DRIVER=s3` |

---

## Setting up the TV

The quickest way to test is to open your screen address (for example
`https://screen.example.org/ExampleSurgery`) in any browser and press
**Fullscreen**. The page keeps the screen awake. New content appears by
itself after you publish.

For a waiting room, use a Raspberry Pi so the display starts on its own every
morning.

### Raspberry Pi kiosk, step by step

1. **Write the SD card.** On any computer, install
   [Raspberry Pi Imager](https://www.raspberrypi.com/software/). Choose your
   Pi model, **Raspberry Pi OS (64-bit)** (the one *with desktop*, not
   *Lite*) and your microSD card. When Imager offers to customise the OS:
   - set a username and password;
   - add your Wi-Fi (skip this if you're using a cable);
   - set the time zone to `Europe/London` and the keyboard to `gb`.

   Then write the card.
2. **Connect the Pi.** Put the card in the Pi. Connect it to the TV's HDMI
   input (use the port nearest the power socket), and plug in the network
   cable if you have one, plus the keyboard and mouse. Connect the power
   supply last. The Pi starts to the desktop.
3. **Run the setup.** In your SurgeryScreen Lite editor, open
   **Screen address** and copy the **Raspberry Pi setup command**. On the
   Pi, open **Terminal** and paste it in. It looks like this (keep the
   quotes around the address):

   ```bash
   curl -fsSL https://screen.example.org/pi-setup.sh | sudo bash -s -- 'https://screen.example.org/ExampleSurgery'
   ```

4. **Restart.** When the setup finishes, answer **Y** to restart. The Pi logs
   in by itself and opens your display full screen. Unplug the keyboard and
   mouse, then fix the Pi behind the TV.

The setup script:

- opens the display full screen every time the Pi starts, and reopens it if
  it ever closes (it turns on automatic login and turns off screen blanking);
- hides the mouse pointer;
- installs a colour emoji font;
- restarts the Pi if it ever freezes (hardware watchdog), and every night at
  03:30;
- sets the clock from your server when internet time is blocked, which is
  common on NHS networks;
- keeps logs across restarts;
- finishes with a power and temperature health check and a summary.

It's safe to re-run, for example after updating Lite. Without an address it
keeps the saved one. Options are `--no-nightly-restart`, `--show-pointer` and
`--reboot`.

### Videos and unexpected restarts

A Pi that restarts by itself while playing video is almost always short of
power. Use the official power supply. The setup script's health check reports
whether the Pi has seen under-voltage. Keep videos light: **H.264 MP4, 1080p
or 720p, 30 fps, about 3 Mbps or less** (roughly 25 MB per minute). To
re-encode a heavy video:

```bash
ffmpeg -i input.mp4 -vf "scale=-2:'min(1080,ih)'" -r 30 \
  -c:v libx264 -profile:v high -level 4.0 -preset slow -crf 23 \
  -maxrate 2.5M -bufsize 5M -pix_fmt yuv420p -g 60 \
  -c:a aac -b:a 128k -movflags +faststart output.mp4
```

After an unexpected restart, run `journalctl -b -1 -e` on the Pi to see the
last moments before it went down.

---

## Security and privacy

- **Don't put patient information on slides.** The screen address is public,
  so anyone who has it can see the slideshow.
- Use a long `ADMIN_PASSWORD` and set `SESSION_SECRET`. Sign-in attempts are
  rate-limited.
- Always serve Lite over HTTPS in production.
- Weather and place search come from [Open-Meteo](https://open-meteo.com),
  and only when you use the weather widget. Lite has no analytics and no
  tracking.

## Updating

```bash
git pull
docker compose up -d --build    # or: npm ci && npm run build, then restart
```

The screen picks up the new version at its next reload. The Pi restarts
every night, so that happens by the next morning.

---

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Radix UI ·
sharp (image processing) · better-sqlite3 / pg · S3-compatible storage.

## Licence

SurgeryScreen Lite is free software under the
[GNU Affero General Public License v3.0](./LICENSE). You can use, study,
change and share it. If you run a modified version as a service that other
people use, you must offer them its source code under the same licence.

"SurgeryScreen" is the name of the paid service at
[surgeryscreen.co.uk](https://surgeryscreen.co.uk). If you offer a modified
version to others, please give it a different name.
