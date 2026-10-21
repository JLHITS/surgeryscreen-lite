#!/usr/bin/env bash
#
# SurgeryScreen Lite — Raspberry Pi kiosk setup.
#
# Turns a freshly imaged Raspberry Pi (Raspberry Pi OS *with desktop*,
# Bookworm or newer) into a waiting-room screen: it boots straight into your
# display, full screen, and looks after itself.
#
# First time, with your screen address (from the editor's "Screen address"):
#
#   curl -fsSL https://your-site/pi-setup.sh | sudo bash -s -- 'https://your-site/YourDisplay'
#
# Safe to re-run any time. Without an address it keeps the one it was given
# before:
#
#   curl -fsSL https://your-site/pi-setup.sh | sudo bash
#
# Options, after the address:
#   --no-nightly-restart   don't restart the Pi at 03:30 each night
#   --show-pointer         don't hide the mouse pointer (undoes hiding it)
#   --reboot               restart as soon as setup finishes
#
# What it does:
#   1. Installs the emoji font (for emoji in text slides).
#   2. Starts the display full screen at login — restarting it if it ever
#      closes — with automatic desktop login and screen blanking off.
#   3. Reliability: restarts itself if it ever freezes, sets the clock from
#      your server when internet time is blocked, keeps logs across restarts
#      and (optionally) restarts every night at 03:30.
#   4. Prints a health check (power, temperature, memory) and a summary.

set -euo pipefail

CONF_DIR="/etc/surgeryscreen"
KIOSK_BIN="/usr/local/bin/surgeryscreen-kiosk"
TIMESYNC_BIN="/usr/local/sbin/surgeryscreen-timesync"

DISPLAY_URL=""
WANT_NIGHTLY=1
WANT_HIDDEN_POINTER=1
WANT_REBOOT=0
KIOSK_USER=""
KIOSK_HOME=""
SUMMARY=()

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
ok() { SUMMARY+=("  ✔ $*"); info "✔ $*"; }
warn() { SUMMARY+=("  ! $*"); printf '  \033[33m! %s\033[0m\n' "$*"; }

usage() {
  cat <<'EOF'
Usage:  curl -fsSL https://your-site/pi-setup.sh | sudo bash -s -- 'https://your-site/YourDisplay' [options]

  --no-nightly-restart   don't restart the Pi at 03:30 each night
  --show-pointer         don't hide the mouse pointer (undoes hiding it)
  --reboot               restart when finished
EOF
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --no-nightly-restart) WANT_NIGHTLY=0 ;;
      --show-pointer) WANT_HIDDEN_POINTER=0 ;;
      --reboot) WANT_REBOOT=1 ;;
      -h | --help) usage; exit 0 ;;
      http://* | https://*) DISPLAY_URL="${1%/}" ;;
      *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    esac
    shift
  done
}

# Run a command as the desktop user.
as_user() {
  runuser -u "$KIOSK_USER" -- env HOME="$KIOSK_HOME" "$@"
}

# ── 0. Who, and which display ────────────────────────────────────────────────

find_user() {
  KIOSK_USER="${SUDO_USER:-}"
  if [ -z "$KIOSK_USER" ] || [ "$KIOSK_USER" = root ]; then
    KIOSK_USER="$(getent passwd 1000 | cut -d: -f1 || true)"
  fi
  if [ -z "$KIOSK_USER" ] || [ "$KIOSK_USER" = root ]; then
    echo "Couldn't find the Pi's desktop user (run this with sudo from that user)." >&2
    exit 1
  fi
  KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
}

resolve_url() {
  if [ -z "$DISPLAY_URL" ] && [ -s "$CONF_DIR/display-url" ]; then
    DISPLAY_URL="$(cat "$CONF_DIR/display-url")"
    info "Using the display address saved last time: $DISPLAY_URL"
  fi
  if [ -z "$DISPLAY_URL" ] && [ -r /dev/tty ]; then
    printf '  Screen address (e.g. https://your-site/YourDisplay): ' >/dev/tty
    read -r DISPLAY_URL </dev/tty || true
    DISPLAY_URL="${DISPLAY_URL%/}"
  fi
  case "$DISPLAY_URL" in
    http://* | https://*) ;;
    *)
      echo "The display's address is needed the first time." >&2
      usage >&2
      exit 1
      ;;
  esac
  install -d -m 755 "$CONF_DIR"
  echo "$DISPLAY_URL" >"$CONF_DIR/display-url"
  if curl -fsS -o /dev/null --max-time 15 "$DISPLAY_URL"; then
    ok "Display address: $DISPLAY_URL"
  else
    warn "Couldn't open $DISPLAY_URL just now — check the address and the network"
  fi
}

