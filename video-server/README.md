# Video server for CoolSchool live lessons (Jitsi)

CoolSchool's live lessons run on [Jitsi Meet](https://jitsi.org/). Which Jitsi server is used is set in one line in [`site-config.js`](../site-config.js).

## Why not the free meet.jit.si?

`meet.jit.si` is Jitsi's public demo server. Since 2023 it:

- asks the first person in a room (the teacher) to **sign in with Google, GitHub or Facebook**, and
- **cuts calls embedded in another website after 5 minutes**.

These are rules of that server; CoolSchool cannot turn them off. On the school's **own** Jitsi server nobody has to sign in and there is no time limit.

## Set up your own server (about an hour)

You need:

- A Linux server (Ubuntu 22.04/24.04) with a public IP. **4 CPUs and 8 GB RAM** is enough for a few classes at once. For many classes at the same time, add more video bridges (see "Bigger schools" below). Ministry of Education servers work too.
- A domain name pointing to it, e.g. `meet.yourschool.org.il`.
- Open ports: **80/tcp, 443/tcp, 10000/udp**.
- [Docker with Docker Compose](https://docs.docker.com/engine/install/ubuntu/).

Then, on the server:

```bash
# 1. Download the latest official docker-jitsi-meet release
wget $(wget -q -O - https://api.github.com/repos/jitsi/docker-jitsi-meet/releases/latest | grep zip | cut -d\" -f4)
unzip stable-* && cd jitsi-docker-jitsi-meet-*   # the download is named like "stable-9909"

# 2. Settings file and strong internal passwords
cp env.example .env
./gen-passwords.sh

# 3. Folders for configuration
mkdir -p ~/.jitsi-meet-cfg/{web,transcripts,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,jigasi,jibri}
```

Edit `.env` and set:

```bash
PUBLIC_URL=https://meet.yourschool.org.il
HTTP_PORT=80
HTTPS_PORT=443
TZ=Asia/Jerusalem
ENABLE_LETSENCRYPT=1                       # free HTTPS certificate
LETSENCRYPT_DOMAIN=meet.yourschool.org.il
LETSENCRYPT_EMAIL=it@yourschool.org.il
# If the server is behind NAT (cloud servers often are), its public IP:
# JVB_ADVERTISE_IPS=203.0.113.10
```

Leave `ENABLE_AUTH` unset (or `0`). That is what makes the server **open without any sign-in**.

Start it:

```bash
docker compose up -d
```

Open `https://meet.yourschool.org.il` in a browser to check that a call works.

## Point CoolSchool at it

1. On GitHub, open [`site-config.js`](../site-config.js) and click the pencil (edit).
2. Change the line to your server:
   ```js
   jitsiDomain: 'meet.yourschool.org.il',
   ```
3. Commit. After a minute or two the site uses the new server for everyone.

The principal can check it under **Settings → Video server for live lessons → Check connection**.

## Good to know

- **Who can use the server:** with sign-in turned off, anyone who knows the address can open a call on it. Room names are hard to guess, but for full control the next step is *token (JWT) sign-in*. In that setup the CoolSchool server hands each logged-in teacher and student a token behind the scenes, so users still never see a login screen. It needs a CoolSchool backend.
- **Bigger schools:** one server handles roughly 100–300 people at once, depending on video quality. For more, run additional `jvb` (video bridge) containers on more servers. The docker-jitsi-meet documentation covers this as "scaling".
- **Privacy:** on your own server, video goes only through the school's server, which helps with privacy rules for minors.
- Official documentation: <https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker>