# ── 1. Packages ──────────────────────────────────────────────────────────────

step_packages() {
  say "1. Installing packages"
  # </dev/null: when piped into bash, apt must not read the rest of this script.
  if apt-get update -qq </dev/null &&
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fonts-noto-color-emoji curl \
      </dev/null >/dev/null; then
    ok "Emoji font installed"
  else
    warn "Couldn't install packages (offline?) — re-run this script later"
  fi
}

# ── 2. Kiosk: the display, full screen, at every start ───────────────────────

# Hide the mouse pointer. With no mouse, the desktop draws its pointer in the
# middle of the TV and nothing a web page does can hide it, so the desktop is
# given an invisible pointer theme (labwc reads XCURSOR_THEME from its
# environment file). X11 sessions use unclutter. --show-pointer undoes it.
POINTER_THEME="surgeryscreen-hidden"
POINTER_ENV_MARK="# SurgeryScreen: invisible pointer (run pi-setup.sh with --show-pointer to undo)"

make_hidden_pointer_theme() {
  local dir="/usr/share/icons/$POINTER_THEME/cursors" name
  install -d -m 755 "$dir"
  printf '[Icon Theme]\nName=SurgeryScreen hidden pointer\nComment=An invisible pointer for waiting-room screens (pi-setup.sh)\n' \
    >"/usr/share/icons/$POINTER_THEME/index.theme"
  # One 1x1 fully transparent Xcursor image (header, table of contents, image).
  printf 'Xcur\x10\x00\x00\x00\x00\x00\x01\x00\x01\x00\x00\x00\x02\x00\xfd\xff\x18\x00\x00\x00\x1c\x00\x00\x00\x24\x00\x00\x00\x02\x00\xfd\xff\x18\x00\x00\x00\x01\x00\x00\x00\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00' \
    >"$dir/default"
  for name in left_ptr arrow top_left_arrow pointer hand1 hand2 pointing_hand text xterm ibeam \
    wait watch progress left_ptr_watch half-busy crosshair cross tcross move fleur grab grabbing \
    openhand closedhand all-scroll not-allowed no-drop crossed_circle forbidden help question_arrow \
    whats_this context-menu cell plus vertical-text alias copy dnd-move dnd-copy dnd-link dnd-none \
    dnd-ask zoom-in zoom-out col-resize row-resize split_h split_v ew-resize ns-resize nesw-resize \
    nwse-resize n-resize s-resize e-resize w-resize ne-resize nw-resize se-resize sw-resize \
    sb_h_double_arrow sb_v_double_arrow h_double_arrow v_double_arrow size_hor size_ver size_bdiag \
    size_fdiag size_all top_side bottom_side left_side right_side top_left_corner top_right_corner \
    bottom_left_corner bottom_right_corner X_cursor pirate; do
    ln -sfn default "$dir/$name"
  done
}

# Put labwc's pointer theme back.
restore_labwc_pointer() {
  local envf="$KIOSK_HOME/.config/labwc/environment"
  if [ -f "$envf" ]; then
    sed -i -e "\|^$POINTER_ENV_MARK\$|,+1d" -e 's/^# \(XCURSOR_THEME=.*\)  # switched off by SurgeryScreen$/\1/' "$envf"
  fi
}

setup_pointer_hiding() {
  if [ "$WANT_HIDDEN_POINTER" = 0 ]; then
    restore_labwc_pointer
    rm -rf "/usr/share/icons/$POINTER_THEME"
    info "mouse pointer left visible (--show-pointer)"
    return 0
  fi

  # X11 (and the older wayfire desktop): unclutter hides an idle pointer.
  dpkg -s unclutter >/dev/null 2>&1 ||
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unclutter </dev/null >/dev/null 2>&1 || true

  if ! command -v labwc >/dev/null; then
    if command -v unclutter >/dev/null; then
      ok "Mouse pointer hidden when not in use"
    else
      warn "Couldn't install unclutter, so the mouse pointer stays on screen"
    fi
    return 0
  fi

  make_hidden_pointer_theme
  restore_labwc_pointer # start clean: only our line, no other theme
  local envf="$KIOSK_HOME/.config/labwc/environment"
  as_user mkdir -p "$KIOSK_HOME/.config/labwc"
  touch "$envf"
  [ -f "$envf.surgeryscreen-backup" ] || cp "$envf" "$envf.surgeryscreen-backup"
  # Switch off any other pointer theme set here, then add ours.
  sed -i 's/^\(XCURSOR_THEME=.*\)$/# \1  # switched off by SurgeryScreen/' "$envf"
  printf '%s\nXCURSOR_THEME=%s\n' "$POINTER_ENV_MARK" "$POINTER_THEME" >>"$envf"
  chown "$KIOSK_USER:" "$envf" "$envf.surgeryscreen-backup"
  ok "Mouse pointer hidden after the restart (to show it again: run this with --show-pointer)"
}

step_kiosk() {
  say "2. Starting the display full screen at every start"
  if [ ! -d /etc/lightdm ] && ! command -v labwc >/dev/null && ! command -v wayfire >/dev/null; then
    warn "No desktop found — this needs Raspberry Pi OS *with desktop*, not Raspberry Pi OS Lite"
    return 0
  fi
  if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium </dev/null >/dev/null 2>&1 || true
  fi
  if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
    warn "Chromium isn't installed and couldn't be added"
    return 0
  fi

  # The launcher: waits briefly for the network, then keeps Chromium running.
  cat >"$KIOSK_BIN" <<'EOF'
#!/usr/bin/env bash
# SurgeryScreen kiosk (installed by pi-setup.sh). Shows the display full
# screen and reopens it if the browser ever closes or crashes.
URL="$(cat /etc/surgeryscreen/display-url 2>/dev/null)"
[ -n "$URL" ] || exit 0

# Only one copy, however many times it's started.
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/surgeryscreen-kiosk.lock"
flock -n 9 || exit 0

BROWSER="$(command -v chromium || command -v chromium-browser)"
PROFILE="$HOME/.config/surgeryscreen-kiosk"

# Give the network up to a minute after boot (the display copes offline too).
for _ in $(seq 30); do
  curl -fsS -o /dev/null --max-time 3 "$URL" && break
  sleep 2
done

# Hide an idle mouse pointer on X11 desktops. (On labwc, the Raspberry Pi
# desktop, pi-setup.sh gives the desktop an invisible pointer instead.)
if [ -z "${WAYLAND_DISPLAY:-}" ] && [ -n "${DISPLAY:-}" ] && command -v unclutter >/dev/null; then
  unclutter -idle 1 -root >/dev/null 2>&1 &
fi

while true; do
  # Never offer to "restore pages" after a power cut.
  PREFS="$PROFILE/Default/Preferences"
  [ -f "$PREFS" ] && sed -i \
    -e 's/"exited_cleanly":false/"exited_cleanly":true/' \
    -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
  "$BROWSER" \
    --kiosk --noerrdialogs --disable-infobars --no-first-run --no-default-browser-check \
    --disable-session-crashed-bubble --disable-restore-session-state \
    --password-store=basic --disable-features=Translate \
    --overscroll-history-navigation=0 --disable-pinch \
    --autoplay-policy=no-user-gesture-required \
    --user-data-dir="$PROFILE" "$URL"
  sleep 3
done
EOF
  chmod 755 "$KIOSK_BIN"

  # Start it at login. XDG autostart covers LXDE and wayfire…
  as_user mkdir -p "$KIOSK_HOME/.config/autostart"
  cat >"$KIOSK_HOME/.config/autostart/surgeryscreen-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=SurgeryScreen display
Comment=Shows the waiting-room display full screen (installed by pi-setup.sh)
Exec=$KIOSK_BIN
X-GNOME-Autostart-enabled=true
EOF
  chown "$KIOSK_USER:" "$KIOSK_HOME/.config/autostart/surgeryscreen-kiosk.desktop"

  # …but labwc (the Raspberry Pi desktop's default) runs only the first
  # autostart file it finds, so make sure the user's own one starts it too.
  # (The launcher's lock stops it opening twice.)
  if command -v labwc >/dev/null; then
    local labwc_autostart="$KIOSK_HOME/.config/labwc/autostart"
    as_user mkdir -p "$KIOSK_HOME/.config/labwc"
    if [ ! -f "$labwc_autostart" ] && [ -f /etc/xdg/labwc/autostart ]; then
      cp /etc/xdg/labwc/autostart "$labwc_autostart"
    fi
    touch "$labwc_autostart"
    if ! grep -qF "$KIOSK_BIN" "$labwc_autostart"; then
      printf '\n# SurgeryScreen display (added by pi-setup.sh)\n%s &\n' "$KIOSK_BIN" >>"$labwc_autostart"
    fi
    chown "$KIOSK_USER:" "$labwc_autostart"
  fi
  ok "Display opens full screen at start-up, and reopens if it closes"
  setup_pointer_hiding

  if command -v raspi-config >/dev/null; then
    if SUDO_USER="$KIOSK_USER" raspi-config nonint do_boot_behaviour B4 >/dev/null 2>&1; then
      ok "Logs in to the desktop automatically as $KIOSK_USER"
    else
      warn "Couldn't turn on automatic login — set it in Raspberry Pi Configuration"
    fi
    if raspi-config nonint do_blanking 1 >/dev/null 2>&1; then
      ok "Screen blanking switched off"
    else
      warn "Couldn't switch off screen blanking — do it in Raspberry Pi Configuration"
    fi
  else
    warn "raspi-config not found — set automatic login and screen blanking by hand"
  fi
}

# ── 3. Reliability ───────────────────────────────────────────────────────────

step_reliability() {
  say "3. Making it look after itself"

  # Logs that survive a restart, so an unexpected one can be traced.
  if [ ! -d /var/log/journal ]; then
    install -d -m 2755 -g systemd-journal /var/log/journal
    systemd-tmpfiles --create --prefix /var/log/journal >/dev/null 2>&1 || true
    systemctl restart systemd-journald || true
  fi
  ok "Logs kept across restarts (after one, run: journalctl -b -1 -e)"

  # Hardware watchdog: if the Pi ever freezes solid, it restarts itself.
  if [ -e /dev/watchdog ]; then
    install -d -m 755 /etc/systemd/system.conf.d
    cat >/etc/systemd/system.conf.d/surgeryscreen-watchdog.conf <<'EOF'
# SurgeryScreen: restart automatically if the Pi ever freezes.
[Manager]
RuntimeWatchdogSec=10
RebootWatchdogSec=2min
EOF
    ok "Restarts itself if it ever freezes (hardware watchdog)"
  fi

  # Clock: a Pi has no battery-backed clock, and many NHS networks block
  # internet time (NTP). If NTP hasn't synced, take the time from your
  # server's web response instead — only the Date header is read, so
  # certificate checks are skipped in case the clock is far out.
  cat >"$TIMESYNC_BIN" <<'EOF'
#!/usr/bin/env bash
# SurgeryScreen (installed by pi-setup.sh): set the clock from the display
# server when internet time (NTP) isn't working.
[ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" = yes ] && exit 0
URL="$(cat /etc/surgeryscreen/display-url 2>/dev/null)"
[ -n "$URL" ] || exit 0
NOW="$(curl -sI --insecure --max-time 15 "$URL" | tr -d '\r' | sed -n 's/^[Dd]ate: //p' | head -1)"
[ -n "$NOW" ] && date -s "$NOW" >/dev/null && echo "Clock set from $URL: $NOW"
EOF
  chmod 755 "$TIMESYNC_BIN"
  cat >/etc/systemd/system/surgeryscreen-timesync.service <<EOF
[Unit]
Description=SurgeryScreen: set the clock from the display server if NTP is blocked
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=$TIMESYNC_BIN
EOF
  cat >/etc/systemd/system/surgeryscreen-timesync.timer <<'EOF'
[Unit]
Description=SurgeryScreen: check the clock after start-up and hourly

[Timer]
OnBootSec=90s
OnUnitActiveSec=1h

[Install]
WantedBy=timers.target
EOF

  # Nightly restart: clears the day's memory use while the waiting room is empty.
  cat >/etc/systemd/system/surgeryscreen-nightly-restart.service <<'EOF'
[Unit]
Description=SurgeryScreen: nightly restart

[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl reboot
EOF
  cat >/etc/systemd/system/surgeryscreen-nightly-restart.timer <<'EOF'
[Unit]
Description=SurgeryScreen: restart the Pi at 03:30 every night

[Timer]
OnCalendar=*-*-* 03:30:00

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now surgeryscreen-timesync.timer >/dev/null 2>&1 || true
  if [ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" = yes ]; then
    ok "Clock is synced with internet time"
  else
    "$TIMESYNC_BIN" >/dev/null 2>&1 || true
    ok "Internet time isn't reachable — the clock is set from your server instead"
  fi

  if [ "$WANT_NIGHTLY" = 1 ]; then
    systemctl enable surgeryscreen-nightly-restart.timer >/dev/null 2>&1 || true
    ok "Restarts every night at 03:30"
  else
    systemctl disable --now surgeryscreen-nightly-restart.timer >/dev/null 2>&1 || true
    info "no nightly restart (--no-nightly-restart)"
  fi
}

# ── 4. Health check ──────────────────────────────────────────────────────────

step_health() {
  say "4. Health check"
  local model throttled
  model="$(tr -d '\0' 2>/dev/null </proc/device-tree/model || echo unknown)"
  info "Model:   $model"
  info "Memory:  $(free -h | awk '/^Mem:/ {print $2 " total, " $7 " available"}')"
  info "Disk:    $(df -h / | awk 'NR==2 {print $4 " free of " $2}')"
  command -v vcgencmd >/dev/null 2>&1 || return 0
  info "Temp:    $(vcgencmd measure_temp | cut -d= -f2)"
  throttled=$(($(vcgencmd get_throttled | cut -d= -f2)))
  if ((throttled & 0x10001)); then
    warn "UNDER-VOLTAGE since start-up: the power supply can't keep up. Use the official Raspberry Pi power supply — phone chargers aren't enough, and cause restarts during video"
  else
    ok "Power supply OK (no under-voltage since start-up)"
  fi
  # Frequency capped / soft temperature limit, now or since start-up.
  if ((throttled & 0xA000A)); then
    warn "The Pi has slowed itself down to cool off — use a case with a heatsink or fan, with space around it"
  fi
}

finish() {
  say "Summary"
  printf '%s\n' "${SUMMARY[@]}"
  echo
  if [ "$WANT_REBOOT" = 1 ]; then
    say "Restarting in 5 seconds…"
    sleep 5
    systemctl reboot
    return 0
  fi
  local answer=""
  if [ -r /dev/tty ]; then
    printf '  Restart now to finish setting up? [Y/n] ' >/dev/tty
    read -r answer </dev/tty || answer="n"
  else
    answer="n"
  fi
  case "$answer" in
    "" | y | Y | yes | Yes) say "Restarting…"; sleep 2; systemctl reboot ;;
    *) say "Done. Restart when ready to finish:  sudo reboot" ;;
  esac
}

# Everything runs from main(), called on the last line, so a partly
# downloaded script piped into bash can never run half-way.
main() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Please run with sudo — see: curl -fsSL https://your-site/pi-setup.sh | sudo bash -s -- --help" >&2
    exit 1
  fi
  parse_args "$@"
  say "SurgeryScreen Lite — Raspberry Pi setup"
  find_user
  info "Desktop user: $KIOSK_USER"
  resolve_url

  # Each step reports its own problems; one going wrong never stops the rest.
  step_packages || warn "Packages step hit a problem"
  step_kiosk || warn "Kiosk step hit a problem"
  step_reliability || warn "Reliability step hit a problem"
  step_health || true
  finish
}

main "$@"
